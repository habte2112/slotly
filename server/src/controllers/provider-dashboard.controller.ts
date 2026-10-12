import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { notifyBooking } from "../services/email.service";

async function getOwnProvider(req: AuthRequest, res: Response) {
  const provider = await prisma.provider.findUnique({
    where: { userId: req.user!.id },
    select: { id: true, bio: true, user: { select: { name: true } } },
  });
  if (!provider) {
    res.status(404).json({ message: "Provider profile not found" });
    return null;
  }
  return provider;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

const workingHoursSchema = z.object({
  windows: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: time, endTime: time }))
    .max(50),
});

function validateWindows(windows: { dayOfWeek: number; startTime: string; endTime: string }[]): string | null {
  for (const w of windows) {
    if (w.startTime >= w.endTime) return "End time must be after start time";
  }
  for (let d = 0; d < 7; d++) {
    const day = windows
      .filter((w) => w.dayOfWeek === d)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) {
      if (day[i].startTime < day[i - 1].endTime) return "Working hours on the same day must not overlap";
    }
  }
  return null;
}

export async function getOwnProfile(req: AuthRequest, res: Response) {
  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  const [workingHours, timeOff] = await Promise.all([
    prisma.workingHour.findMany({
      where: { providerId: provider.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId: provider.id, endAt: { gt: new Date() } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  res.json({
    provider: { id: provider.id, name: provider.user.name, bio: provider.bio },
    workingHours,
    timeOff,
  });
}

export async function setWorkingHours(req: AuthRequest, res: Response) {
  const parsed = workingHoursSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const problem = validateWindows(parsed.data.windows);
  if (problem) {
    res.status(400).json({ message: problem });
    return;
  }

  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { providerId: provider.id } }),
    prisma.workingHour.createMany({
      data: parsed.data.windows.map((w) => ({ ...w, providerId: provider.id })),
    }),
  ]);
  res.json({ workingHours: parsed.data.windows });
}

const timeOffSchema = z.object({
  startAt: isoDate,
  endAt: isoDate,
  reason: z.string().trim().max(200).optional(),
});

export async function addTimeOff(req: AuthRequest, res: Response) {
  const parsed = timeOffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (startAt >= endAt) {
    res.status(400).json({ message: "End must be after start" });
    return;
  }

  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  // በዚህ ጊዜ ቀጠሮ ካለ እረፍት አይፈቀድም (መጀመሪያ ቀጠሮዎቹን መሰረዝ አለበት)
  const conflicts = await prisma.booking.count({
    where: {
      providerId: provider.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (conflicts > 0) {
    res.status(409).json({
      message: `You have ${conflicts} booking(s) in this period. Cancel them first.`,
    });
    return;
  }

  const timeOff = await prisma.timeOff.create({
    data: { providerId: provider.id, startAt, endAt, reason: parsed.data.reason },
    select: { id: true, startAt: true, endAt: true, reason: true },
  });
  res.status(201).json({ timeOff });
}

export async function deleteTimeOff(req: AuthRequest, res: Response) {
  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  const result = await prisma.timeOff.deleteMany({
    where: { id: String(req.params.id), providerId: provider.id },
  });
  if (result.count === 0) {
    res.status(404).json({ message: "Time off not found" });
    return;
  }
  res.json({ success: true });
}

const providerBookingSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  customer: { select: { name: true, phone: true } },
  service: { select: { name: true, durationMinutes: true } },
} as const;

export async function listProviderBookings(req: AuthRequest, res: Response) {
  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  const past = req.query.scope === "past";
  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: { providerId: provider.id, endAt: past ? { lte: now } : { gt: now } },
    orderBy: { startAt: past ? "desc" : "asc" },
    take: 100,
    select: providerBookingSelect,
  });
  res.json({ bookings });
}

const statusSchema = z.object({ status: z.enum(["COMPLETED", "CANCELLED"]) });

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Status must be COMPLETED or CANCELLED" });
    return;
  }
  const provider = await getOwnProvider(req, res);
  if (!provider) return;

  const id = String(req.params.id);
  const booking = await prisma.booking.findFirst({ where: { id, providerId: provider.id } });
  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    res.status(409).json({ message: `Booking is already ${booking.status.toLowerCase()}` });
    return;
  }

  const now = new Date();
  if (parsed.data.status === "COMPLETED" && booking.startAt > now) {
    res.status(409).json({ message: "Cannot complete a booking that has not started" });
    return;
  }
  if (parsed.data.status === "CANCELLED" && booking.startAt <= now) {
    res.status(409).json({ message: "Cannot cancel a booking that already started" });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: parsed.data.status },
    select: providerBookingSelect,
  });
    if (parsed.data.status === "CANCELLED") notifyBooking("cancelled_by_provider", updated.id);
  res.json({ booking: updated });
}
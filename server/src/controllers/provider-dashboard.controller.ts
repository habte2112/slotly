import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { notifyBooking } from "../services/email.service";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { loadAvailability } from "../services/availability.service";
import { normalizePhone } from "../services/phone";
import { isOverlapError } from "./bookings.controller";

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
  priceAtBooking: true,
  customer: { select: { id: true, name: true, phone: true } },
  service: { select: { name: true, durationMinutes: true } },
  variant: { select: { name: true } },
} as const;

// ለእያንዳንዱ ደንበኛ ከዚህ በፊት ስንት ጊዜ እንዳልመጣ (no-show) ይቆጥራል
async function withNoShows<T extends { customer: { id: string } }>(bookings: T[]) {
  const ids = [...new Set(bookings.map((b) => b.customer.id))];
  const groups = ids.length
    ? await prisma.booking.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, status: "NO_SHOW" },
        _count: { _all: true },
      })
    : [];
  const counts = new Map(groups.map((g) => [g.customerId, g._count._all]));
  return bookings.map((b) => ({
    ...b,
    customer: { ...b.customer, noShows: counts.get(b.customer.id) ?? 0 },
  }));
}
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
  res.json({ bookings: await withNoShows(bookings) });
}

const statusSchema = z.object({ status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW"]) });

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Status must be COMPLETED, CANCELLED or NO_SHOW" });
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
  if ((parsed.data.status === "COMPLETED" || parsed.data.status === "NO_SHOW") && booking.startAt > now) {
    res.status(409).json({ message: "Cannot mark a booking that has not started yet" });
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
  const [withCount] = await withNoShows([updated]);
  res.json({ booking: withCount });
}

const OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Addis_Ababa (UTC+3)
const localDate = (d: Date) => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);

export const manualSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(7).max(25),
  serviceId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  startAt: isoDate,
  notes: z.string().trim().max(500).optional(),
});

// ለአንድ ባለሙያ የእጅ ቀጠሮ ይመዘግባል (ባለሙያው ራሱ፣ ወይም admin/ሪሴፕሽን ከመረጠ)
// ደንበኛው መለያ አያስፈልገውም
export async function bookManual(providerId: string, data: z.infer<typeof manualSchema>, res: Response) {
  const phone = normalizePhone(data.customerPhone);
  if (!phone) {
    res.status(400).json({ message: "Please enter a valid phone number" });
    return;
  }

  const { customerName, serviceId, variantId, notes } = data;
  const startAt = new Date(data.startAt);

  const availability = await loadAvailability(providerId, serviceId, localDate(startAt), variantId);
  if (!availability.ok) {
    res.status(availability.status).json({ message: availability.message });
    return;
  }
  if (!availability.slots.some((s) => s.start.getTime() === startAt.getTime())) {
    res.status(409).json({ message: "This time slot is not available" });
    return;
  }
  const { offering } = availability;
  const endAt = new Date(startAt.getTime() + offering.durationMinutes * 60 * 1000);

  // ቋሚ ደንበኛ በስልክ ቁጥሩ ይታወቃል፤ ከሌለ አዲስ "እንግዳ" ይፈጠራል (መግባት አይችልም፣ ኢሜይል የለውም)
  let guest = await prisma.user.findFirst({ where: { isGuest: true, phone } });
  if (!guest) {
    guest = await prisma.user.create({
      data: {
        name: customerName,
        email: `guest-${randomBytes(8).toString("hex")}@guest.slotly.invalid`,
        phone,
        passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 10),
        isGuest: true,
      },
    });
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        customerId: guest.id,
        providerId,
        serviceId,
        variantId: offering.variant?.id,
        startAt,
        endAt,
        notes,
        priceAtBooking: offering.price,
      },
      select: providerBookingSelect,
    });
    const [created] = await withNoShows([booking]);
    res.status(201).json({ booking: created });
  } catch (error) {
    if (isOverlapError(error)) {
      res.status(409).json({ message: "This time slot was just taken" });
      return;
    }
    throw error;
  }
}

export async function createManualBooking(req: AuthRequest, res: Response) {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const provider = await getOwnProvider(req, res);
  if (!provider) return;
  await bookManual(provider.id, parsed.data, res);
}
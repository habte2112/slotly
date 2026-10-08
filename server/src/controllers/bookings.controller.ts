import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { loadAvailability } from "../services/availability.service";

const OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Addis_Ababa (UTC+3)

const createSchema = z.object({
  providerId: z.string().min(1),
  serviceId: z.string().min(1),
  startAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "startAt must be an ISO date"),
  notes: z.string().trim().max(500).optional(),
});

const bookingSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  provider: { select: { id: true, user: { select: { name: true } } } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true } },
} as const;

// የ PostgreSQL exclusion constraint ጥሰትን (23P01) በተለያዩ የስህተት ቅርጾች ውስጥ ይፈልጋል
function isOverlapError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: any = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    let meta = "";
    try {
      meta = JSON.stringify(current.meta ?? {});
    } catch {
      /* ችላ በል */
    }
    const text = `${current.code ?? ""} ${current.message ?? ""} ${meta}`;
    if (/23P01|no_overlapping_bookings|exclusion constraint/i.test(text)) return true;
    current = current.cause ?? current.originalError;
  }
  return false;
}

export async function createBooking(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid input",
      errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  const { providerId, serviceId, notes } = parsed.data;
  const startAt = new Date(parsed.data.startAt);

  // የተጠየቀው ሰዓት የሚገኝበትን የአካባቢ ቀን አውጣ
  const date = new Date(startAt.getTime() + OFFSET_MS).toISOString().slice(0, 10);

  const availability = await loadAvailability(providerId, serviceId, date);
  if (!availability) {
    res.status(404).json({ message: "Provider does not offer this service" });
    return;
  }

  const isOffered = availability.slots.some((s) => s.start.getTime() === startAt.getTime());
  if (!isOffered) {
    res.status(409).json({ message: "This time slot is not available" });
    return;
  }

  const endAt = new Date(startAt.getTime() + availability.service.durationMinutes * 60 * 1000);

  try {
    const booking = await prisma.booking.create({
      data: { customerId: req.user!.id, providerId, serviceId, startAt, endAt, notes },
      select: bookingSelect,
    });
    res.status(201).json({ booking });
  } catch (error) {
    // ሁለት ሰዎች በአንድ ጊዜ ሲይዙ ዳታቤዙ ሁለተኛውን ይከለክላል
    if (isOverlapError(error)) {
      res.status(409).json({ message: "This time slot was just taken" });
      return;
    }
    throw error;
  }
}

export async function listMyBookings(req: AuthRequest, res: Response) {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.user!.id },
    orderBy: { startAt: "desc" },
    select: bookingSelect,
  });
  res.json({ bookings });
}

export async function cancelBooking(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id } });

  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  if (booking.customerId !== req.user!.id && req.user!.role !== "ADMIN") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    res.status(409).json({ message: `Booking is already ${booking.status.toLowerCase()}` });
    return;
  }
  if (booking.startAt <= new Date()) {
    res.status(409).json({ message: "Cannot cancel a booking that already started" });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
    select: bookingSelect,
  });
  res.json({ booking: updated });
}
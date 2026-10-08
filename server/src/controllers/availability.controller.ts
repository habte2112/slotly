import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  computeAvailableSlots,
  dayBoundsUtc,
  dayOfWeek,
  isValidDateString,
  TIMEZONE,
} from "../services/availability";

const querySchema = z.object({
  date: z.string().refine(isValidDateString, "date must be a valid YYYY-MM-DD"),
  serviceId: z.string().min(1),
});

export async function getAvailability(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  const { date, serviceId } = parsed.data;
  const providerId = String(req.params.id);

  const offering = await prisma.providerService.findUnique({
    where: { providerId_serviceId: { providerId, serviceId } },
    include: { service: true },
  });
  if (!offering || !offering.service.isActive) {
    res.status(404).json({ message: "Provider does not offer this service" });
    return;
  }

  const { start: dayStart, end: dayEnd } = dayBoundsUtc(date);

  const [workingHours, bookings, timeOff] = await Promise.all([
    prisma.workingHour.findMany({ where: { providerId, dayOfWeek: dayOfWeek(date) } }),
    prisma.booking.findMany({
      where: {
        providerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const busy = [...bookings, ...timeOff].map((r) => ({ start: r.startAt, end: r.endAt }));

  const slots = computeAvailableSlots({
    date,
    windows: workingHours,
    durationMinutes: offering.service.durationMinutes,
    busy,
    now: new Date(),
  });

  res.json({
    date,
    timezone: TIMEZONE,
    durationMinutes: offering.service.durationMinutes,
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
    })),
  });
}
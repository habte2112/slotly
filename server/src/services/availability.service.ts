import { prisma } from "../lib/prisma";
import { computeAvailableSlots, dayBoundsUtc, dayOfWeek } from "./availability";

export async function loadAvailability(providerId: string, serviceId: string, date: string) {
  const offering = await prisma.providerService.findUnique({
    where: { providerId_serviceId: { providerId, serviceId } },
    include: { service: true },
  });
  if (!offering || !offering.service.isActive) return null;

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

  return { service: offering.service, slots };
}
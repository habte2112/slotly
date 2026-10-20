import { prisma } from "../lib/prisma";
import { computeAvailableSlots, dayBoundsUtc, dayOfWeek, type Slot } from "./availability";
import { resolveOffering } from "./offering.service";

// ቀጠሮ ከዛሬ ጀምሮ እስከ ስንት ቀን ወደፊት ሊያዝ እንደሚችል
export const MAX_DAYS_AHEAD = 90;

// የባለሙያውን የስራ ሰዓት፣ ቀጠሮዎች እና እረፍት አንብቦ ለተሰጠው ርዝመት ባዶ ሰዓቶችን ያሰላል
export async function computeSlotsFor(
  providerId: string,
  date: string,
  durationMinutes: number,
  excludeBookingId?: string,
): Promise<Slot[]> {
  const { start: dayStart, end: dayEnd } = dayBoundsUtc(date);

  // ከገደቡ ያለፈ ቀን ባዶ ዝርዝር ይመልሳል፣ ስለዚህ ማስያዝም ማዛወርም አይቻልም
  if (dayStart.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return [];

  const [workingHours, bookings, timeOff] = await Promise.all([
    prisma.workingHour.findMany({ where: { providerId, dayOfWeek: dayOfWeek(date) } }),
    prisma.booking.findMany({
      where: {
        providerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const busy = [...bookings, ...timeOff].map((r) => ({ start: r.startAt, end: r.endAt }));

  return computeAvailableSlots({
    date,
    windows: workingHours,
    durationMinutes,
    busy,
    now: new Date(),
  });
}

// ለአዲስ ቀጠሮ እና ለህዝባዊ ዝርዝር፦ መጀመሪያ ዘይቤው ይረጋገጣል፣ ከዚያ ሰዓቶች ይሰላሉ
export async function loadAvailability(providerId: string, serviceId: string, date: string, variantId?: string | null) {
  const offering = await resolveOffering(providerId, serviceId, variantId);
  if (!offering.ok) return offering;

  const slots = await computeSlotsFor(providerId, date, offering.durationMinutes);
  return { ok: true as const, offering, slots };
}
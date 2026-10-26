import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Addis_Ababa (UTC+3)
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 10000;

function localDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

export async function getStats(req: Request, res: Response) {
  const parsed = statsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "days must be between 7 and 90" });
    return;
  }
  const { days } = parsed.data;

  // ያለፉት `days` ቀናት (ዛሬን ጨምሮ)፣ በቀጠሮው ቀን መሰረት
  const to = localDate(new Date());
  const from = localDate(new Date(Date.now() - (days - 1) * DAY_MS));
  const rangeStart = new Date(`${from}T00:00:00+03:00`);
  const rangeEnd = new Date(new Date(`${to}T00:00:00+03:00`).getTime() + DAY_MS);

  const [bookings, roleGroups, upcoming] = await Promise.all([
    prisma.booking.findMany({
      where: { startAt: { gte: rangeStart, lt: rangeEnd } },
      select: {
        startAt: true,
        status: true,
        serviceId: true,
        priceAtBooking: true,
        service: { select: { name: true, price: true } },
      },
      take: MAX_ROWS,
    }),
    prisma.user.groupBy({ by: ["role"], where: { isGuest: false }, _count: { _all: true } }),
    prisma.booking.count({
      where: { startAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
  ]);

  const perDay = new Map<string, { bookings: number; cancelled: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10);
    perDay.set(date, { bookings: 0, cancelled: 0 });
  }

  const services = new Map<string, { id: string; name: string; bookings: number; revenue: number }>();
  let scheduled = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let revenue = 0;

  for (const b of bookings) {
    const day = perDay.get(localDate(b.startAt));
    if (b.status === "CANCELLED") {
      cancelled++;
      if (day) day.cancelled++;
      continue;
    }
    if (b.status === "NO_SHOW") {
      noShow++;
      continue; // ገቢ ወይም "scheduled" ውስጥ አይቆጠርም
    }
    if (day) day.bookings++;
    if (b.status === "COMPLETED") completed++;
    else scheduled++;
    const price = b.priceAtBooking ?? b.service.price;
    revenue += price;

    const entry = services.get(b.serviceId) ?? { id: b.serviceId, name: b.service.name, bookings: 0, revenue: 0 };
    entry.bookings++;
    entry.revenue += price;
    services.set(b.serviceId, entry);
  }

  const users = { customers: 0, providers: 0, admins: 0 };
  for (const g of roleGroups) {
    if (g.role === "CUSTOMER") users.customers = g._count._all;
    if (g.role === "PROVIDER") users.providers = g._count._all;
    if (g.role === "ADMIN") users.admins = g._count._all;
  }

  const active = scheduled + completed;
  const all = active + cancelled + noShow;
  const attended = completed + noShow; // ውጤታቸው የታወቀ ቀጠሮዎች

  res.json({
    days,
    from,
    to,
    truncated: bookings.length >= MAX_ROWS,
    totals: {
      bookings: active,
      scheduled,
      completed,
      cancelled,
      revenue,
      cancellationRate: all > 0 ? cancelled / all : 0,
      noShow,
      noShowRate: attended > 0 ? noShow / attended : 0,
    },
    upcoming,
    users,
    perDay: [...perDay.entries()].map(([date, v]) => ({ date, ...v })),
    topServices: [...services.values()]
      .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
      .slice(0, 5),
  });
}

const adminBookingSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  priceAtBooking: true,
  customer: { select: { name: true, email: true, phone: true, isGuest: true } },
  provider: { select: { user: { select: { name: true } } } },
  service: { select: { name: true } },
  variant: { select: { name: true } },
} as const;

export async function listAdminBookings(req: Request, res: Response) {
  const past = req.query.scope === "past";
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { endAt: past ? { lte: now } : { gt: now } },
    orderBy: { startAt: past ? "desc" : "asc" },
    take: 100,
    select: adminBookingSelect,
  });
  res.json({ bookings });
}

// ሁሉም አገልግሎቶች እና ዘይቤዎቻቸው (ያልነቁትንም ጨምሮ)
export async function listAdminServices(_req: Request, res: Response) {
  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    include: { variants: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  res.json({ services });
}

export async function listAdminProviders(_req: Request, res: Response) {
  const providers = await prisma.provider.findMany({
    orderBy: { user: { name: "asc" } },
    select: {
      id: true,
      bio: true,
      user: { select: { name: true, email: true } },
      services: { select: { service: { select: { id: true, name: true } } } },
      variants: { select: { variantId: true, priceOverride: true, durationOverride: true } },
    },
  });
  res.json({
    providers: providers.map((p) => ({
      id: p.id,
      name: p.user.name,
      email: p.user.email,
      bio: p.bio,
      services: p.services.map((s) => s.service),
      variants: p.variants,
    })),
  });
}

const createProviderSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  bio: z.string().trim().max(500).optional(),
});

export async function createProviderByEmail(req: Request, res: Response) {
  const parsed = createProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Please enter a valid email" });
    return;
  }
  const { email, bio } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { provider: true } });
  if (!user) {
    res.status(404).json({ message: "No user with that email. Ask them to sign up first." });
    return;
  }
  if (user.provider) {
    res.status(409).json({ message: "This user is already a specialist" });
    return;
  }
  if (user.role === "ADMIN") {
    res.status(409).json({ message: "Admins cannot be specialists. Use a customer account." });
    return;
  }

  const provider = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } });
    const created = await tx.provider.create({ data: { userId: user.id, bio } });
    // መነሻ የስራ ሰዓት ሰኞ-አርብ 08:00-17:00 (ባለሙያው በ dashboard ያስተካክላል)
    await tx.workingHour.createMany({
      data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        providerId: created.id,
        dayOfWeek,
        startTime: "08:00",
        endTime: "17:00",
      })),
    });
    return created;
  });

  res.status(201).json({ provider: { id: provider.id } });
}
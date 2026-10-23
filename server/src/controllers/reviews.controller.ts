import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

const round1 = (n: number | null) => (n === null ? 0 : Math.round(n * 10) / 10);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Customer";

// POST /api/bookings/:id/review  (ደንበኛ፣ ለተጠናቀቀ የራሱ ቦታ ማስያዣ፣ አንዴ ብቻ)
export async function createReview(req: AuthRequest, res: Response) {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, customerId: true, providerId: true, status: true, review: { select: { id: true } } },
  });
  if (!booking || booking.customerId !== req.user!.id) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  if (booking.status !== "COMPLETED") {
    res.status(400).json({ message: "You can review a booking once it is completed" });
    return;
  }
  if (booking.review) {
    res.status(409).json({ message: "You already reviewed this booking" });
    return;
  }

  try {
    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    res.status(201).json({ review });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      res.status(409).json({ message: "You already reviewed this booking" });
      return;
    }
    throw err;
  }
}

// GET /api/providers/:id/reviews  (የሕዝብ፣ የተደበቁ አይካተቱም)
export async function listProviderReviews(req: Request, res: Response) {
  const providerId = String(req.params.id);
  const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!provider) {
    res.status(404).json({ message: "Specialist not found" });
    return;
  }

  const where = { providerId, isHidden: false };
  const [agg, rows] = await Promise.all([
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, rating: true, comment: true, createdAt: true, customer: { select: { name: true } } },
    }),
  ]);

  res.json({
    summary: { average: round1(agg._avg.rating), count: agg._count._all },
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      author: firstName(r.customer.name),
    })),
  });
}

// GET /api/reviews/summary  (የሕዝብ፣ ለካርዶች፡ ለእያንዳንዱ specialist አማካይ እና ቁጥር)
export async function ratingsSummary(_req: Request, res: Response) {
  const groups = await prisma.review.groupBy({
    by: ["providerId"],
    where: { isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  res.json({
    ratings: groups.map((g) => ({
      providerId: g.providerId,
      average: round1(g._avg.rating),
      count: g._count._all,
    })),
  });
}

// GET /api/reviews/mine  (የገባ ደንበኛ፣ የትኞቹን ማስያዣዎች እንደገመገመ)
export async function myReviewedBookings(req: AuthRequest, res: Response) {
  const rows = await prisma.review.findMany({
    where: { customerId: req.user!.id },
    select: { bookingId: true },
  });
  res.json({ bookingIds: rows.map((r) => r.bookingId) });
}

// GET /api/admin/reviews
export async function listAdminReviews(_req: Request, res: Response) {
  const rows = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      rating: true,
      comment: true,
      isHidden: true,
      createdAt: true,
      customer: { select: { name: true, email: true } },
      provider: { select: { user: { select: { name: true } } } },
    },
  });
  res.json({ reviews: rows });
}

// PATCH /api/admin/reviews/:id  { isHidden }
export async function setReviewHidden(req: Request, res: Response) {
  const parsed = z.object({ isHidden: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "isHidden must be true or false" });
    return;
  }
  const id = String(req.params.id);
  const exists = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ message: "Review not found" });
    return;
  }
  const review = await prisma.review.update({
    where: { id },
    data: { isHidden: parsed.data.isHidden },
    select: { id: true, isHidden: true },
  });
  res.json({ review });
}
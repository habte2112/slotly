import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { bookManual, manualSchema } from "./provider-dashboard.controller";

const adminBookingSchema = manualSchema.extend({ providerId: z.string().min(1) });

// admin (ወይም ሪሴፕሽን) ለማንኛውም ባለሙያ ለስልክ/walk-in ደንበኛ ቀጠሮ ይመዘግባል
export async function createAdminBooking(req: AuthRequest, res: Response) {
  const parsed = adminBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { providerId, ...data } = parsed.data;

  const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!provider) {
    res.status(404).json({ message: "Provider profile not found" });
    return;
  }
  await bookManual(provider.id, data, res);
}
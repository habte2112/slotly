import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { processReminders } from "../services/email.service";

export const internalRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const querySchema = z.object({
  minAgeMinutes: z.coerce.number().int().min(0).max(1440).default(120),
});

internalRouter.post("/send-reminders", async (req, res) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.CRON_SECRET || !safeEqual(token, env.CRON_SECRET)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const query = querySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ message: "Invalid minAgeMinutes" });
    return;
  }

  res.json(await processReminders(query.data.minAgeMinutes));
});
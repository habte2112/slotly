import { Request, Response } from "express";
import { z } from "zod";
import { isValidDateString, TIMEZONE } from "../services/availability";
import { loadAvailability } from "../services/availability.service";

const querySchema = z.object({
  date: z.string().refine(isValidDateString, "date must be a valid YYYY-MM-DD"),
  serviceId: z.string().min(1),
  variantId: z.string().min(1).optional(),
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
  const { date, serviceId, variantId } = parsed.data;

  const result = await loadAvailability(String(req.params.id), serviceId, date, variantId);
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.json({
    date,
    timezone: TIMEZONE,
    durationMinutes: result.offering.durationMinutes,
    price: result.offering.price,
    variant: result.offering.variant,
    slots: result.slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
    })),
  });
}
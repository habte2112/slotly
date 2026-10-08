import { Request, Response } from "express";
import { z } from "zod";
import { isValidDateString, TIMEZONE } from "../services/availability";
import { loadAvailability } from "../services/availability.service";

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

  const result = await loadAvailability(String(req.params.id), serviceId, date);
  if (!result) {
    res.status(404).json({ message: "Provider does not offer this service" });
    return;
  }

  res.json({
    date,
    timezone: TIMEZONE,
    durationMinutes: result.service.durationMinutes,
    slots: result.slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
    })),
  });
}
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  price: z.number().int().min(0),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

function issues(error: z.ZodError) {
  return error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function listServices(_req: Request, res: Response) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json({ services });
}

export async function createService(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: issues(parsed.error) });
    return;
  }
  const service = await prisma.service.create({ data: parsed.data });
  res.status(201).json({ service });
}

export async function updateService(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: issues(parsed.error) });
    return;
  }
  const id = String(req.params.id);
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Service not found" });
    return;
  }
  const service = await prisma.service.update({ where: { id }, data: parsed.data });
  res.json({ service });
}
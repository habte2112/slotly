import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const providerSelect = {
  id: true,
  bio: true,
  photoUrl: true,
  user: { select: { name: true } },
  services: {
    select: { service: { select: { id: true, name: true, durationMinutes: true, price: true } } },
  },
} as const;

function format(p: {
  id: string;
  bio: string | null;
  photoUrl: string | null;
  user: { name: string };
  services: { service: { id: string; name: string; durationMinutes: number; price: number } }[];
}) {
  return {
    id: p.id,
    name: p.user.name,
    bio: p.bio,
    photoUrl: p.photoUrl,
    services: p.services.map((s) => s.service),
  };
}

export async function listProviders(req: Request, res: Response) {
  const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
  const providers = await prisma.provider.findMany({
    where: serviceId ? { services: { some: { serviceId } } } : undefined,
    select: providerSelect,
  });
  res.json({ providers: providers.map(format) });
}

export async function getProvider(req: Request, res: Response) {
  const provider = await prisma.provider.findUnique({
    where: { id: String(req.params.id) },
    select: providerSelect,
  });
  if (!provider) {
    res.status(404).json({ message: "Provider not found" });
    return;
  }
  res.json({ provider: format(provider) });
}

const createSchema = z.object({
  userId: z.string().min(1),
  bio: z.string().trim().max(500).optional(),
});

export async function createProvider(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const { userId, bio } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { provider: true } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (user.provider) {
    res.status(409).json({ message: "User is already a provider" });
    return;
  }

  const provider = await prisma.$transaction(async (tx) => {
    if (user.role === "CUSTOMER") {
      await tx.user.update({ where: { id: userId }, data: { role: "PROVIDER" } });
    }
    return tx.provider.create({ data: { userId, bio }, select: providerSelect });
  });
  res.status(201).json({ provider: format(provider) });
}

const servicesSchema = z.object({ serviceIds: z.array(z.string().min(1)) });

export async function setProviderServices(req: Request, res: Response) {
  const parsed = servicesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const providerId = String(req.params.id);
  const serviceIds = [...new Set(parsed.data.serviceIds)];

  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) {
    res.status(404).json({ message: "Provider not found" });
    return;
  }
  const found = await prisma.service.count({ where: { id: { in: serviceIds } } });
  if (found !== serviceIds.length) {
    res.status(400).json({ message: "One or more services do not exist" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.providerService.deleteMany({ where: { providerId } });
    await tx.providerService.createMany({ data: serviceIds.map((serviceId) => ({ providerId, serviceId })) });
    return tx.provider.findUniqueOrThrow({ where: { id: providerId }, select: providerSelect });
  });
  res.json({ provider: format(updated) });
}
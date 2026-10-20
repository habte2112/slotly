import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const durationSchema = z.number().int().min(5).max(480);
const priceSchema = z.number().int().min(0).max(1_000_000);

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  durationMinutes: durationSchema,
  price: priceSchema,
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

const providerVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        variantId: z.string().min(1),
        priceOverride: priceSchema.nullable().optional(),
        durationOverride: durationSchema.nullable().optional(),
      }),
    )
    .max(200),
});

const issues = (error: z.ZodError) => error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));

function isUniqueError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code ?? "";
  return /P2002|unique constraint/i.test(`${code} ${error.message}`);
}

export async function createVariant(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: issues(parsed.error) });
    return;
  }
  const serviceId = String(req.params.serviceId);
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
  if (!service) {
    res.status(404).json({ message: "Service not found" });
    return;
  }
  const duplicate = await prisma.serviceVariant.findUnique({
    where: { serviceId_name: { serviceId, name: parsed.data.name } },
    select: { id: true },
  });
  if (duplicate) {
    res.status(409).json({ message: "This service already has a style with that name" });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.serviceVariant.aggregate({ where: { serviceId }, _max: { sortOrder: true } });
      const variant = await tx.serviceVariant.create({
        data: { serviceId, ...parsed.data, sortOrder: parsed.data.sortOrder ?? (last._max.sortOrder ?? -1) + 1 },
      });
      // አገልግሎቱን ለሚሰጡ ባለሙያዎች ሁሉ በራሱ ይመደባል (admin ከዚያ ያስተካክላል)
      const offering = await tx.providerService.findMany({ where: { serviceId }, select: { providerId: true } });
      if (offering.length > 0) {
        await tx.providerVariant.createMany({
          data: offering.map((o) => ({ providerId: o.providerId, variantId: variant.id })),
        });
      }
      return { variant, assignedTo: offering.length };
    });
    res.status(201).json(result);
  } catch (error) {
    if (isUniqueError(error)) {
      res.status(409).json({ message: "This service already has a style with that name" });
      return;
    }
    throw error;
  }
}

export async function updateVariant(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: issues(parsed.error) });
    return;
  }
  const id = String(req.params.id);
  const existing = await prisma.serviceVariant.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Style not found" });
    return;
  }
  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.serviceVariant.findUnique({
      where: { serviceId_name: { serviceId: existing.serviceId, name: parsed.data.name } },
      select: { id: true },
    });
    if (duplicate) {
      res.status(409).json({ message: "This service already has a style with that name" });
      return;
    }
  }

  try {
    const variant = await prisma.serviceVariant.update({ where: { id }, data: parsed.data });
    res.json({ variant });
  } catch (error) {
    if (isUniqueError(error)) {
      res.status(409).json({ message: "This service already has a style with that name" });
      return;
    }
    throw error;
  }
}

// የባለሙያውን ዘይቤዎች እና ልዩ ዋጋ/ጊዜ ሙሉ በሙሉ ይተካል
export async function setProviderVariants(req: Request, res: Response) {
  const parsed = providerVariantsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: issues(parsed.error) });
    return;
  }
  const providerId = String(req.params.id);
  const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!provider) {
    res.status(404).json({ message: "Provider not found" });
    return;
  }

  const ids = parsed.data.variants.map((v) => v.variantId);
  if (new Set(ids).size !== ids.length) {
    res.status(400).json({ message: "The same style was listed more than once" });
    return;
  }
  if (ids.length > 0) {
    const variants = await prisma.serviceVariant.findMany({
      where: { id: { in: ids } },
      select: { id: true, serviceId: true },
    });
    if (variants.length !== ids.length) {
      res.status(400).json({ message: "One or more styles do not exist" });
      return;
    }
    const offered = await prisma.providerService.findMany({ where: { providerId }, select: { serviceId: true } });
    const offeredIds = new Set(offered.map((o) => o.serviceId));
    if (variants.some((v) => !offeredIds.has(v.serviceId))) {
      res.status(400).json({ message: "The specialist does not offer the service of one or more of these styles" });
      return;
    }
  }

  const data = parsed.data.variants.map((v) => ({
    providerId,
    variantId: v.variantId,
    priceOverride: v.priceOverride ?? null,
    durationOverride: v.durationOverride ?? null,
  }));
  await prisma.$transaction(async (tx) => {
    await tx.providerVariant.deleteMany({ where: { providerId } });
    if (data.length > 0) await tx.providerVariant.createMany({ data });
  });

  const variants = await prisma.providerVariant.findMany({
    where: { providerId },
    select: { variantId: true, priceOverride: true, durationOverride: true },
  });
  res.json({ variants });
}
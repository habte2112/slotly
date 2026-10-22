import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { cloudinaryEnabled, createUploadSignature, isOurImageUrl } from "../services/cloudinary";

export function getUploadSignature(_req: Request, res: Response) {
  if (!cloudinaryEnabled()) {
    return res.status(503).json({ message: "Image upload is not configured" });
  }
  res.json(createUploadSignature());
}

const bodySchema = z.object({ imageUrl: z.string().url().nullable() });

export async function setVariantImage(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

  const { imageUrl } = parsed.data;
  if (imageUrl && !isOurImageUrl(imageUrl)) {
    return res.status(400).json({ message: "Image must be uploaded to our storage" });
  }

  const id = String(req.params.id); // Int ከሆነ: const id = Number(req.params.id);
  // Int ከሆነ ይህን አክል: if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });

  const exists = await prisma.serviceVariant.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ message: "Style not found" });

  const updated = await prisma.serviceVariant.update({ where: { id }, data: { imageUrl } });
  res.json({ id: updated.id, imageUrl: updated.imageUrl });
}
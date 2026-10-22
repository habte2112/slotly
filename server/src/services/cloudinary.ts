import { signParams } from "./cloudinary-sign";
import { env } from "../config/env";

const FOLDER = "slotly/styles";
const ALLOWED = "jpg,jpeg,png,webp";

export const cloudinaryEnabled = () =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

export function createUploadSignature(now = Math.floor(Date.now() / 1000)) {
  const params = { allowed_formats: ALLOWED, folder: FOLDER, timestamp: now };
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp: now,
    folder: FOLDER,
    allowedFormats: ALLOWED,
    signature: signParams(params, env.CLOUDINARY_API_SECRET!),
  };
}

// ምስሉ ከኛ Cloudinary account እንጂ ከሌላ ቦታ እንዳይሆን
export function isOurImageUrl(url: string) {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}
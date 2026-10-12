import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(4000),
  // አማራጭ፦ ከተለየ ድረ-ገጽ ቀጥታ ጥያቄ እንዲፈቀድ (በኮማ የተለዩ origins)
  CORS_ORIGIN: z.string().optional(),
  // ኢሜይል፦ ቁልፍ ከሌለ ኢሜይሎች ይዘለላሉ (server አሁንም ይሰራል)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Slotly <onboarding@resend.dev>"),
  APP_URL: z.string().url().default("https://slotly-rosy.vercel.app"),
  // ማሳሰቢያ endpoint ን የሚጠብቅ ሚስጥር (ከሌለ endpoint ተዘግቷል)
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters").optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
import { rateLimit } from "express-rate-limit";

const common = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
};

// ለሁሉም /api ጥያቄዎች ሰፊ ገደብ
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  message: { message: "Too many requests, please try again later" },
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: { message: "Too many sign-ups, please try again later" },
});

// ለእያንዳንዱ email ያልተሳካ login 10 ጊዜ ብቻ በ 15 ደቂቃ (brute-force መከላከያ)
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  message: { message: "Too many failed login attempts, please try again in 15 minutes" },
});

// ለእያንዳንዱ email በሰዓት 5 ጥያቄ (ኢሜይል መኖሩን አይገልጽም፤ ገደቡ ለሁሉም አንድ ነው)
export const forgotPasswordLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `forgot:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  message: { message: "Too many reset requests, please try again later" },
});
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createHash, randomBytes } from "node:crypto";
import { sendPasswordResetEmail } from "../services/email.service";

// ተጠቃሚው ባይኖርም bcrypt ንጽጽር እንዲሰራ፣ ስለዚህ የምላሽ ጊዜ email መኖሩን አያሳይም
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20).optional(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function signToken(user: { id: string; role: string }) {
  return jwt.sign({ role: user.role }, process.env.JWT_SECRET!, {
    subject: user.id,
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: formatIssues(parsed.error) });
    return;
  }
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // ህዝባዊ ምዝገባ ሁልጊዜ CUSTOMER ብቻ ነው የሚፈጥረው (ደህንነት)
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: "CUSTOMER" },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  res.status(201).json({ user, token: signToken(user) });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: formatIssues(parsed.error) });
    return;
  }
  const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
    // ኢሜይሉ ስህተት ይሁን ፓስዎርዱ ተመሳሳይ መልስ (መረጃ እንዳይሰጥ)
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    token: signToken(user),
  });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json({ user });
}

// ---- Password reset ----
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const FORGOT_RESPONSE = { message: "If an account exists for that email, a reset link has been sent." };

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid token"),
  password: z.string().min(8).max(100),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueResetToken(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    // ቀድሞ የተላኩ ያልተጠቀሙ links ይሻራሉ
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);
  await sendPasswordResetEmail(user.email, user.name, token);
}

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Please enter a valid email" });
    return;
  }
  // መልሱ ወዲያው ይሄዳል፤ ስራው ከዚያ በኋላ ስለሆነ ኢሜይል መኖሩ በምላሽ ጊዜ አይታወቅም
  res.json(FORGOT_RESPONSE);
  void issueResetToken(parsed.data.email).catch((err) => console.error("[password-reset]", err));
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: formatIssues(parsed.error) });
    return;
  }
  const { token, password } = parsed.data;
  const INVALID = { message: "This reset link is invalid or has expired" };

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    res.status(400).json(INVALID);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const ok = await prisma.$transaction(async (tx) => {
    // አንድ ጊዜ ብቻ፦ ሁለት ጥያቄዎች በአንድ ጊዜ ቢመጡ አንዱ ብቻ ያልፋል
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) return false;
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    return true;
  });

  if (!ok) {
    res.status(400).json(INVALID);
    return;
  }
  res.json({ message: "Password updated. You can now log in." });
}
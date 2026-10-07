import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

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
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) {
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
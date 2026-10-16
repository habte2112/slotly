import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { handleUpdate } from "../services/bot.service";
import { createLinkUrl, telegramEnabled } from "../services/telegram.service";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ከ Telegram የሚመጣ webhook፤ በሚስጥር ራስጌ ይጠበቃል
export const telegramWebhookRouter = Router();

telegramWebhookRouter.post("/", (req, res) => {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!telegramEnabled || !secret) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  const header = req.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(header, secret)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  // Telegram ፈጣን 200 ይጠብቃል፤ ሥራው ከምላሽ በኋላ ይቀጥላል
  res.json({ ok: true });
  void handleUpdate(req.body).catch((err) =>
    console.error("[telegram] update failed:", err instanceof Error ? err.message : "unknown"),
  );
});

// ለገቡ ተጠቃሚዎች
export const telegramRouter = Router();

telegramRouter.get("/status", authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { telegramChatId: true },
  });
  res.json({
    enabled: telegramEnabled,
    linked: Boolean(user?.telegramChatId),
    botUsername: telegramEnabled ? (env.TELEGRAM_BOT_USERNAME ?? null) : null,
  });
});

telegramRouter.post("/link", authenticate, async (req: AuthRequest, res) => {
  if (!telegramEnabled) {
    res.status(503).json({ message: "Telegram is not configured" });
    return;
  }
  res.json({ url: await createLinkUrl(req.user!.id) });
});

telegramRouter.delete("/link", authenticate, async (req: AuthRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { telegramChatId: null } });
  await prisma.telegramLinkToken.deleteMany({ where: { userId: req.user!.id } });
  res.json({ success: true });
});
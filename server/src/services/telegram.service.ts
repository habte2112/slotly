import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { googleCalendarUrl } from "./calendar";
import type { BookingEmailKind } from "./email.service";

export const telegramEnabled = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME);

const LINK_TTL_MS = 15 * 60 * 1000;

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Addis_Ababa",
  dateStyle: "full",
  timeStyle: "short",
});

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

interface TelegramResponse {
  ok: boolean;
  error_code?: number;
  description?: string;
}

// token ወደ logs አይታተምም
export async function callTelegram(method: string, payload: Record<string, unknown>): Promise<TelegramResponse> {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, description: "bot is not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as TelegramResponse;
  } catch (err) {
    console.error(`[telegram] ${method} request failed (${err instanceof Error ? err.name : "unknown"})`);
    return { ok: false, description: "network error" };
  }
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: object,
): Promise<boolean> {
  const result = await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  if (result.ok) return true;

  console.error(`[telegram] sendMessage failed: ${result.description ?? "unknown error"}`);
  if (result.error_code === 403) {
    // ተጠቃሚው bot ን አግዶታል ወይም ውይይቱን አጥፍቷል፤ ግንኙነቱ ይቋረጣል
    await prisma.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
  }
  return false;
}

// አንድ ጊዜ የሚሰራ link፤ ዳታቤዝ ውስጥ የሚቀመጠው hash ብቻ ነው
export async function createLinkUrl(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url"); // 32 ፊደል፣ A-Z a-z 0-9 _ -
  await prisma.$transaction([
    prisma.telegramLinkToken.deleteMany({ where: { userId } }),
    prisma.telegramLinkToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LINK_TTL_MS) },
    }),
  ]);
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}

const HEADINGS: Record<BookingEmailKind, string> = {
  confirmed: "✅ <b>Booking confirmed</b>",
  rescheduled: "🔄 <b>Booking rescheduled</b>",
  cancelled_by_customer: "❌ <b>Booking cancelled</b>",
  cancelled_by_provider: "❌ <b>Booking cancelled by the provider</b>",
  reminder: "⏰ <b>Reminder: your appointment is coming up</b>",
};

// ፈጽሞ አይወረውርም፤ ስኬትን በ boolean ይመልሳል
export async function sendBookingTelegram(kind: BookingEmailKind, bookingId: string): Promise<boolean> {
  try {
    if (!telegramEnabled) return false;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        priceAtBooking: true,
        customer: { select: { telegramChatId: true } },
        provider: { select: { user: { select: { name: true } } } },
        service: { select: { name: true, price: true } },
      },
    });
    const chatId = booking?.customer.telegramChatId;
    if (!booking || !chatId) return false;

    const title = `${booking.service.name} with ${booking.provider.user.name}`;
    const price = booking.priceAtBooking ?? booking.service.price;
    const text =
      `${HEADINGS[kind]}\n\n<b>${escapeHtml(title)}</b>\n` +
      `📅 ${escapeHtml(whenFormat.format(booking.startAt))}\n💰 ${price} ETB`;

    const buttons: object[] = [];
    if (kind === "confirmed" || kind === "rescheduled" || kind === "reminder") {
      buttons.push({
        text: "Add to Google Calendar",
        url: googleCalendarUrl({
          id: booking.id,
          startAt: booking.startAt,
          endAt: booking.endAt,
          title,
          description: "Booked on Slotly",
        }),
      });
    }
    // Telegram የ localhost link ያላቸውን አዝራሮች ይከለክላል
    if (env.APP_URL.startsWith("https://")) {
      buttons.push({ text: "My bookings", url: `${env.APP_URL}/my-bookings` });
    }

    return await sendTelegramMessage(chatId, text, buttons.length > 0 ? { inline_keyboard: [buttons] } : undefined);
  } catch (err) {
    console.error(
      `[telegram] ${kind} notification crashed for booking ${bookingId}:`,
      err instanceof Error ? err.message : "unknown",
    );
    return false;
  }
}
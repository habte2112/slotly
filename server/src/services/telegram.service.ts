import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { googleCalendarUrl } from "./calendar";
import type { BookingEmailKind } from "./email.service";
import { serviceLabel } from "./labels";

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
        variant: { select: { name: true } },
      },
    });
    const chatId = booking?.customer.telegramChatId;
    if (!booking || !chatId) return false;

    const title = `${serviceLabel(booking.service.name, booking.variant?.name)} with ${booking.provider.user.name}`;
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

const PROVIDER_HEADINGS: Partial<Record<BookingEmailKind, string>> = {
  confirmed: "🆕 <b>New booking</b>",
  rescheduled: "🔄 <b>Booking moved</b>",
  cancelled_by_customer: "❌ <b>The customer cancelled</b>",
};

// ለባለሙያው፦ አዲስ ቀጠሮ፣ ማዛወር ወይም በደንበኛ መሰረዝ። ፈጽሞ አይወረውርም
export async function sendProviderTelegram(kind: BookingEmailKind, bookingId: string): Promise<boolean> {
  try {
    const heading = PROVIDER_HEADINGS[kind];
    if (!telegramEnabled || !heading) return false;

    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        startAt: true,
        customer: { select: { name: true, phone: true, telegramChatId: true } },
        provider: { select: { user: { select: { telegramChatId: true } } } },
        service: { select: { name: true } },
        variant: { select: { name: true } },
      },
    });
    const chatId = b?.provider.user.telegramChatId;
    // ባለሙያው ለራሱ ሲይዝ ሁለት ጊዜ አይነገረውም
    if (!b || !chatId || chatId === b.customer.telegramChatId) return false;

    const text =
      `${heading}\n\n<b>${escapeHtml(serviceLabel(b.service.name, b.variant?.name))}</b>\n` +
      `👤 ${escapeHtml(b.customer.name)}${b.customer.phone ? ` · ${escapeHtml(b.customer.phone)}` : ""}\n` +
      `📅 ${escapeHtml(whenFormat.format(b.startAt))}`;
    return await sendTelegramMessage(chatId, text);
  } catch (err) {
    console.error(
      `[telegram] provider ${kind} notification crashed for booking ${bookingId}:`,
      err instanceof Error ? err.message : "unknown",
    );
    return false;
  }
}

// ቀጠሮው ካለቀ ከ 15 ደቂቃ በኋላ "ደንበኛው መጣ?" ብሎ ባለሙያውን ይጠይቃል (አንድ ጊዜ ብቻ)
export async function processOutcomePrompts(now = new Date()) {
  if (!telegramEnabled) return { prompted: 0 };

  const due = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      outcomePromptSentAt: null,
      // ከ 24 ሰዓት በኋላ ቀጠሮው በራስ "completed" ይሆናል፣ ስለዚህ ያኔ አይጠየቅም
      endAt: { lt: new Date(now.getTime() - 15 * 60 * 1000), gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      provider: { user: { telegramChatId: { not: null } } },
    },
    orderBy: { endAt: "asc" },
    take: 30,
    select: {
      id: true,
      startAt: true,
      provider: { select: { user: { select: { telegramChatId: true } } } },
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      variant: { select: { name: true } },
    },
  });

  let prompted = 0;
  for (const b of due) {
    const chatId = b.provider.user.telegramChatId;
    if (!chatId) continue;
    // ከመላኩ በፊት "ይያዛል"፣ ስለዚህ ሁለት ጊዜ ቢሮጥ አንድ መልእክት ብቻ ይሄዳል
    const claim = await prisma.booking.updateMany({
      where: { id: b.id, outcomePromptSentAt: null },
      data: { outcomePromptSentAt: now },
    });
    if (claim.count === 0) continue;

    const text =
      `🕑 <b>Did the customer come?</b>\n\n<b>${escapeHtml(serviceLabel(b.service.name, b.variant?.name))}</b>\n` +
      `👤 ${escapeHtml(b.customer.name)}${b.customer.phone ? ` · ${escapeHtml(b.customer.phone)}` : ""}\n` +
      `📅 ${escapeHtml(whenFormat.format(b.startAt))}`;
    const ok = await sendTelegramMessage(chatId, text, {
      inline_keyboard: [
        [
          { text: "✅ Came", callback_data: `d:${b.id}` },
          { text: "❌ No-show", callback_data: `x:${b.id}` },
        ],
      ],
    });
    if (ok) prompted++;
  }
  return { prompted };
}
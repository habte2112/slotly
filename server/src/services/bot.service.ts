import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notifyBooking } from "./email.service";
import { callTelegram, escapeHtml, hashToken, sendTelegramMessage } from "./telegram.service";
import { serviceLabel } from "./labels";

const TZ = "Africa/Addis_Ababa";
const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const shortFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const chatSchema = z.object({ id: z.number(), type: z.string() });
const updateSchema = z.object({
  update_id: z.number(),
  message: z.object({ chat: chatSchema, text: z.string().optional() }).optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      message: z.object({ chat: chatSchema }).optional(),
    })
    .optional(),
});
type Update = z.infer<typeof updateSchema>;

const WELCOME =
  "👋 Hi! I am the Slotly booking bot.\n\nTo connect this chat to your account, open Slotly → My bookings → Connect Telegram, then tap the link there.";
const HELP =
  "<b>Slotly bot</b>\n\n/bookings - your upcoming appointments\n/cancel - cancel an appointment\n/unlink - stop notifications in this chat\n/help - show this message";
const NOT_LINKED =
  "This chat is not connected to a Slotly account yet.\n\nOpen Slotly → My bookings → Connect Telegram, then tap the link there.";
const INVALID_LINK =
  "That link is invalid or has expired. Open Slotly → My bookings → Connect Telegram to get a new one.";

const userForChat = (chatId: number) =>
  prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, select: { id: true, name: true } });

const upcomingFor = (customerId: string) =>
  prisma.booking.findMany({
    where: { customerId, status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
    take: 5,
    select: {
      id: true,
      startAt: true,
      service: { select: { name: true } },
      variant: { select: { name: true } },
      provider: { select: { user: { select: { name: true } } } },
    },
  });

// ሁሉም ዝመናዎች እዚህ ያልፋሉ፤ ያልተጠበቀ ቅርጽ በጸጥታ ይታለፋል
export async function handleUpdate(raw: unknown): Promise<void> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return;
  const { message, callback_query: callback } = parsed.data;

  if (message?.text) await handleMessage(message.chat, message.text);
  else if (callback) await handleCallback(callback);
}

async function handleMessage(chat: { id: number; type: string }, text: string): Promise<void> {
  if (chat.type !== "private") return; // ቡድኖች እና channels ይታለፋሉ
  const [first = "", ...args] = text.trim().split(/\s+/);
  const command = first.split("@")[0].toLowerCase();

  switch (command) {
    case "/start":
      if (args[0]) await linkChat(chat.id, args[0]);
      else await sendTelegramMessage(chat.id, WELCOME);
      return;
    case "/help":
      await sendTelegramMessage(chat.id, HELP);
      return;
    case "/bookings":
      await showBookings(chat.id);
      return;
    case "/cancel":
      await showCancelMenu(chat.id);
      return;
    case "/unlink":
      await unlinkChat(chat.id);
      return;
    default:
      await sendTelegramMessage(chat.id, "I did not understand that. Send /help to see what I can do.");
  }
}

async function linkChat(chatId: number, payload: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(payload)) {
    await sendTelegramMessage(chatId, INVALID_LINK);
    return;
  }
  const record = await prisma.telegramLinkToken.findUnique({
    where: { tokenHash: hashToken(payload) },
    include: { user: { select: { name: true } } },
  });
  if (!record || record.expiresAt <= new Date()) {
    await sendTelegramMessage(chatId, INVALID_LINK);
    return;
  }

  const linked = await prisma.$transaction(async (tx) => {
    // token መሰረዝ አንድ ጊዜ ብቻ ይሳካል፣ ስለዚህ link አንድ ጊዜ ብቻ ይሰራል
    const claim = await tx.telegramLinkToken.deleteMany({ where: { id: record.id } });
    if (claim.count === 0) return false;
    await tx.telegramLinkToken.deleteMany({ where: { userId: record.userId } });
    // አንድ ውይይት ከአንድ አካውንት ጋር ብቻ ይገናኛል
    await tx.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
    await tx.user.update({ where: { id: record.userId }, data: { telegramChatId: String(chatId) } });
    return true;
  });

  if (!linked) {
    await sendTelegramMessage(chatId, INVALID_LINK);
    return;
  }
  await sendTelegramMessage(
    chatId,
    `✅ <b>Connected</b>\n\nHi ${escapeHtml(record.user.name)}! You will now get your booking updates here.\n\nTry /bookings or send /help.`,
  );
}

async function unlinkChat(chatId: number): Promise<void> {
  const result = await prisma.user.updateMany({
    where: { telegramChatId: String(chatId) },
    data: { telegramChatId: null },
  });
  await sendTelegramMessage(
    chatId,
    result.count > 0 ? "Disconnected. You will no longer get notifications in this chat." : NOT_LINKED,
  );
}

async function showBookings(chatId: number): Promise<void> {
  const user = await userForChat(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, NOT_LINKED);
    return;
  }
  const bookings = await upcomingFor(user.id);
  if (bookings.length === 0) {
    await sendTelegramMessage(chatId, "You have no upcoming bookings.");
    return;
  }
    const lines = bookings.map(
    (b) =>
      `<b>${escapeHtml(serviceLabel(b.service.name, b.variant?.name))}</b> with ${escapeHtml(b.provider.user.name)}\n📅 ${escapeHtml(whenFormat.format(b.startAt))}`,
  );
  await sendTelegramMessage(chatId, `<b>Your upcoming bookings</b>\n\n${lines.join("\n\n")}\n\nSend /cancel to cancel one.`);
}

async function showCancelMenu(chatId: number): Promise<void> {
  const user = await userForChat(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, NOT_LINKED);
    return;
  }
  const bookings = await upcomingFor(user.id);
  if (bookings.length === 0) {
    await sendTelegramMessage(chatId, "You have no upcoming bookings to cancel.");
    return;
  }
  const keyboard = bookings.map((b) => [
    { text: `${serviceLabel(b.service.name, b.variant?.name)} · ${shortFormat.format(b.startAt)}`, callback_data: `c:${b.id}` },
  ]);
  await sendTelegramMessage(chatId, "Which booking do you want to cancel?", { inline_keyboard: keyboard });
}

// የዚህ ውይይት ባለቤት የሆነ ንቁ መጪ ቀጠሮ ብቻ
const bookingOfChat = (chatId: number, bookingId: string) =>
  prisma.booking.findFirst({
    where: {
      id: bookingId,
      customer: { telegramChatId: String(chatId) },
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gt: new Date() },
    },
    select: {
      id: true,
      startAt: true,
      service: { select: { name: true } },
      variant: { select: { name: true } },
    },
  });

async function handleCallback(callback: NonNullable<Update["callback_query"]>): Promise<void> {
  await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });

  const chat = callback.message?.chat;
  if (!chat || chat.type !== "private" || !callback.data) return;
  const match = /^([cyn]):([a-z0-9]{10,40})$/.exec(callback.data);
  if (!match) return;
  const [, action, bookingId] = match;

  if (action === "n") {
    await sendTelegramMessage(chat.id, "Okay, your booking is kept.");
    return;
  }

  const booking = await bookingOfChat(chat.id, bookingId);
  if (!booking) {
    await sendTelegramMessage(chat.id, "I could not find that booking, or it can no longer be cancelled.");
    return;
  }

  if (action === "c") {
    await sendTelegramMessage(
      chat.id,
      `Cancel <b>${escapeHtml(serviceLabel(booking.service.name, booking.variant?.name))}</b> on ${escapeHtml(whenFormat.format(booking.startAt))}?`,
      {
        inline_keyboard: [
          [
            { text: "Yes, cancel it", callback_data: `y:${booking.id}` },
            { text: "Keep it", callback_data: `n:${booking.id}` },
          ],
        ],
      },
    );
    return;
  }

  // action === "y"
  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  notifyBooking("cancelled_by_customer", booking.id); // ኢሜይል እና Telegram ማረጋገጫ ይልካል
}
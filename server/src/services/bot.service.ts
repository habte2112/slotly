import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notifyBooking } from "./email.service";
import { callTelegram, escapeHtml, hashToken, sendTelegramMessage } from "./telegram.service";
import { serviceLabel } from "./labels";
import { dayBoundsUtc } from "./availability";
import { asLocale, formatWhen, tg, type Locale } from "./telegram-messages";

const chatSchema = z.object({ id: z.number(), type: z.string() });
const updateSchema = z.object({
  update_id: z.number(),
  message: z.object({ chat: chatSchema, text: z.string().optional() }).optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      message: z.object({ chat: chatSchema, message_id: z.number().optional() }).optional(),
    })
    .optional(),
});
type Update = z.infer<typeof updateSchema>;

const userForChat = (chatId: number) =>
  prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, select: { id: true, name: true } });

// ያልተገናኘ ውይይት እንግሊዝኛ ያገኛል
async function localeForChat(chatId: number): Promise<Locale> {
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, select: { locale: true } });
  return asLocale(user?.locale);
}

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
  const locale = await localeForChat(chat.id);

  switch (command) {
    case "/start":
      if (args[0]) await linkChat(chat.id, args[0], locale);
      else await sendTelegramMessage(chat.id, tg(locale, "bot.welcome"));
      return;
    case "/help":
      await sendTelegramMessage(chat.id, tg(locale, "bot.help"));
      return;
    case "/bookings":
      await showBookings(chat.id, locale);
      return;
    case "/today":
      await showToday(chat.id, locale);
      return;
    case "/cancel":
      await showCancelMenu(chat.id, locale);
      return;
    case "/unlink":
      await unlinkChat(chat.id, locale);
      return;
    default:
      await sendTelegramMessage(chat.id, tg(locale, "bot.unknown"));
  }
}

async function linkChat(chatId: number, payload: string, fallback: Locale): Promise<void> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(payload)) {
    await sendTelegramMessage(chatId, tg(fallback, "bot.invalidLink"));
    return;
  }
  const record = await prisma.telegramLinkToken.findUnique({
    where: { tokenHash: hashToken(payload) },
    include: { user: { select: { name: true, locale: true } } },
  });
  if (!record || record.expiresAt <= new Date()) {
    await sendTelegramMessage(chatId, tg(fallback, "bot.invalidLink"));
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
    await sendTelegramMessage(chatId, tg(fallback, "bot.invalidLink"));
    return;
  }
  await sendTelegramMessage(
    chatId,
    tg(asLocale(record.user.locale), "bot.connected", { name: escapeHtml(record.user.name) }),
  );
}

async function unlinkChat(chatId: number, locale: Locale): Promise<void> {
  const result = await prisma.user.updateMany({
    where: { telegramChatId: String(chatId) },
    data: { telegramChatId: null },
  });
  await sendTelegramMessage(chatId, tg(locale, result.count > 0 ? "bot.disconnected" : "bot.notLinked"));
}

async function showBookings(chatId: number, locale: Locale): Promise<void> {
  const user = await userForChat(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, tg(locale, "bot.notLinked"));
    return;
  }
  const bookings = await upcomingFor(user.id);
  if (bookings.length === 0) {
    await sendTelegramMessage(chatId, tg(locale, "bot.noUpcoming"));
    return;
  }
  const lines = bookings.map((b) =>
    tg(locale, "bot.bookingLine", {
      service: escapeHtml(serviceLabel(b.service.name, b.variant?.name)),
      provider: escapeHtml(b.provider.user.name),
      when: escapeHtml(formatWhen(locale, "long", b.startAt)),
    }),
  );
  await sendTelegramMessage(chatId, tg(locale, "bot.upcomingList", { lines: lines.join("\n\n") }));
}

async function showCancelMenu(chatId: number, locale: Locale): Promise<void> {
  const user = await userForChat(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, tg(locale, "bot.notLinked"));
    return;
  }
  const bookings = await upcomingFor(user.id);
  if (bookings.length === 0) {
    await sendTelegramMessage(chatId, tg(locale, "bot.noneToCancel"));
    return;
  }
  const keyboard = bookings.map((b) => [
    {
      text: `${serviceLabel(b.service.name, b.variant?.name)} · ${formatWhen(locale, "short", b.startAt)}`,
      callback_data: `c:${b.id}`,
    },
  ]);
  await sendTelegramMessage(chatId, tg(locale, "bot.cancelWhich"), { inline_keyboard: keyboard });
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
  const match = /^([cynxd]):([a-z0-9]{10,40})$/.exec(callback.data);
  if (!match) return;
  const [, action, bookingId] = match;
  const locale = await localeForChat(chat.id);

  if (action === "d" || action === "x") {
    await recordOutcome(chat.id, callback.message?.message_id, action, bookingId, locale);
    return;
  }

  if (action === "n") {
    await sendTelegramMessage(chat.id, tg(locale, "bot.kept"));
    return;
  }

  const booking = await bookingOfChat(chat.id, bookingId);
  if (!booking) {
    await sendTelegramMessage(chat.id, tg(locale, "bot.cancelUnavailable"));
    return;
  }

  if (action === "c") {
    await sendTelegramMessage(
      chat.id,
      tg(locale, "bot.cancelConfirm", {
        service: escapeHtml(serviceLabel(booking.service.name, booking.variant?.name)),
        when: escapeHtml(formatWhen(locale, "long", booking.startAt)),
      }),
      {
        inline_keyboard: [
          [
            { text: tg(locale, "btn.yesCancel"), callback_data: `y:${booking.id}` },
            { text: tg(locale, "btn.keep"), callback_data: `n:${booking.id}` },
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

async function showToday(chatId: number, locale: Locale): Promise<void> {
  const user = await userForChat(chatId);
  if (!user) {
    await sendTelegramMessage(chatId, tg(locale, "bot.notLinked"));
    return;
  }
  const provider = await prisma.provider.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!provider) {
    await sendTelegramMessage(chatId, tg(locale, "bot.specialistsOnly"));
    return;
  }

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { start, end } = dayBoundsUtc(today);
  const rows = await prisma.booking.findMany({
    where: { providerId: provider.id, status: { not: "CANCELLED" }, startAt: { gte: start, lt: end } },
    orderBy: { startAt: "asc" },
    take: 30,
    select: {
      startAt: true,
      status: true,
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      variant: { select: { name: true } },
    },
  });
  if (rows.length === 0) {
    await sendTelegramMessage(chatId, tg(locale, "bot.noToday"));
    return;
  }
  const icon = { COMPLETED: "✅", NO_SHOW: "❌" } as Record<string, string>;
  const lines = rows.map(
    (b) =>
      `${icon[b.status] ?? "⏳"} <b>${formatWhen(locale, "time", b.startAt)}</b> ${escapeHtml(serviceLabel(b.service.name, b.variant?.name))}\n` +
      `    👤 ${escapeHtml(b.customer.name)}${b.customer.phone ? ` · ${escapeHtml(b.customer.phone)}` : ""}`,
  );
  await sendTelegramMessage(chatId, tg(locale, "bot.today", { lines: lines.join("\n") }));
}

// ባለሙያው "መጣ" ወይም "አልመጣም" ሲል ቀጠሮውን ይመዘግባል
async function recordOutcome(
  chatId: number,
  messageId: number | undefined,
  action: "d" | "x",
  bookingId: string,
  locale: Locale,
): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, provider: { user: { telegramChatId: String(chatId) } } },
    select: { id: true, status: true, startAt: true, customerId: true, customer: { select: { name: true } } },
  });
  if (!booking) {
    await sendTelegramMessage(chatId, tg(locale, "bot.notFound"));
    return;
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    await sendTelegramMessage(chatId, tg(locale, "bot.alreadyAs", { status: tg(locale, `status.${booking.status}`) }));
    return;
  }
  if (booking.startAt > new Date()) {
    await sendTelegramMessage(chatId, tg(locale, "bot.notStarted"));
    return;
  }

  const status = action === "d" ? "COMPLETED" : "NO_SHOW";
  // ሁለት ጊዜ ቢጫን አንድ ጊዜ ብቻ ይሳካል
  const claim = await prisma.booking.updateMany({
    where: { id: booking.id, status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status },
  });
  if (claim.count === 0) {
    await sendTelegramMessage(chatId, tg(locale, "bot.already"));
    return;
  }
  if (messageId) {
    await callTelegram("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }

  if (status === "COMPLETED") {
    await sendTelegramMessage(chatId, tg(locale, "bot.markedCompleted"));
    return;
  }
  const count = await prisma.booking.count({ where: { customerId: booking.customerId, status: "NO_SHOW" } });
  await sendTelegramMessage(
    chatId,
    tg(locale, count > 1 ? "bot.markedNoShowMany" : "bot.markedNoShowOne", {
      name: escapeHtml(booking.customer.name),
      count,
    }),
  );
}
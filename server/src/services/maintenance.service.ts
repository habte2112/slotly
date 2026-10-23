import { prisma } from "../lib/prisma";

// ጊዜ ያለፈባቸው ወይም የተጠቀሙባቸው አንድ ጊዜ የሚሰሩ tokens ይሰረዛሉ
export async function cleanupExpiredTokens(now = new Date()) {
  const [reset, telegram] = await Promise.all([
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    }),
    prisma.telegramLinkToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { passwordResetTokens: reset.count, telegramLinkTokens: telegram.count };
}

// ከመጨረሻ ሰዓታቸው በኋላ ከ 24 ሰዓት በላይ ያለፈባቸው እና ባለሙያው ያልመዘገባቸው ቀጠሮዎች "completed" ይሆናሉ
export async function autoCompleteFinishedBookings(now = new Date(), graceHours = 24) {
  const cutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);
  const result = await prisma.booking.updateMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, endAt: { lt: cutoff } },
    data: { status: "COMPLETED" },
  });
  return result.count;
}
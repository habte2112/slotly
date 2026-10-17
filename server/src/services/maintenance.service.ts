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
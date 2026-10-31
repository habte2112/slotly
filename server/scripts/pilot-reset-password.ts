import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";

// የሠራተኛ ወይም የአስተዳዳሪ የይለፍ ቃል ያስቀምጣል (ደንበኞችን አይነካም)
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const expectHost = process.env.EXPECT_HOST ?? "";
  if (!url || !expectHost || !url.includes(expectHost)) {
    console.error("DATABASE_URL must be set and contain EXPECT_HOST (guard against the wrong database). Stopping.");
    process.exit(1);
  }

  const email = (process.env.TARGET_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    // ኢሜይል ካልተሰጠ የሠራተኞችን ዝርዝር ብቻ ያሳያል
    const staff = await prisma.user.findMany({
      where: { role: { in: ["PROVIDER", "ADMIN"] } },
      select: { name: true, email: true, role: true },
      orderBy: { role: "asc" },
    });
    for (const u of staff) console.log(`${u.role.padEnd(9)} ${u.email}  (${u.name})`);
    return;
  }

  const password = process.env.NEW_PASSWORD ?? "";
  if (password.length < 10) {
    console.error("NEW_PASSWORD must be at least 10 characters. Stopping.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true },
  });
  if (!user || user.role === "CUSTOMER") {
    console.error("No staff or admin account with that email. Stopping.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    // passwordChangedAt ሲቀየር ቀድሞ የገቡ መሳሪያዎች ይወጣሉ
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log(`Password updated for ${user.name} (${email}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
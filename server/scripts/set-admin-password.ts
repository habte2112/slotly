import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 12) {
    console.error("Usage: npx tsx scripts/set-admin-password.ts <password, at least 12 characters>");
    process.exit(1);
  }
  await prisma.user.update({
    where: { email: "admin@slotly.dev" },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log("Admin password updated");
}

main().finally(() => prisma.$disconnect());
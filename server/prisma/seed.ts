import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";

async function upsertUser(name: string, email: string, password: string, role: "ADMIN" | "PROVIDER") {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { name, email, passwordHash, role },
  });
}

async function upsertService(name: string, durationMinutes: number, price: number, description: string) {
  const existing = await prisma.service.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.service.create({ data: { name, durationMinutes, price, description } });
}

async function main() {
  await upsertUser("Slotly Admin", "admin@slotly.dev", "Admin12345", "ADMIN");

  const selamUser = await upsertUser("Selam Tadesse", "selam@slotly.dev", "Provider123", "PROVIDER");
  const abelUser = await upsertUser("Abel Bekele", "abel@slotly.dev", "Provider123", "PROVIDER");

  const selam = await prisma.provider.upsert({
    where: { userId: selamUser.id },
    update: {},
    create: { userId: selamUser.id, bio: "Hair stylist with 8 years of experience." },
  });
  const abel = await prisma.provider.upsert({
    where: { userId: abelUser.id },
    update: {},
    create: { userId: abelUser.id, bio: "General practitioner, family medicine." },
  });

  const haircut = await upsertService("Haircut", 30, 300, "Classic cut and styling");
  const coloring = await upsertService("Hair Coloring", 90, 900, "Full color treatment");
  const checkup = await upsertService("General Checkup", 30, 500, "Routine health consultation");

  await prisma.providerService.createMany({
    data: [
      { providerId: selam.id, serviceId: haircut.id },
      { providerId: selam.id, serviceId: coloring.id },
      { providerId: abel.id, serviceId: checkup.id },
    ],
    skipDuplicates: true,
  });

  // የስራ ሰዓት፦ ሰኞ-አርብ 08:00-17:00፣ ቅዳሜ 09:00-13:00
  for (const provider of [selam, abel]) {
    await prisma.workingHour.deleteMany({ where: { providerId: provider.id } });
    await prisma.workingHour.createMany({
      data: [
        ...[1, 2, 3, 4, 5].map((d) => ({ providerId: provider.id, dayOfWeek: d, startTime: "08:00", endTime: "17:00" })),
        { providerId: provider.id, dayOfWeek: 6, startTime: "09:00", endTime: "13:00" },
      ],
    });
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
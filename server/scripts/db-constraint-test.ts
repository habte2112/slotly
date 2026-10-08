import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "test@example.com" } });
  const provider = await prisma.provider.findFirstOrThrow({ where: { user: { email: "selam@slotly.dev" } } });
  const service = await prisma.service.findFirstOrThrow({ where: { name: "Haircut" } });

  // ሩቅ ቀን ይጠቀማል፣ ስለዚህ ከሌሎች ቀጠሮዎች ጋር አይጋጭም
  const startAt = new Date("2027-03-01T05:00:00Z");
  const endAt = new Date("2027-03-01T05:30:00Z");

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      prisma.booking.create({
        data: { customerId: customer.id, providerId: provider.id, serviceId: service.id, startAt, endAt },
      }),
    ),
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  console.log(`Created: ${ok}, rejected by database: ${results.length - ok}`);
  console.log(ok === 1 ? "PASS: the database constraint blocked the overlaps" : "FAIL");

  await prisma.booking.deleteMany({ where: { providerId: provider.id, startAt } });
}

main().finally(() => prisma.$disconnect());
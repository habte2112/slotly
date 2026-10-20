import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";

type Role = "ADMIN" | "PROVIDER";

// ይህ repo ህዝባዊ ስለሆነ የሚታወቅ demo password ያለው Selam ብቻ ነው፤ ሌሎች ባለሙያዎች የዘፈቀደ password ያገኛሉ
const randomPassword = () => randomBytes(24).toString("base64url");

async function upsertUser(name: string, email: string, role: Role, password: string | null) {
  const passwordHash = await bcrypt.hash(password ?? randomPassword(), 12);
  return prisma.user.upsert({
    where: { email },
    // የሚታወቅ password ያላቸው ነባር ተጠቃሚዎች password አይቀየርም፤ የዘፈቀደዎቹ በእያንዳንዱ ሩጫ ይዞራሉ
    update: password === null ? { name, role, passwordHash, passwordChangedAt: new Date() } : { name, role },
    create: { name, email, role, passwordHash },
  });
}

async function ensureService(name: string, durationMinutes: number, price: number, description: string) {
  const existing = await prisma.service.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.service.create({ data: { name, durationMinutes, price, description } });
}

interface Style {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  image: string;
}

const CATALOG: Record<string, Style[]> = {
  Haircut: [
    { name: "Classic cut", description: "Scissor cut and finish", durationMinutes: 30, price: 300, image: "haircut-classic-cut.jpg" },
    { name: "Fade", description: "Skin or taper fade with a sharp finish", durationMinutes: 45, price: 400, image: "haircut-fade.jpg" },
    { name: "Kids cut", description: "Gentle cut for children under 12", durationMinutes: 30, price: 250, image: "haircut-kids-cut.jpg" },
    { name: "Beard trim", description: "Shape and line-up", durationMinutes: 20, price: 150, image: "haircut-beard-trim.jpg" },
    { name: "Cut + beard", description: "Haircut with a full beard trim", durationMinutes: 50, price: 480, image: "haircut-cut-and-beard.jpg" },
  ],
  "Hair Coloring": [
    { name: "Roots touch-up", description: "Cover regrowth at the roots", durationMinutes: 60, price: 600, image: "coloring-roots-touch-up.jpg" },
    { name: "Full color", description: "All-over color from root to tip", durationMinutes: 120, price: 1200, image: "coloring-full-color.jpg" },
    { name: "Highlights", description: "Hand-painted highlights", durationMinutes: 150, price: 1500, image: "coloring-highlights.jpg" },
    { name: "Gloss treatment", description: "Shine and tone refresh", durationMinutes: 45, price: 500, image: "coloring-gloss-treatment.jpg" },
  ],
  "General Checkup": [
    { name: "Basic checkup", description: "Routine consultation and vitals", durationMinutes: 30, price: 500, image: "checkup-basic.jpg" },
    { name: "Full health screening", description: "Complete examination and basic tests", durationMinutes: 60, price: 1200, image: "checkup-full-health-screening.jpg" },
    { name: "Child checkup", description: "Growth and development check", durationMinutes: 30, price: 450, image: "checkup-child.jpg" },
    { name: "Follow-up visit", description: "Short review of an earlier visit", durationMinutes: 20, price: 300, image: "checkup-follow-up.jpg" },
    { name: "Women's health consult", description: "Private consultation", durationMinutes: 40, price: 800, image: "checkup-womens-health.jpg" },
  ],
};

interface Offer {
  style: string;
  price?: number; // የባለሙያው ልዩ ዋጋ
  minutes?: number; // የባለሙያው ልዩ ጊዜ
}

interface Staff {
  name: string;
  email: string;
  bio: string;
  password: string | null;
  hours: [days: number[], start: string, end: string][]; // 0 = እሑድ ... 6 = ቅዳሜ
  offers: Record<string, Offer[]>;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

const STAFF: Staff[] = [
  {
    name: "Selam Tadesse",
    email: "selam@slotly.dev",
    bio: "Senior hair stylist with 8 years of experience in cuts and color.",
    password: "Provider123",
    hours: [
      [WEEKDAYS, "08:00", "12:00"],
      [WEEKDAYS, "13:00", "17:00"],
      [[6], "09:00", "13:00"],
    ],
    offers: {
      Haircut: [{ style: "Classic cut" }, { style: "Fade", price: 450 }, { style: "Kids cut" }],
      "Hair Coloring": [{ style: "Roots touch-up" }, { style: "Full color" }, { style: "Highlights" }],
    },
  },
  {
    name: "Dawit Alemu",
    email: "dawit@slotly.dev",
    bio: "Barber specialising in fades and beard work.",
    password: null,
    hours: [[[2, 3, 4, 5, 6], "09:00", "18:00"]],
    offers: {
      Haircut: [
        { style: "Classic cut" },
        { style: "Fade" },
        { style: "Beard trim" },
        { style: "Cut + beard", price: 520 },
        { style: "Kids cut" },
      ],
    },
  },
  {
    name: "Hana Girma",
    email: "hana@slotly.dev",
    bio: "Colorist, expert in highlights and tone.",
    password: null,
    hours: [
      [[1, 3, 5], "10:00", "19:00"],
      [[6], "09:00", "14:00"],
    ],
    offers: {
      "Hair Coloring": [
        { style: "Roots touch-up" },
        { style: "Full color", price: 1400 },
        { style: "Highlights", price: 1700 },
        { style: "Gloss treatment" },
      ],
    },
  },
  {
    name: "Dr. Abel Bekele",
    email: "abel@slotly.dev",
    bio: "General practitioner, family medicine.",
    password: null,
    hours: [
      [WEEKDAYS, "08:00", "12:00"],
      [WEEKDAYS, "14:00", "17:00"],
    ],
    offers: {
      "General Checkup": [{ style: "Basic checkup" }, { style: "Full health screening" }, { style: "Follow-up visit" }],
    },
  },
  {
    name: "Dr. Meron Tesfaye",
    email: "meron@slotly.dev",
    bio: "Paediatrician, care for infants and children.",
    password: null,
    hours: [[[1, 2, 3, 4], "08:30", "16:30"]],
    offers: {
      "General Checkup": [{ style: "Child checkup", price: 550 }, { style: "Follow-up visit", minutes: 25 }],
    },
  },
  {
    name: "Dr. Rahel Haile",
    email: "rahel@slotly.dev",
    bio: "Women's health and general consultations.",
    password: null,
    hours: [
      [[2, 4], "09:00", "17:00"],
      [[6], "09:00", "13:00"],
    ],
    offers: {
      "General Checkup": [
        { style: "Women's health consult" },
        { style: "Basic checkup", price: 600 },
        { style: "Follow-up visit" },
      ],
    },
  },
];

async function main() {
  // ማስታወሻ፦ ይህ የመጀመሪያ ጊዜ ብቻ የሚሰራ የ demo password ነው፤ ነባር admin password አይቀየርም
  await upsertUser("Slotly Admin", "admin@slotly.dev", "ADMIN", "Admin12345");

  const base = {
    Haircut: await ensureService("Haircut", 30, 300, "Classic cut and styling"),
    "Hair Coloring": await ensureService("Hair Coloring", 90, 900, "Full color treatment"),
    "General Checkup": await ensureService("General Checkup", 30, 500, "Routine health consultation"),
  } as Record<string, { id: string }>;

  // ዘይቤዎች፦ "አገልግሎት|ዘይቤ" → id
  const styleIds = new Map<string, string>();
  for (const [serviceName, styles] of Object.entries(CATALOG)) {
    for (const [index, s] of styles.entries()) {
      const fields = { description: s.description, durationMinutes: s.durationMinutes, price: s.price, sortOrder: index };
      const row = await prisma.serviceVariant.upsert({
        where: { serviceId_name: { serviceId: base[serviceName].id, name: s.name } },
        update: fields,
        create: { serviceId: base[serviceName].id, name: s.name, ...fields },
      });
      // admin የጫነውን ምስል እንዳይተካ፣ ምስል ከሌለ ብቻ ይሞላል
      if (!row.imageUrl) {
        await prisma.serviceVariant.update({ where: { id: row.id }, data: { imageUrl: `/styles/${s.image}` } });
      }
      styleIds.set(`${serviceName}|${s.name}`, row.id);
    }
  }

  for (const staff of STAFF) {
    const user = await upsertUser(staff.name, staff.email, "PROVIDER", staff.password);
    const provider = await prisma.provider.upsert({
      where: { userId: user.id },
      update: { bio: staff.bio },
      create: { userId: user.id, bio: staff.bio },
    });

    await prisma.providerService.createMany({
      data: Object.keys(staff.offers).map((name) => ({ providerId: provider.id, serviceId: base[name].id })),
      skipDuplicates: true,
    });

    for (const [serviceName, offers] of Object.entries(staff.offers)) {
      for (const offer of offers) {
        const variantId = styleIds.get(`${serviceName}|${offer.style}`);
        if (!variantId) throw new Error(`Unknown style "${offer.style}" for "${serviceName}"`);
        const overrides = { priceOverride: offer.price ?? null, durationOverride: offer.minutes ?? null };
        await prisma.providerVariant.upsert({
          where: { providerId_variantId: { providerId: provider.id, variantId } },
          update: overrides,
          create: { providerId: provider.id, variantId, ...overrides },
        });
      }
    }

    // የስራ ሰዓት በእያንዳንዱ ሩጫ ወደ seed ዋጋ ይመለሳል
    await prisma.workingHour.deleteMany({ where: { providerId: provider.id } });
    await prisma.workingHour.createMany({
      data: staff.hours.flatMap(([days, startTime, endTime]) =>
        days.map((dayOfWeek) => ({ providerId: provider.id, dayOfWeek, startTime, endTime })),
      ),
    });
  }

  const emails = STAFF.map((s) => s.email);
  const [styles, links, specialists] = await Promise.all([
    prisma.serviceVariant.count({ where: { service: { name: { in: Object.keys(CATALOG) } } } }),
    prisma.providerVariant.count({ where: { provider: { user: { email: { in: emails } } } } }),
    prisma.provider.count({ where: { user: { email: { in: emails } } } }),
  ]);
  console.log(`Seed complete: ${specialists} specialists, ${styles} styles, ${links} specialist-style links`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
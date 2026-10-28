import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

const configSchema = z.object({
  dbHostMustContain: z.string().min(5),
  salonName: z.string().min(2),
  admin: z.object({
    name: z.string().min(2),
    email: z.string().trim().toLowerCase().email(),
    locale: z.enum(["en", "am"]).default("am"),
  }),
  services: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(2),
        description: z.string().optional(),
        durationMinutes: z.number().int().min(5).max(480),
        price: z.number().int().min(0),
      }),
    )
    .min(1),
  hours: z
    .array(z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), start: time, end: time }))
    .min(1),
  staff: z
    .array(
      z.object({
        name: z.string().min(2),
        email: z.string().trim().toLowerCase().email(),
        bio: z.string().optional(),
        services: z.array(z.string()).min(1),
        breakTime: z.tuple([time, time]).optional(),
      }),
    )
    .min(1),
});

type Config = z.infer<typeof configSchema>;

function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function checkConfig(config: Config) {
  const keys = new Set<string>();
  for (const s of config.services) {
    if (keys.has(s.key)) fail(`Duplicate service key "${s.key}"`);
    keys.add(s.key);
  }
  for (const h of config.hours) {
    if (h.start >= h.end) fail(`Working hours: start ${h.start} must be before end ${h.end}`);
  }
  const emails = new Set<string>([config.admin.email]);
  for (const st of config.staff) {
    if (emails.has(st.email)) fail(`Email used twice: ${st.email}`);
    emails.add(st.email);
    for (const key of st.services) {
      if (!keys.has(key)) fail(`${st.name}: unknown service key "${key}"`);
    }
    if (st.breakTime && st.breakTime[0] >= st.breakTime[1]) fail(`${st.name}: break start must be before end`);
  }
}

// የእረፍት ሰዓትን ከሥራ መስኮቱ ውስጥ ያወጣል፤ ለምሳሌ 08:30-21:00 ሲቀነስ 12:30-13:00 → [08:30-12:30], [13:00-21:00]
function windowsFor(config: Config, breakTime?: [string, string]) {
  const out: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
  for (const h of config.hours) {
    for (const dayOfWeek of h.days) {
      if (breakTime && breakTime[0] > h.start && breakTime[1] < h.end) {
        out.push({ dayOfWeek, startTime: h.start, endTime: breakTime[0] });
        out.push({ dayOfWeek, startTime: breakTime[1], endTime: h.end });
      } else {
        out.push({ dayOfWeek, startTime: h.start, endTime: h.end });
      }
    }
  }
  return out;
}

const randomPassword = () => randomBytes(24).toString("base64url");

async function main() {
  const configPath = resolve(process.cwd(), process.argv[2] ?? "pilot/salon.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    fail(`Cannot read ${configPath}: ${e instanceof Error ? e.message : e}`);
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    fail(`salon.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const config = parsed.data;
  checkConfig(config);

  // የተሳሳተ ዳታቤዝ እንዳይነካ (ለምሳሌ ከ .env የዲሞው ዳታቤዝ ቢጫን)
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) fail("DATABASE_URL is not set");
  const host = new URL(dbUrl).host;
  if (!host.includes(config.dbHostMustContain)) {
    fail(`DATABASE_URL points to "${host}", which does not contain "${config.dbHostMustContain}". Refusing to run.`);
  }
  console.log(`Database host: ${host}`);

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) fail("Set ADMIN_PASSWORD (at least 12 characters)");
  const resetAdminPassword = process.env.RESET_ADMIN_PASSWORD === "1";

  // አስተዳዳሪ፤ የይለፍ ቃሉ በነባር መለያ ላይ የሚቀየረው RESET_ADMIN_PASSWORD=1 ሲሆን ብቻ ነው
  const adminHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: config.admin.email },
    update: {
      name: config.admin.name,
      role: "ADMIN",
      locale: config.admin.locale,
      ...(resetAdminPassword ? { passwordHash: adminHash, passwordChangedAt: new Date() } : {}),
    },
    create: {
      name: config.admin.name,
      email: config.admin.email,
      role: "ADMIN",
      locale: config.admin.locale,
      passwordHash: adminHash,
    },
  });

  // አገልግሎቶች (በስም ይለያሉ፤ ዳግም ሲሮጥ ዋጋና ጊዜ ይዘምናሉ)
  const serviceIds = new Map<string, string>();
  for (const s of config.services) {
    const fields = {
      description: s.description ?? null,
      durationMinutes: s.durationMinutes,
      price: s.price,
      isActive: true,
    };
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    const row = existing
      ? await prisma.service.update({ where: { id: existing.id }, data: fields })
      : await prisma.service.create({ data: { name: s.name, ...fields } });
    serviceIds.set(s.key, row.id);
  }

  // ባለሙያዎች
  for (const st of config.staff) {
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: { name: st.name, role: "PROVIDER", locale: config.admin.locale },
      // ባለሙያዎች ለጊዜው አይገቡም፤ የማይታወቅ የዘፈቀደ የይለፍ ቃል ያገኛሉ
      create: {
        name: st.name,
        email: st.email,
        role: "PROVIDER",
        locale: config.admin.locale,
        passwordHash: await bcrypt.hash(randomPassword(), 12),
      },
    });
    const provider = await prisma.provider.upsert({
      where: { userId: user.id },
      update: { bio: st.bio ?? null },
      create: { userId: user.id, bio: st.bio ?? null },
    });

    const wanted = st.services.map((key) => serviceIds.get(key)!);
    await prisma.providerService.deleteMany({ where: { providerId: provider.id, serviceId: { notIn: wanted } } });
    await prisma.providerService.createMany({
      data: wanted.map((serviceId) => ({ providerId: provider.id, serviceId })),
      skipDuplicates: true,
    });

    await prisma.workingHour.deleteMany({ where: { providerId: provider.id } });
    await prisma.workingHour.createMany({
      data: windowsFor(config, st.breakTime).map((w) => ({ providerId: provider.id, ...w })),
    });
  }

  const [services, specialists, windows] = await Promise.all([
    prisma.service.count({ where: { name: { in: config.services.map((s) => s.name) } } }),
    prisma.provider.count({ where: { user: { email: { in: config.staff.map((s) => s.email) } } } }),
    prisma.workingHour.count({ where: { provider: { user: { email: { in: config.staff.map((s) => s.email) } } } } }),
  ]);
  console.log(`${config.salonName}: ${services} services, ${specialists} specialists, ${windows} working-hour windows. Done.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
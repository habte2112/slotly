import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { app } from "./app";
import { prisma } from "./lib/prisma";

// ዳታቤዝ የሚነኩ ሙከራዎች የሚሰሩት TEST_DATABASE_URL ሲኖር ብቻ ነው
const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const tag = randomBytes(4).toString("hex");
const email = (name: string) => `${name}-${tag}@test.slotly.dev`;
const PASSWORD = "TestPassword123";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ከ minDaysAhead ቀን በኋላ ያለው የመጀመሪያ ሰኞ (የአዲስ አበባ ቀን)
function nextMonday(minDaysAhead: number): string {
  const d = new Date(Date.now() + OFFSET_MS + minDaysAhead * DAY_MS);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// የአዲስ አበባ ሰዓት ("09:30") → ISO (UTC)
const at = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const DATE_A = nextMonday(14);
const DATE_B = addDays(DATE_A, 7);
const DATE_C = addDays(DATE_A, 14);
const DATE_D = addDays(DATE_A, 21);

async function login(address: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email: address, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describeDb("Slotly API", () => {
  let providerId = "";
  let serviceId = "";
  let longServiceId = "";
  let adminToken = "";
  let customer1Token = "";
  let customer2Token = "";
  let providerToken = "";

  const book = (token: string, startAt: string, sid = serviceId) =>
    request(app).post("/api/bookings").set(bearer(token)).send({ providerId, serviceId: sid, startAt });

  const availability = (date: string, sid = serviceId) =>
    request(app).get(`/api/providers/${providerId}/availability`).query({ date, serviceId: sid });

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const make = (name: string, role: "CUSTOMER" | "PROVIDER" | "ADMIN") =>
      prisma.user.create({ data: { name, email: email(name), passwordHash, role } });

    await make("admin", "ADMIN");
    await make("customer1", "CUSTOMER");
    await make("customer2", "CUSTOMER");
    const providerUser = await make("provider", "PROVIDER");

    const provider = await prisma.provider.create({ data: { userId: providerUser.id, bio: "Test provider" } });
    providerId = provider.id;

    const service = await prisma.service.create({
      data: { name: `Test cut ${tag}`, durationMinutes: 30, price: 100 },
    });
    const longService = await prisma.service.create({
      data: { name: `Test color ${tag}`, durationMinutes: 90, price: 300 },
    });
    serviceId = service.id;
    longServiceId = longService.id;

    await prisma.providerService.createMany({
      data: [
        { providerId, serviceId },
        { providerId, serviceId: longServiceId },
      ],
    });
    // ሰኞ 08:00-17:00
    await prisma.workingHour.create({ data: { providerId, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" } });

    adminToken = await login(email("admin"));
    customer1Token = await login(email("customer1"));
    customer2Token = await login(email("customer2"));
    providerToken = await login(email("provider"));
  }, 60000);

  afterAll(async () => {
    const mine = { endsWith: `-${tag}@test.slotly.dev` };
    // providerId ባዶ ከሆነ ማጣሪያው ሁሉንም እንዳይመርጥ
    const filters: object[] = [{ customer: { email: mine } }];
    if (providerId) filters.push({ providerId });

    await prisma.booking.deleteMany({ where: { OR: filters } });
    await prisma.user.deleteMany({ where: { email: mine } });
    await prisma.service.deleteMany({ where: { name: { contains: tag } } });
    await prisma.$disconnect();
  }, 60000);

  describe("health", () => {
    it("reports that the database is connected", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok", db: "connected" });
    });
  });

  describe("authentication", () => {
    it("registers a customer and never returns the password hash", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "New User", email: email("new"), password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("CUSTOMER");
      expect(res.body.token).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    });

    it("ignores a role sent by the client (no privilege escalation)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Sneaky", email: email("sneaky"), password: PASSWORD, role: "ADMIN" });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("CUSTOMER");
    });

    it("rejects a duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "New User", email: email("new"), password: PASSWORD });
      expect(res.status).toBe(409);
    });

    it("rejects a short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Short", email: email("short"), password: "123" });
      expect(res.status).toBe(400);
    });

    it("gives the same error for a wrong password and an unknown email", async () => {
      const wrong = await request(app).post("/api/auth/login").send({ email: email("customer1"), password: "nope-nope-nope" });
      const unknown = await request(app).post("/api/auth/login").send({ email: email("ghost"), password: PASSWORD });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it("protects /me", async () => {
      expect((await request(app).get("/api/auth/me")).status).toBe(401);
      const res = await request(app).get("/api/auth/me").set(bearer(customer1Token));
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email("customer1"));
    });

    it("rate-limits repeated failed logins", async () => {
      let last = 0;
      for (let i = 0; i < 11; i++) {
        const res = await request(app).post("/api/auth/login").send({ email: email("ratelimit"), password: "wrong-password" });
        last = res.status;
      }
      expect(last).toBe(429);
    }, 60000);
  });

  describe("role-based access", () => {
    it("lets only an admin create services", async () => {
      const body = { name: `Admin made ${tag}`, durationMinutes: 45, price: 250 };
      expect((await request(app).post("/api/services").send(body)).status).toBe(401);
      expect((await request(app).post("/api/services").set(bearer(customer1Token)).send(body)).status).toBe(403);
      expect((await request(app).post("/api/services").set(bearer(adminToken)).send(body)).status).toBe(201);
    });

    it("keeps the provider dashboard for providers only", async () => {
      expect((await request(app).get("/api/provider/me").set(bearer(customer1Token))).status).toBe(403);
      const res = await request(app).get("/api/provider/me").set(bearer(providerToken));
      expect(res.status).toBe(200);
      expect(res.body.provider.id).toBe(providerId);
    });
  });

  describe("availability", () => {
    it("returns every 30-minute slot on a free working day", async () => {
      const res = await availability(DATE_A);
      expect(res.status).toBe(200);
      expect(res.body.slots).toHaveLength(18);
      expect(res.body.slots[0].label).toBe("08:00");
      expect(res.body.slots[0].start).toBe(at(DATE_A, "08:00"));
      expect(res.body.slots[17].label).toBe("16:30");
    });

    it("returns no slots on a day the provider does not work", async () => {
      const res = await availability(addDays(DATE_A, -1)); // እሑድ
      expect(res.status).toBe(200);
      expect(res.body.slots).toEqual([]);
    });

    it("validates the query", async () => {
      expect((await availability("2026-02-30")).status).toBe(400);
      expect((await availability(DATE_A, "no-such-service")).status).toBe(404);
    });
  });

  describe("bookings", () => {
    let rescheduleId = "";

    it("requires login", async () => {
      const res = await request(app).post("/api/bookings").send({ providerId, serviceId, startAt: at(DATE_A, "09:00") });
      expect(res.status).toBe(401);
    });

    it("books a free slot", async () => {
      const res = await book(customer1Token, at(DATE_A, "09:00"));
      expect(res.status).toBe(201);
      expect(res.body.booking.status).toBe("CONFIRMED");
      expect(res.body.booking.startAt).toBe(at(DATE_A, "09:00"));
      expect(res.body.booking.endAt).toBe(at(DATE_A, "09:30"));
    });

    it("removes the booked slot from availability but keeps its neighbours", async () => {
      const starts: string[] = (await availability(DATE_A)).body.slots.map((s: { start: string }) => s.start);
      expect(starts).not.toContain(at(DATE_A, "09:00"));
      expect(starts).toContain(at(DATE_A, "08:30"));
      expect(starts).toContain(at(DATE_A, "09:30"));
    });

    it("rejects a slot that is already taken", async () => {
      expect((await book(customer2Token, at(DATE_A, "09:00"))).status).toBe(409);
    });

    it("rejects a time outside working hours", async () => {
      expect((await book(customer2Token, at(DATE_A, "20:00"))).status).toBe(409);
    });

    it("lets only the owner cancel, and cancelling frees the slot", async () => {
      const mine = await request(app).get("/api/bookings/my").set(bearer(customer1Token));
      const bookingId: string = mine.body.bookings.find(
        (b: { startAt: string }) => b.startAt === at(DATE_A, "09:00"),
      ).id;

      const stranger = await request(app).patch(`/api/bookings/${bookingId}/cancel`).set(bearer(customer2Token));
      expect(stranger.status).toBe(403);

      const owner = await request(app).patch(`/api/bookings/${bookingId}/cancel`).set(bearer(customer1Token));
      expect(owner.status).toBe(200);
      expect(owner.body.booking.status).toBe("CANCELLED");

      const starts: string[] = (await availability(DATE_A)).body.slots.map((s: { start: string }) => s.start);
      expect(starts).toContain(at(DATE_A, "09:00"));

      // ሌላ ደንበኛ ያንኑ ሰዓት ሊይዝ ይችላል (ይህ ቀጠሮ በኋላ ሙከራዎች ይጠቀሙበታል)
      expect((await book(customer2Token, at(DATE_A, "09:00"))).status).toBe(201);
    });

    it("lets exactly one of five simultaneous requests win the same slot", async () => {
      const startAt = at(DATE_B, "09:00");
      const statuses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          book(i % 2 === 0 ? customer1Token : customer2Token, startAt).then((r) => r.status),
        ),
      );
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(4);

      const active = await prisma.booking.count({
        where: { providerId, startAt: new Date(startAt), status: { in: ["PENDING", "CONFIRMED"] } },
      });
      expect(active).toBe(1);
    });

    it("reschedules, ignoring the booking's own time when checking availability", async () => {
      const created = await book(customer1Token, at(DATE_C, "10:00"), longServiceId); // 10:00-11:30
      expect(created.status).toBe(201);
      rescheduleId = created.body.booking.id;

      const moved = await request(app)
        .patch(`/api/bookings/${rescheduleId}/reschedule`)
        .set(bearer(customer1Token))
        .send({ startAt: at(DATE_C, "10:30") }); // 10:30-12:00 ከራሱ ጋር ይደራረባል
      expect(moved.status).toBe(200);
      expect(moved.body.booking.startAt).toBe(at(DATE_C, "10:30"));
      expect(moved.body.booking.endAt).toBe(at(DATE_C, "12:00"));
    });

    it("rejects a reschedule onto someone else's booking", async () => {
      expect((await book(customer2Token, at(DATE_C, "14:00"))).status).toBe(201); // 14:00-14:30
      const res = await request(app)
        .patch(`/api/bookings/${rescheduleId}/reschedule`)
        .set(bearer(customer1Token))
        .send({ startAt: at(DATE_C, "13:30") }); // 13:30-15:00 ይደራረባል
      expect(res.status).toBe(409);
    });

    it("rejects rescheduling to the same time or by another customer", async () => {
      const same = await request(app)
        .patch(`/api/bookings/${rescheduleId}/reschedule`)
        .set(bearer(customer1Token))
        .send({ startAt: at(DATE_C, "10:30") });
      expect(same.status).toBe(400);

      const stranger = await request(app)
        .patch(`/api/bookings/${rescheduleId}/reschedule`)
        .set(bearer(customer2Token))
        .send({ startAt: at(DATE_C, "15:00") });
      expect(stranger.status).toBe(403);
    });
  });

  describe("provider time off", () => {
    const wholeDay = (date: string) => ({ startAt: at(date, "00:00"), endAt: at(addDays(date, 1), "00:00") });

    it("refuses time off over existing bookings", async () => {
      const res = await request(app).post("/api/provider/time-off").set(bearer(providerToken)).send(wholeDay(DATE_A));
      expect(res.status).toBe(409);
    });

    it("blocks a whole day, removes its slots and can be undone", async () => {
      const created = await request(app).post("/api/provider/time-off").set(bearer(providerToken)).send(wholeDay(DATE_D));
      expect(created.status).toBe(201);

      expect((await availability(DATE_D)).body.slots).toEqual([]);
      expect((await book(customer1Token, at(DATE_D, "09:00"))).status).toBe(409);

      const removed = await request(app)
        .delete(`/api/provider/time-off/${created.body.timeOff.id}`)
        .set(bearer(providerToken));
      expect(removed.status).toBe(200);
      expect((await availability(DATE_D)).body.slots).toHaveLength(18);
    });
  });

  describe("password reset", () => {
    const makeUser = async (name: string) =>
      prisma.user.create({ data: { name, email: email(name), passwordHash: await bcrypt.hash(PASSWORD, 4) } });

    it("answers the same way whether or not the email exists", async () => {
      const known = await request(app).post("/api/auth/forgot-password").send({ email: email("customer2") });
      const unknown = await request(app).post("/api/auth/forgot-password").send({ email: email("nobody") });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
    });

    it("creates a stored token for a known email", async () => {
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: email("customer2") } });
      await vi.waitFor(
        async () => {
          const tokens = await prisma.passwordResetToken.findMany({ where: { userId: customer.id } });
          expect(tokens).toHaveLength(1);
          expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
        },
        { timeout: 10000, interval: 250 },
      );
    });

    it("resets a password once with a valid token", async () => {
      const user = await makeUser("reset1");
      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });

      const newPassword = "BrandNewPassword456";
      const res = await request(app).post("/api/auth/reset-password").send({ token, password: newPassword });
      expect(res.status).toBe(200);

      expect((await request(app).post("/api/auth/login").send({ email: user.email, password: newPassword })).status).toBe(200);
      expect((await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD })).status).toBe(401);

      const again = await request(app).post("/api/auth/reset-password").send({ token, password: "AnotherPassword789" });
      expect(again.status).toBe(400);
    });

    it("rejects expired and malformed tokens", async () => {
      const user = await makeUser("reset2");
      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await request(app).post("/api/auth/reset-password").send({ token, password: "BrandNewPassword456" })).status).toBe(400);
      expect((await request(app).post("/api/auth/reset-password").send({ token: "not-a-token", password: "BrandNewPassword456" })).status).toBe(400);
    });
  });

  describe("scheduled reminders endpoint", () => {
    it("rejects calls without the right secret", async () => {
      expect((await request(app).post("/api/internal/send-reminders")).status).toBe(401);
      expect((await request(app).post("/api/internal/send-reminders").set(bearer("wrong-secret"))).status).toBe(401);
    });

    it("accepts the secret and reports that email is disabled in tests", async () => {
      const res = await request(app).post("/api/internal/send-reminders").set(bearer(process.env.CRON_SECRET!));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ due: 0, sent: 0, failed: 0, skipped: 0, emailEnabled: false });
    });
  });
});
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { app } from "./app";
import { prisma } from "./lib/prisma";
import jwt from "jsonwebtoken";

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
const DATE_E = addDays(DATE_A, 28);
const DATE_F = addDays(DATE_A, 35);

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
    it("returns JSON for unknown API routes", async () => {
      const res = await request(app).get("/api/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Not found" });
    });
    it("answers /api/ping without touching the database", async () => {
      const res = await request(app).get("/api/ping");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
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
    it("does not offer or accept slots beyond the booking window", async () => {
      const far = nextMonday(200);
      const res = await availability(far);
      expect(res.status).toBe(200);
      expect(res.body.slots).toEqual([]);
      expect((await book(customer1Token, at(far, "09:00"))).status).toBe(409);
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
      expect(res.body.booking.priceAtBooking).toBe(100);
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
    it("revokes tokens issued before a password reset", async () => {
      const user = await makeUser("revoke");
      // ከ 2 ደቂቃ በፊት የተሰጠ token (ወደፊት ከሚደረገው ለውጥ በፊት)
      const oldToken = jwt.sign({ role: user.role, iat: Math.floor(Date.now() / 1000) - 120 }, process.env.JWT_SECRET!, {
        subject: user.id,
        algorithm: "HS256",
        expiresIn: "7d",
      });
      expect((await request(app).get("/api/auth/me").set(bearer(oldToken))).status).toBe(200);

      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const newPassword = "BrandNewPassword456";
      expect((await request(app).post("/api/auth/reset-password").send({ token, password: newPassword })).status).toBe(200);

      expect((await request(app).get("/api/auth/me").set(bearer(oldToken))).status).toBe(401);

      const fresh = await login(user.email, newPassword);
      expect((await request(app).get("/api/auth/me").set(bearer(fresh))).status).toBe(200);
    });
  });

  describe("scheduled reminders endpoint", () => {
    it("rejects calls without the right secret", async () => {
      expect((await request(app).post("/api/internal/send-reminders")).status).toBe(401);
      expect((await request(app).post("/api/internal/send-reminders").set(bearer("wrong-secret"))).status).toBe(401);
    });

    it("accepts the secret and reports which channels are enabled", async () => {
      const res = await request(app).post("/api/internal/send-reminders").set(bearer(process.env.CRON_SECRET!));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ emailEnabled: false, telegramEnabled: true });
      expect(res.body.due).toEqual(expect.any(Number));
    });
    it("also removes expired one-time tokens", async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: email("customer2") } });
      const stale = await prisma.telegramLinkToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(randomBytes(16).toString("hex")),
          expiresAt: new Date(Date.now() - 60_000),
        },
      });

      const res = await request(app).post("/api/internal/send-reminders").set(bearer(process.env.CRON_SECRET!));
      expect(res.status).toBe(200);
      expect(res.body.cleaned.telegramLinkTokens).toBeGreaterThanOrEqual(1);
      expect(await prisma.telegramLinkToken.findUnique({ where: { id: stale.id } })).toBeNull();
    });
  });
  
  describe("admin panel", () => {
    it("keeps admin endpoints for admins only", async () => {
      expect((await request(app).get("/api/admin/stats")).status).toBe(401);
      expect((await request(app).get("/api/admin/stats").set(bearer(customer1Token))).status).toBe(403);
      expect((await request(app).get("/api/admin/stats").set(bearer(providerToken))).status).toBe(403);
    });

    it("returns dashboard statistics with one entry per day", async () => {
      const res = await request(app).get("/api/admin/stats").query({ days: 7 }).set(bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.perDay).toHaveLength(7);
      expect(res.body.totals).toEqual(
        expect.objectContaining({ bookings: expect.any(Number), revenue: expect.any(Number) }),
      );
      expect(res.body.users.customers).toBeGreaterThan(0);
    });

    it("validates the statistics range", async () => {
      const res = await request(app).get("/api/admin/stats").query({ days: 3 }).set(bearer(adminToken));
      expect(res.status).toBe(400);
    });

    it("lists bookings, services and specialists", async () => {
      const bookings = await request(app).get("/api/admin/bookings").set(bearer(adminToken));
      expect(bookings.status).toBe(200);
      expect(Array.isArray(bookings.body.bookings)).toBe(true);

      const services = await request(app).get("/api/admin/services").set(bearer(adminToken));
      expect(services.status).toBe(200);
      expect(services.body.services.length).toBeGreaterThan(0);

      const providers = await request(app).get("/api/admin/providers").set(bearer(adminToken));
      expect(providers.status).toBe(200);
      expect(providers.body.providers.some((p: { id: string }) => p.id === providerId)).toBe(true);
    });

    it("promotes a customer to a specialist who can then use the dashboard", async () => {
      const address = email("promote");
      const registered = await request(app)
        .post("/api/auth/register")
        .send({ name: "Promote Me", email: address, password: PASSWORD });
      expect(registered.status).toBe(201);

      const created = await request(app).post("/api/admin/providers").set(bearer(adminToken)).send({ email: address });
      expect(created.status).toBe(201);

      // ሚናው በ token ውስጥ ስለሆነ እንደገና መግባት ያስፈልጋል
      const token = await login(address);
      const me = await request(app).get("/api/provider/me").set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.workingHours).toHaveLength(5);

      const again = await request(app).post("/api/admin/providers").set(bearer(adminToken)).send({ email: address });
      expect(again.status).toBe(409);
    });

    it("refuses to make an admin a specialist and reports unknown emails", async () => {
      const admin = await request(app).post("/api/admin/providers").set(bearer(adminToken)).send({ email: email("admin") });
      expect(admin.status).toBe(409);
      const ghost = await request(app).post("/api/admin/providers").set(bearer(adminToken)).send({ email: email("ghost") });
      expect(ghost.status).toBe(404);
    });
  });

  describe("price at booking", () => {
    it("keeps the price a customer agreed to when the service price changes later", async () => {
      const priced = await prisma.service.create({
        data: { name: `Test price ${tag}`, durationMinutes: 30, price: 100 },
      });
      await prisma.providerService.create({ data: { providerId, serviceId: priced.id } });

      const first = await book(customer1Token, at(DATE_E, "09:00"), priced.id);
      expect(first.status).toBe(201);

      await prisma.service.update({ where: { id: priced.id }, data: { price: 150 } });

      const second = await book(customer2Token, at(DATE_E, "10:00"), priced.id);
      expect(second.status).toBe(201);

      const rows = await prisma.booking.findMany({
        where: { serviceId: priced.id },
        orderBy: { startAt: "asc" },
        select: { priceAtBooking: true },
      });
      expect(rows.map((r) => r.priceAtBooking)).toEqual([100, 150]);
    });
  });

  describe("telegram notifications", () => {
    const chatId = 700_000_000 + Math.floor(Math.random() * 90_000_000);
    const sent: { method: string; body: Record<string, any> }[] = [];
    let linkPayload = "";

    beforeAll(() => {
      // ወደ Telegram የሚሄዱ ጥሪዎች ይመሰላሉ፤ supertest fetch አይጠቀምም
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const method = String(input).split("/").pop() ?? "";
        sent.push({ method, body: JSON.parse(String(init?.body ?? "{}")) });
        return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    const update = (text: string, fromChat = chatId) => ({
      update_id: Math.floor(Math.random() * 1e9),
      message: { message_id: 1, chat: { id: fromChat, type: "private" }, text },
    });

    const webhook = (body: object, secret = process.env.TELEGRAM_WEBHOOK_SECRET!) =>
      request(app).post("/api/telegram/webhook").set("x-telegram-bot-api-secret-token", secret).send(body);

    const messageTo = (chat: number, includes: string) =>
      sent.find(
        (m) =>
          m.method === "sendMessage" &&
          String(m.body.chat_id) === String(chat) &&
          String(m.body.text).toLowerCase().includes(includes.toLowerCase()),
      );

    it("requires login to create a link", async () => {
      expect((await request(app).post("/api/telegram/link")).status).toBe(401);
    });

    it("rejects webhook calls without the right secret", async () => {
      expect((await request(app).post("/api/telegram/webhook").send(update("/help"))).status).toBe(401);
      expect((await webhook(update("/help"), "x".repeat(40))).status).toBe(401);
    });

    it("connects a chat with a one-time link", async () => {
      const created = await request(app).post("/api/telegram/link").set(bearer(customer1Token));
      expect(created.status).toBe(200);
      expect(created.body.url).toMatch(/^https:\/\/t\.me\/slotly_test_bot\?start=[A-Za-z0-9_-]{32}$/);
      linkPayload = new URL(created.body.url).searchParams.get("start")!;

      expect((await webhook(update(`/start ${linkPayload}`))).status).toBe(200);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: email("customer1") } });
      await vi.waitFor(
        async () => {
          const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
          expect(fresh.telegramChatId).toBe(String(chatId));
        },
        { timeout: 10000, interval: 250 },
      );
      await vi.waitFor(() => expect(messageTo(chatId, "connected")).toBeTruthy(), { timeout: 10000, interval: 250 });

      const status = await request(app).get("/api/telegram/status").set(bearer(customer1Token));
      expect(status.body).toMatchObject({ enabled: true, linked: true, botUsername: "slotly_test_bot" });
    });

    it("treats the link as single-use", async () => {
      const otherChat = chatId + 1;
      expect((await webhook(update(`/start ${linkPayload}`, otherChat))).status).toBe(200);
      await vi.waitFor(() => expect(messageTo(otherChat, "expired")).toBeTruthy(), { timeout: 10000, interval: 250 });

      const user = await prisma.user.findUniqueOrThrow({ where: { email: email("customer1") } });
      expect(user.telegramChatId).toBe(String(chatId));
    });

    it("notifies a linked customer about a new booking", async () => {
      const res = await book(customer1Token, at(DATE_F, "09:00"));
      expect(res.status).toBe(201);
      await vi.waitFor(() => expect(messageTo(chatId, "Booking confirmed")).toBeTruthy(), {
        timeout: 10000,
        interval: 250,
      });
      const note = messageTo(chatId, "Booking confirmed")!;
      expect(JSON.stringify(note.body.reply_markup)).toContain("calendar.google.com");
    });

    it("answers /bookings and /cancel in the chat", async () => {
      expect((await webhook(update("/bookings"))).status).toBe(200);
      await vi.waitFor(() => expect(messageTo(chatId, "Your upcoming bookings")).toBeTruthy(), {
        timeout: 10000,
        interval: 250,
      });

      expect((await webhook(update("/cancel"))).status).toBe(200);
      await vi.waitFor(
        () => {
          const menu = sent.find(
            (m) =>
              m.method === "sendMessage" &&
              String(m.body.chat_id) === String(chatId) &&
              Array.isArray(m.body.reply_markup?.inline_keyboard) &&
              m.body.reply_markup.inline_keyboard.some((row: { callback_data?: string }[]) =>
                row[0]?.callback_data?.startsWith("c:"),
              ),
          );
          expect(menu).toBeTruthy();
        },
        { timeout: 10000, interval: 250 },
      );
    });

    it("disconnects the chat", async () => {
      const res = await request(app).delete("/api/telegram/link").set(bearer(customer1Token));
      expect(res.status).toBe(200);
      const status = await request(app).get("/api/telegram/status").set(bearer(customer1Token));
      expect(status.body.linked).toBe(false);
    });
    });
  
  describe("service variants (data model)", () => {
    it("links variants to specialists with optional overrides and a booking", async () => {
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: email("customer1") } });

      const service = await prisma.service.create({
        data: { name: `Test variants ${tag}`, durationMinutes: 30, price: 100 },
      });
      const variant = await prisma.serviceVariant.create({
        data: { serviceId: service.id, name: "Fade", durationMinutes: 45, price: 400 },
      });
      await prisma.providerService.create({ data: { providerId, serviceId: service.id } });
      await prisma.providerVariant.create({ data: { providerId, variantId: variant.id, priceOverride: 450 } });

      const link = await prisma.providerVariant.findUniqueOrThrow({
        where: { providerId_variantId: { providerId, variantId: variant.id } },
      });
      expect(link.priceOverride).toBe(450);
      expect(link.durationOverride).toBeNull();

      const startAt = new Date(at(addDays(DATE_A, 42), "09:00"));
      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          providerId,
          serviceId: service.id,
          variantId: variant.id,
          startAt,
          endAt: new Date(startAt.getTime() + 45 * 60 * 1000),
          priceAtBooking: 450,
        },
      });
      expect(booking.variantId).toBe(variant.id);
    }, 60_000);

    it("enforces unique variant names within a service", async () => {
      const service = await prisma.service.create({
        data: { name: `Test unique ${tag}`, durationMinutes: 30, price: 100 },
      });
      await prisma.serviceVariant.create({
        data: { serviceId: service.id, name: "Fade", durationMinutes: 45, price: 400 },
      });
      await expect(
        prisma.serviceVariant.create({
          data: { serviceId: service.id, name: "Fade", durationMinutes: 30, price: 300 },
        }),
      ).rejects.toThrow();
    }, 60_000);
  });

  describe("service variants (API)", () => {
    const DATE_G = addDays(DATE_A, 49);
    const DATE_H = addDays(DATE_A, 56);
    let styledId = "";
    let plainId = "";
    let fadeId = "";
    let kidsId = "";
    let hiddenId = "";
    let providerBId = "";
    let aBookingId = "";

    const bookStyle = (token: string, pid: string, startAt: string, sid: string, variantId?: string) =>
      request(app)
        .post("/api/bookings")
        .set(bearer(token))
        .send({ providerId: pid, serviceId: sid, startAt, variantId });

    const availabilityFor = (pid: string, date: string, sid: string, variantId?: string) =>
      request(app)
        .get(`/api/providers/${pid}/availability`)
        .query({ date, serviceId: sid, ...(variantId ? { variantId } : {}) });

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash(PASSWORD, 4);
      const userB = await prisma.user.create({
        data: { name: "provider2", email: email("provider2"), passwordHash, role: "PROVIDER" },
      });
      const providerB = await prisma.provider.create({ data: { userId: userB.id, bio: "Second provider" } });
      providerBId = providerB.id;
      await prisma.workingHour.create({
        data: { providerId: providerBId, dayOfWeek: 1, startTime: "08:00", endTime: "17:00" },
      });

      const styled = await prisma.service.create({
        data: { name: `Test styles ${tag}`, durationMinutes: 30, price: 100 },
      });
      const plain = await prisma.service.create({
        data: { name: `Test plain ${tag}`, durationMinutes: 30, price: 100 },
      });
      styledId = styled.id;
      plainId = plain.id;

      const fade = await prisma.serviceVariant.create({
        data: { serviceId: styledId, name: "Fade", durationMinutes: 45, price: 400, sortOrder: 1 },
      });
      const kids = await prisma.serviceVariant.create({
        data: { serviceId: styledId, name: "Kids cut", durationMinutes: 30, price: 250, sortOrder: 2 },
      });
      const hidden = await prisma.serviceVariant.create({
        data: { serviceId: styledId, name: "Hidden", durationMinutes: 30, price: 999, isActive: false },
      });
      fadeId = fade.id;
      kidsId = kids.id;
      hiddenId = hidden.id;

      await prisma.providerService.createMany({
        data: [
          { providerId, serviceId: styledId },
          { providerId: providerBId, serviceId: styledId },
          { providerId, serviceId: plainId },
        ],
      });
      await prisma.providerVariant.createMany({
        data: [
          // Selam ለ Fade የራሷ ዋጋ እና ረዥም ጊዜ አላት
          { providerId, variantId: fadeId, priceOverride: 450, durationOverride: 90 },
          { providerId, variantId: hiddenId },
          { providerId: providerBId, variantId: fadeId },
          { providerId: providerBId, variantId: kidsId },
        ],
      });
    }, 60_000);

    it("lists only active styles in the service catalog", async () => {
      const res = await request(app).get("/api/services");
      expect(res.status).toBe(200);
      const styled = res.body.services.find((s: { id: string }) => s.id === styledId);
      expect(styled.variants.map((v: { name: string }) => v.name)).toEqual(["Fade", "Kids cut"]);
      const plain = res.body.services.find((s: { id: string }) => s.id === plainId);
      expect(plain.variants).toEqual([]);
    });

    it("lists the specialists for a style with their own price and duration", async () => {
      const res = await request(app).get("/api/providers").query({ serviceId: styledId, variantId: fadeId });
      expect(res.status).toBe(200);
      const find = (id: string) => res.body.providers.find((p: { id: string }) => p.id === id);
      const fadeOf = (p: { variants: { id: string }[] }) => p.variants.find((v) => v.id === fadeId);

      expect(fadeOf(find(providerId))).toMatchObject({ price: 450, durationMinutes: 90 });
      expect(fadeOf(find(providerBId))).toMatchObject({ price: 400, durationMinutes: 45 });
      expect(find(providerId).variants.map((v: { id: string }) => v.id)).not.toContain(hiddenId);

      const kids = await request(app).get("/api/providers").query({ serviceId: styledId, variantId: kidsId });
      const ids = kids.body.providers.map((p: { id: string }) => p.id);
      expect(ids).toContain(providerBId);
      expect(ids).not.toContain(providerId);
    });

    it("calculates availability from the style's duration and the specialist's override", async () => {
      const a = await availabilityFor(providerId, DATE_G, styledId, fadeId);
      expect(a.status).toBe(200);
      expect(a.body).toMatchObject({ durationMinutes: 90, price: 450 });
      expect(a.body.variant).toMatchObject({ id: fadeId, name: "Fade" });
      expect(a.body.slots).toHaveLength(16); // 08:00 - 15:30
      expect(a.body.slots[15].label).toBe("15:30");

      const b = await availabilityFor(providerBId, DATE_G, styledId, fadeId);
      expect(b.body).toMatchObject({ durationMinutes: 45, price: 400 });
      expect(b.body.slots).toHaveLength(17); // 08:00 - 16:00
      expect(b.body.slots[16].label).toBe("16:00");
    });

    it("requires a style when the service has styles, and rejects unknown ones", async () => {
      expect((await bookStyle(customer1Token, providerId, at(DATE_G, "09:00"), styledId)).status).toBe(400);
      expect((await availabilityFor(providerId, DATE_G, styledId)).status).toBe(400);

      // Selam "Kids cut" አትሰጥም
      expect((await bookStyle(customer1Token, providerId, at(DATE_G, "09:00"), styledId, kidsId)).status).toBe(404);
      // የተደበቀ ዘይቤ
      expect((await bookStyle(customer1Token, providerId, at(DATE_G, "09:00"), styledId, hiddenId)).status).toBe(404);
      // ዘይቤ በሌለው አገልግሎት ላይ ዘይቤ መላክ
      expect((await bookStyle(customer1Token, providerId, at(DATE_H, "08:00"), plainId, fadeId)).status).toBe(400);

      // ዘይቤ የሌለው አገልግሎት እንደ ድሮው ይያዛል
      const plain = await bookStyle(customer1Token, providerId, at(DATE_H, "08:00"), plainId);
      expect(plain.status).toBe(201);
      expect(plain.body.booking.variant).toBeNull();
      expect(plain.body.booking.priceAtBooking).toBe(100);
    });

    it("books a style with the specialist's own price and duration", async () => {
      const a = await bookStyle(customer1Token, providerId, at(DATE_G, "09:00"), styledId, fadeId);
      expect(a.status).toBe(201);
      expect(a.body.booking.priceAtBooking).toBe(450);
      expect(a.body.booking.variant).toMatchObject({ id: fadeId, name: "Fade" });
      expect(a.body.booking.endAt).toBe(at(DATE_G, "10:30")); // 90 ደቂቃ
      aBookingId = a.body.booking.id;

      const b = await bookStyle(customer2Token, providerBId, at(DATE_G, "09:00"), styledId, fadeId);
      expect(b.status).toBe(201);
      expect(b.body.booking.priceAtBooking).toBe(400);
      expect(b.body.booking.endAt).toBe(at(DATE_G, "09:45")); // 45 ደቂቃ
    });

    it("blocks every slot covered by the style's full duration", async () => {
      const res = await availabilityFor(providerId, DATE_G, plainId);
      expect(res.status).toBe(200);
      const labels: string[] = res.body.slots.map((s: { label: string }) => s.label);
      expect(labels).not.toContain("09:00");
      expect(labels).not.toContain("09:30");
      expect(labels).not.toContain("10:00");
      expect(labels).toContain("08:30");
      expect(labels).toContain("10:30");
    });

    it("keeps the booked price when the style price changes later", async () => {
      await prisma.serviceVariant.update({ where: { id: fadeId }, data: { price: 500 } });
      try {
        const mine = await request(app).get("/api/bookings/my").set(bearer(customer1Token));
        const row = mine.body.bookings.find((b: { id: string }) => b.id === aBookingId);
        expect(row.priceAtBooking).toBe(450);
      } finally {
        await prisma.serviceVariant.update({ where: { id: fadeId }, data: { price: 400 } });
      }
    });

    it("reschedules a style booking keeping its own length", async () => {
      const slots = await request(app)
        .get(`/api/bookings/${aBookingId}/availability`)
        .query({ date: DATE_G })
        .set(bearer(customer1Token));
      expect(slots.status).toBe(200);
      expect(slots.body.slots).toHaveLength(16); // የራሱ ቀጠሮ አይቆጠርም፣ 90 ደቂቃ ርዝመት

      const moved = await request(app)
        .patch(`/api/bookings/${aBookingId}/reschedule`)
        .set(bearer(customer1Token))
        .send({ startAt: at(DATE_G, "11:00") });
      expect(moved.status).toBe(200);
      expect(moved.body.booking.endAt).toBe(at(DATE_G, "12:30"));
      expect(moved.body.booking.priceAtBooking).toBe(450);
      expect(moved.body.booking.variant.name).toBe("Fade");
    });

    it("drops a specialist's styles when the service is removed from them", async () => {
      const res = await request(app)
        .put(`/api/providers/${providerBId}/services`)
        .set(bearer(adminToken))
        .send({ serviceIds: [] });
      expect(res.status).toBe(200);
      expect(await prisma.providerVariant.count({ where: { providerId: providerBId } })).toBe(0);
    });
  });
});
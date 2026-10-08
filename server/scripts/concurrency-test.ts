const BASE = "http://localhost:4000/api";
const headers = { "Content-Type": "application/json" };

async function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: npx tsx scripts/concurrency-test.ts 2026-10-12");
    process.exit(1);
  }

  const login: any = await (
    await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "test@example.com", password: "password123" }),
    })
  ).json();
  const token: string = login.token;

  const { providers }: any = await (await fetch(`${BASE}/providers`)).json();
  const provider = providers.find((p: any) => p.name.startsWith("Selam"));
  const service = provider.services.find((s: any) => s.name === "Haircut");

  const availability: any = await (
    await fetch(`${BASE}/providers/${provider.id}/availability?date=${date}&serviceId=${service.id}`)
  ).json();
  if (!availability.slots?.length) {
    console.error("No free slots on that date. Try another date.");
    process.exit(1);
  }
  const slot = availability.slots[0];
  console.log(`Booking slot ${slot.label} with 5 simultaneous requests...`);

  const results = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const res = await fetch(`${BASE}/bookings`, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ providerId: provider.id, serviceId: service.id, startAt: slot.start }),
      });
      return { status: res.status, body: await res.json() };
    }),
  );

  console.log("Statuses:", results.map((r) => r.status).join(", "));
  const created = results.filter((r) => r.status === 201).length;
  console.log(created === 1 ? "PASS: exactly one booking was created" : `FAIL: ${created} bookings created`);
}

main();
import { useEffect, useState } from "react";
import { getAdminStats, type AdminStats } from "../../lib/api";
import BarChart from "./BarChart";

const money = (n: number) => `${new Intl.NumberFormat("en-US").format(n)} ETB`;

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function Overview() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAdminStats(days)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  function changeDays(next: number) {
    setDays(next);
    setStats(null);
    setError("");
  }

  const topMax = Math.max(1, ...(stats?.topServices.map((s) => s.bookings) ?? [1]));

  return (
    <div>
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => changeDays(d)}
            className={`rounded-lg border px-3 py-1 text-sm ${
              days === d ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!stats && !error && <p className="mt-4 text-gray-500">Loading...</p>}

      {stats && (
        <div className="mt-4 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              label="Bookings"
              value={String(stats.totals.bookings)}
              hint={`${stats.totals.completed} completed · ${stats.totals.scheduled} scheduled`}
            />
            <Card label="Booked value" value={money(stats.totals.revenue)} hint="At the price when booked" />
            <Card
              label="Cancellation rate"
              value={`${(stats.totals.cancellationRate * 100).toFixed(1)}%`}
              hint={`${stats.totals.cancelled} cancelled`}
            />
            <Card
              label="No-show rate"
              value={`${(stats.totals.noShowRate * 100).toFixed(1)}%`}
              hint={`${stats.totals.noShow} of ${stats.totals.completed + stats.totals.noShow} finished appointments`}
            />
            <Card label="Upcoming" value={String(stats.upcoming)} hint="Confirmed, from now on" />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">Bookings per day</h2>
            <p className="mb-3 text-sm text-gray-500">
              {stats.from} to {stats.to}, by appointment date
            </p>
            <BarChart data={stats.perDay} />
            {stats.truncated && (
              <p className="mt-2 text-xs text-amber-700">Showing the first 10,000 bookings of this period only.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-semibold text-gray-900">Top services</h2>
              {stats.topServices.length === 0 && <p className="mt-2 text-sm text-gray-500">No bookings in this period.</p>}
              <ul className="mt-3 space-y-3">
                {stats.topServices.map((s) => (
                  <li key={s.id}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900">{s.name}</span>
                      <span className="text-gray-600">
                        {s.bookings} · {money(s.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-gray-100">
                      <div className="h-2 rounded bg-brand-700" style={{ width: `${(s.bookings / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-semibold text-gray-900">People</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Customers</dt>
                  <dd className="font-medium text-gray-900">{stats.users.customers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Specialists</dt>
                  <dd className="font-medium text-gray-900">{stats.users.providers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Admins</dt>
                  <dd className="font-medium text-gray-900">{stats.users.admins}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
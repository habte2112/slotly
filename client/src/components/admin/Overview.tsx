import { useEffect, useState } from "react";
import { getAdminStats, type AdminStats } from "../../lib/api";
import { useI18n } from "../../i18n/useI18n";
import BarChart from "./BarChart";

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
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  const money = (n: number) => t("adm.money", { n: new Intl.NumberFormat("en-US").format(n) });

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
            {t("adm.ov.lastDays", { d })}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!stats && !error && <p className="mt-4 text-gray-500">{t("adm.loading")}</p>}

      {stats && (
        <div className="mt-4 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              label={t("adm.ov.bookings")}
              value={String(stats.totals.bookings)}
              hint={t("adm.ov.bookingsHint", {
                completed: stats.totals.completed,
                scheduled: stats.totals.scheduled,
              })}
            />
            <Card label={t("adm.ov.value")} value={money(stats.totals.revenue)} hint={t("adm.ov.valueHint")} />
            <Card
              label={t("adm.ov.cancelRate")}
              value={`${(stats.totals.cancellationRate * 100).toFixed(1)}%`}
              hint={t("adm.ov.cancelHint", { n: stats.totals.cancelled })}
            />
            <Card
              label={t("adm.ov.noShowRate")}
              value={`${(stats.totals.noShowRate * 100).toFixed(1)}%`}
              hint={t("adm.ov.noShowHint", {
                n: stats.totals.noShow,
                total: stats.totals.completed + stats.totals.noShow,
              })}
            />
            <Card label={t("adm.ov.upcoming")} value={String(stats.upcoming)} hint={t("adm.ov.upcomingHint")} />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">{t("adm.ov.perDay")}</h2>
            <p className="mb-3 text-sm text-gray-500">{t("adm.ov.range", { from: stats.from, to: stats.to })}</p>
            <BarChart data={stats.perDay} />
            {stats.truncated && <p className="mt-2 text-xs text-amber-700">{t("adm.ov.truncated")}</p>}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-semibold text-gray-900">{t("adm.ov.top")}</h2>
              {stats.topServices.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">{t("adm.ov.noneInPeriod")}</p>
              )}
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
              <h2 className="font-semibold text-gray-900">{t("adm.ov.people")}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t("adm.ov.customers")}</dt>
                  <dd className="font-medium text-gray-900">{stats.users.customers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t("adm.ov.specialists")}</dt>
                  <dd className="font-medium text-gray-900">{stats.users.providers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t("adm.ov.admins")}</dt>
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
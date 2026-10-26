import { useEffect, useMemo, useState } from "react";
import { cancelBooking, getAdminBookings, type AdminBooking } from "../../lib/api";
import { useI18n } from "../../i18n/useI18n";
import { intlLocale } from "../../i18n/format";

const statusStyle: Record<AdminBooking["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
  NO_SHOW: "bg-red-100 text-red-800",
};

const statusKey = {
  PENDING: "adm.st.pending",
  CONFIRMED: "adm.st.confirmed",
  CANCELLED: "adm.st.cancelled",
  COMPLETED: "adm.st.completed",
  NO_SHOW: "adm.st.noShow",
} as const;

export default function AdminBookings() {
  const { t, locale } = useI18n();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale(locale), {
        timeZone: "Africa/Addis_Ababa",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  useEffect(() => {
    let cancelled = false;
    getAdminBookings(scope)
      .then((b) => {
        if (!cancelled) setBookings(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  function changeScope(next: "upcoming" | "past") {
    setScope(next);
    setBookings(null);
    setError("");
  }

  async function onCancel(id: string) {
    if (!window.confirm(t("adm.bk.confirmCancel"))) return;
    setBusyId(id);
    setError("");
    try {
      await cancelBooking(id);
      setBookings((list) => list?.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adm.bk.cancelFailed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {(["upcoming", "past"] as const).map((s) => (
          <button
            key={s}
            onClick={() => changeScope(s)}
            className={`rounded-lg border px-3 py-1 text-sm ${
              scope === s ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
          >
            {s === "upcoming" ? t("adm.bk.upcoming") : t("adm.bk.past")}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!bookings && !error && <p className="mt-4 text-gray-500">{t("adm.loading")}</p>}
      {bookings?.length === 0 && (
        <p className="mt-4 text-gray-600">{scope === "upcoming" ? t("adm.bk.noUpcoming") : t("adm.bk.noPast")}</p>
      )}

      <ul className="mt-4 space-y-3">
        {bookings?.map((b) => {
          const active = b.status === "PENDING" || b.status === "CONFIRMED";
          return (
            <li key={b.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  {b.variant ? `${b.service.name} · ${b.variant.name}` : b.service.name} · {b.provider.user.name}
                </p>
                <p className="text-sm text-gray-600">{formatter.format(new Date(b.startAt))}</p>
                <p className="text-sm text-gray-500">
                  {b.customer.name}
                  {b.customer.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${b.customer.phone}`} className="text-brand-700 hover:underline">
                        {b.customer.phone}
                      </a>
                    </>
                  )}
                  {!b.customer.isGuest && ` (${b.customer.email})`}
                </p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusStyle[b.status]}`}>
                  {t(statusKey[b.status])}
                </span>
              </div>
              {active && scope === "upcoming" && (
                <button
                  onClick={() => onCancel(b.id)}
                  disabled={busyId === b.id}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {busyId === b.id ? t("adm.bk.cancelling") : t("adm.bk.cancel")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
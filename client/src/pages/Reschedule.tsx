import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  getMyBookings,
  getRescheduleSlots,
  rescheduleBooking,
  type Booking,
  type Slot,
} from "../lib/api";
import { intlLocale, timeWithLocal } from "../i18n/format";
import { useI18n } from "../i18n/useI18n";

const TZ = "Africa/Addis_Ababa";

function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function maxDateInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000 + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function Reschedule() {
  const { t, locale } = useI18n();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [date, setDate] = useState(todayInAddis);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fmt = useMemo(() => {
    const l = intlLocale(locale);
    return {
      date: new Intl.DateTimeFormat(l, { timeZone: TZ, dateStyle: "medium" }),
      time: new Intl.DateTimeFormat(l, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    getMyBookings()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((b) => b.id === id) ?? null;
        if (!found) setLoadError(t("rs.notFound"));
        setBooking(found);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // t ከቋንቋ ጋር ይቀየራል፤ ቀጠሮውን እንደገና መጫን አያስፈልግም
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!booking) return;
    let cancelled = false;
    getRescheduleSlots(id, date)
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [booking, id, date, refreshKey]);

  function chooseDate(value: string) {
    if (!value) return;
    setDate(value);
    setSlots(null);
    setSelected(null);
    setError("");
  }

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await rescheduleBooking(id, selected.start);
      navigate("/my-bookings");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("rs.unavailable"));
        setSelected(null);
        setSlots(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!booking) return <p className="text-gray-500">{t("common.loading")}</p>;

  const movable =
    (booking.status === "PENDING" || booking.status === "CONFIRMED") && new Date(booking.startAt) > new Date();
  if (!movable) {
    return (
      <p className="text-gray-700">
        {t("rs.cannot")}{" "}
        <Link to="/my-bookings" className="underline">
          {t("rs.backMy")}
        </Link>
      </p>
    );
  }

  const current = new Date(booking.startAt);
  const separator = locale === "am" ? "፣ " : ", ";
  const currentWhen = `${fmt.date.format(current)}${separator}${timeWithLocal(locale, fmt.time.format(current))}`;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/my-bookings" className="text-sm text-gray-500 hover:text-gray-900">
          {t("rs.back")}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{t("rs.title")}</h1>
        <p className="text-gray-600">
          {t("rs.with", {
            service: booking.variant ? `${booking.service.name} · ${booking.variant.name}` : booking.service.name,
            provider: booking.provider.user.name,
          })}
        </p>
        <p className="text-sm text-gray-500">{t("rs.current", { when: currentWhen })}</p>
      </div>

      <section>
        <h2 className="font-semibold text-gray-900">{t("rs.step1")}</h2>
        <input
          type="date"
          value={date}
          min={todayInAddis()}
          max={maxDateInAddis()}
          onChange={(e) => chooseDate(e.target.value)}
          className="mt-3 rounded-lg border border-gray-300 p-2"
        />
      </section>

      <section>
        <h2 className="font-semibold text-gray-900">{t("rs.step2")}</h2>
        {slots === null && <p className="mt-2 text-gray-500">{t("mb.loadingTimes")}</p>}
        {slots?.length === 0 && <p className="mt-2 text-gray-500">{t("bk.noTimes")}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {slots?.map((s) => (
            <button
              key={s.start}
              onClick={() => setSelected(s)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                selected?.start === s.start
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-gray-300 bg-white hover:border-gray-500"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <button
          onClick={confirm}
          disabled={submitting}
          className="rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? t("my.saving") : t("rs.move", { date, time: timeWithLocal(locale, selected.label) })}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
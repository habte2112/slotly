import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelBooking, getMyBookings, type Booking } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import TelegramCard from "../components/TelegramCard";

const TZ = "Africa/Addis_Ababa";
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const statusStyle: Record<Booking["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  COMPLETED: "bg-sky-100 text-sky-800",
};

function BookingRow({
  b,
  busy,
  onCancel,
}: {
  b: Booking;
  busy: boolean;
  onCancel: (id: string) => void;
}) {
  const start = new Date(b.startAt);
  const end = new Date(b.endAt);
  const active = b.status === "PENDING" || b.status === "CONFIRMED";
  const upcoming = start > new Date();

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-800">
        <span className="text-lg font-bold leading-none">{dayFmt.format(start)}</span>
        <span className="text-xs uppercase">{monthFmt.format(start)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{b.service.name}</p>
        <p className="text-sm text-slate-600">with {b.provider.user.name}</p>
        <p className="text-sm text-slate-500">
          {weekdayFmt.format(start)}, {timeFmt.format(start)} – {timeFmt.format(end)} ·{" "}
          {b.priceAtBooking ?? b.service.price} ETB
        </p>
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[b.status]}`}>
          {b.status.toLowerCase()}
        </span>
      </div>

      {active && upcoming && (
        <div className="flex gap-2">
          <Link
            to={`/reschedule/${b.id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Reschedule
          </Link>
          <button
            onClick={() => onCancel(b.id)}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {busy ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      )}
    </li>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch((e) => setError(e.message));
  }, []);

  async function onCancel(id: string) {
    if (!window.confirm("Cancel this booking?")) return;
    setBusyId(id);
    setError("");
    try {
      const updated = await cancelBooking(id);
      setBookings((list) => list?.map((b) => (b.id === id ? updated : b)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusyId("");
    }
  }

  const now = new Date();
  const isUpcoming = (b: Booking) => (b.status === "PENDING" || b.status === "CONFIRMED") && new Date(b.startAt) > now;
  const upcoming = (bookings?.filter(isUpcoming) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const history = bookings?.filter((b) => !isUpcoming(b)) ?? [];

  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">My bookings</h1>
            <TelegramCard />

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {!bookings && !error && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {bookings?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-900">You have no bookings yet</p>
          <p className="mt-1 text-sm text-slate-600">Pick a service and book your first appointment.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Browse services
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold text-slate-900">Upcoming</h2>
          <ul className="mt-3 space-y-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} busy={busyId === b.id} onCancel={onCancel} />
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Past and cancelled</h2>
          <ul className="mt-3 space-y-3">
            {history.map((b) => (
              <BookingRow key={b.id} b={b} busy={busyId === b.id} onCancel={onCancel} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
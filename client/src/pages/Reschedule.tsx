import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  getMyBookings,
  getRescheduleSlots,
  rescheduleBooking,
  type Booking,
  type Slot,
} from "../lib/api";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Addis_Ababa",
  dateStyle: "medium",
  timeStyle: "short",
});

function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function Reschedule() {
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

  useEffect(() => {
    let cancelled = false;
    getMyBookings()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((b) => b.id === id) ?? null;
        if (!found) setLoadError("Booking not found");
        setBooking(found);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
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
        setError("Sorry, that time is no longer available. Please pick another one.");
        setSelected(null);
        setSlots(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!booking) return <p className="text-gray-500">Loading...</p>;

  const movable =
    (booking.status === "PENDING" || booking.status === "CONFIRMED") && new Date(booking.startAt) > new Date();
  if (!movable) {
    return (
      <p className="text-gray-700">
        This booking can no longer be rescheduled.{" "}
        <Link to="/my-bookings" className="underline">
          Back to my bookings
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/my-bookings" className="text-sm text-gray-500 hover:text-gray-900">
          ← My bookings
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Reschedule</h1>
        <p className="text-gray-600">
          {booking.service.name} with {booking.provider.user.name}
        </p>
        <p className="text-sm text-gray-500">Current time: {formatter.format(new Date(booking.startAt))}</p>
      </div>

      <section>
        <h2 className="font-semibold text-gray-900">1. Choose a new date</h2>
        <input
          type="date"
          value={date}
          min={todayInAddis()}
          onChange={(e) => chooseDate(e.target.value)}
          className="mt-3 rounded-lg border border-gray-300 p-2"
        />
      </section>

      <section>
        <h2 className="font-semibold text-gray-900">2. Choose a new time</h2>
        {slots === null && <p className="mt-2 text-gray-500">Loading times...</p>}
        {slots?.length === 0 && <p className="mt-2 text-gray-500">No free times on this day. Try another date.</p>}
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
          {submitting ? "Saving..." : `Move to ${date} at ${selected.label}`}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
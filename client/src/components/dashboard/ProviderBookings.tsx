import { useEffect, useState } from "react";
import { getProviderBookings, updateProviderBookingStatus, type ProviderBooking } from "../../lib/api";
import ManualBookingForm from "./ManualBookingForm";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Addis_Ababa",
  dateStyle: "medium",
  timeStyle: "short",
});

const statusStyle: Record<ProviderBooking["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
  NO_SHOW: "bg-red-100 text-red-800",
};

export default function ProviderBookings() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<ProviderBooking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getProviderBookings(scope)
      .then((b) => {
        if (!cancelled) setBookings(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, reloadKey]);

  function changeScope(next: "upcoming" | "past") {
    setScope(next);
    setBookings(null);
    setError("");
  }

  function onCreated() {
    setShowForm(false);
    setBookings(null);
    setError("");
    setScope("upcoming");
    setReloadKey((k) => k + 1);
  }

  async function onStatus(id: string, status: "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    if (status === "CANCELLED" && !window.confirm("Cancel this booking?")) return;
    if (status === "NO_SHOW" && !window.confirm("Mark this customer as a no-show?")) return;
    setBusyId(id);
    setError("");
    try {
      const updated = await updateProviderBookingStatus(id, status);
      setBookings((list) => list?.map((b) => (b.id === id ? updated : b)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update booking");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              onClick={() => changeScope(s)}
              className={`rounded-lg border px-3 py-1 text-sm capitalize ${
                scope === s ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white hover:bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand-700 px-3 py-1 text-sm font-medium text-white hover:bg-brand-800"
        >
          + Add booking
        </button>
      </div>

      {showForm && <ManualBookingForm onCreated={onCreated} onClose={() => setShowForm(false)} />}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!bookings && !error && <p className="mt-4 text-gray-500">Loading...</p>}
      {bookings?.length === 0 && <p className="mt-4 text-gray-600">No {scope} bookings.</p>}

      <ul className="mt-4 space-y-3">
        {bookings?.map((b) => {
          const active = b.status === "PENDING" || b.status === "CONFIRMED";
          const started = new Date(b.startAt) <= new Date();
          return (
            <li key={b.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  {b.variant ? `${b.service.name} · ${b.variant.name}` : b.service.name} · {b.customer.name}
                  {b.customer.noShows > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                      ⚠ {b.customer.noShows} no-show{b.customer.noShows > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">{formatter.format(new Date(b.startAt))}</p>
                {b.customer.phone && <p className="text-sm text-gray-500">{b.customer.phone}</p>}
                {b.notes && <p className="mt-1 text-sm italic text-gray-500">“{b.notes}”</p>}
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusStyle[b.status]}`}>
                  {b.status === "NO_SHOW" ? "no-show" : b.status.toLowerCase()}
                </span>
              </div>
              {active && (
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {started ? (
                    <>
                      <button
                        onClick={() => onStatus(b.id, "COMPLETED")}
                        disabled={busyId === b.id}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                      >
                        Mark completed
                      </button>
                      <button
                        onClick={() => onStatus(b.id, "NO_SHOW")}
                        disabled={busyId === b.id}
                        className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        No-show
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onStatus(b.id, "CANCELLED")}
                      disabled={busyId === b.id}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
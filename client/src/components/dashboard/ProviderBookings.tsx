import { useEffect, useState } from "react";
import { getProviderBookings, updateProviderBookingStatus, type ProviderBooking } from "../../lib/api";

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
};

export default function ProviderBookings() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<ProviderBooking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

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
  }, [scope]);

  function changeScope(next: "upcoming" | "past") {
    setScope(next);
    setBookings(null);
    setError("");
  }

  async function onStatus(id: string, status: "COMPLETED" | "CANCELLED") {
    if (status === "CANCELLED" && !window.confirm("Cancel this booking?")) return;
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
                </p>
                <p className="text-sm text-gray-600">{formatter.format(new Date(b.startAt))}</p>
                {b.customer.phone && <p className="text-sm text-gray-500">{b.customer.phone}</p>}
                {b.notes && <p className="mt-1 text-sm italic text-gray-500">“{b.notes}”</p>}
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusStyle[b.status]}`}>
                  {b.status.toLowerCase()}
                </span>
              </div>
              {active && (
                <button
                  onClick={() => onStatus(b.id, started ? "COMPLETED" : "CANCELLED")}
                  disabled={busyId === b.id}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {started ? "Mark completed" : "Cancel"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
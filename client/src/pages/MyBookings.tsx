import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cancelBooking, getMyBookings, type Booking } from "../lib/api";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Addis_Ababa",
  dateStyle: "medium",
  timeStyle: "short",
});

const statusStyle: Record<Booking["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
};

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

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">My bookings</h1>

      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!bookings && !error && <p className="mt-4 text-gray-500">Loading...</p>}
      {bookings?.length === 0 && (
        <p className="mt-4 text-gray-600">
          You have no bookings yet.{" "}
          <Link to="/" className="underline">
            Book your first appointment
          </Link>
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {bookings?.map((b) => {
          const active = b.status === "PENDING" || b.status === "CONFIRMED";
          const upcoming = new Date(b.startAt) > new Date();
          return (
            <li key={b.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <p className="font-medium text-gray-900">
                  {b.service.name} with {b.provider.user.name}
                </p>
                <p className="text-sm text-gray-600">{formatter.format(new Date(b.startAt))}</p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${statusStyle[b.status]}`}>
                  {b.status.toLowerCase()}
                </span>
              </div>
              {active && upcoming && (
                <button
                  onClick={() => onCancel(b.id)}
                  disabled={busyId === b.id}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {busyId === b.id ? "Cancelling..." : "Cancel"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
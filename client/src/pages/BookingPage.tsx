import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createBooking,
  getAvailability,
  getProviders,
  getServices,
  type Provider,
  type Service,
  type Slot,
} from "../lib/api";
import { useAuth } from "../context/auth-context";

// የአዲስ አበባ የዛሬ ቀን (UTC+3)
function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function BookingPage() {
  const { serviceId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [service, setService] = useState<Service | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(todayInAddis);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // አገልግሎቱን እና ባለሙያዎቹን ይጭናል
  useEffect(() => {
    let cancelled = false;
    Promise.all([getServices(), getProviders(serviceId)])
      .then(([services, provs]) => {
        if (cancelled) return;
        setService(services.find((s) => s.id === serviceId) ?? null);
        setProviders(provs);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  // ባለሙያ ወይም ቀን ሲቀየር ባዶ ሰዓቶችን ይጭናል
  useEffect(() => {
    if (!providerId || !date) return;
    let cancelled = false;
    getAvailability(providerId, serviceId, date)
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
  }, [providerId, date, serviceId, refreshKey]);

  function chooseProvider(id: string) {
    setProviderId(id);
    setSlots(null);
    setSelected(null);
    setError("");
  }

  function chooseDate(value: string) {
    if (!value) return;
    setDate(value);
    setSlots(null);
    setSelected(null);
    setError("");
  }

  async function confirm() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (!selected) return;

    setSubmitting(true);
    setError("");
    try {
      await createBooking({
        providerId,
        serviceId,
        startAt: selected.start,
        notes: notes.trim() || undefined,
      });
      navigate("/my-bookings");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // ሌላ ሰው ቀድሞ ይዞታል፤ ዝርዝሩን አድሰን እንደገና እንዲመርጥ እናደርጋለን
        setError("Sorry, that time was just taken. Please pick another one.");
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
  if (!providers) return <p className="text-gray-500">Loading...</p>;
  if (!service) {
    return (
      <p className="text-gray-700">
        Service not found.{" "}
        <Link to="/" className="underline">
          Back to services
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← All services
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{service.name}</h1>
        <p className="text-gray-600">
          {service.durationMinutes} min · {service.price} ETB
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-gray-900">1. Choose a specialist</h2>
        {providers.length === 0 && <p className="mt-2 text-gray-500">No specialists offer this service yet.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => chooseProvider(p.id)}
              className={`rounded-xl border p-4 text-left ${
                providerId === p.id ? "border-gray-900 bg-gray-100" : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              <p className="font-medium text-gray-900">{p.name}</p>
              <p className="mt-1 text-sm text-gray-600">{p.bio}</p>
            </button>
          ))}
        </div>
      </section>

      {providerId && (
        <section>
          <h2 className="font-semibold text-gray-900">2. Choose a date</h2>
          <input
            type="date"
            value={date}
            min={todayInAddis()}
            onChange={(e) => chooseDate(e.target.value)}
            className="mt-3 rounded-lg border border-gray-300 p-2"
          />
        </section>
      )}

      {providerId && (
        <section>
          <h2 className="font-semibold text-gray-900">3. Choose a time</h2>
          {slots === null && <p className="mt-2 text-gray-500">Loading times...</p>}
          {slots?.length === 0 && (
            <p className="mt-2 text-gray-500">No free times on this day. Try another date.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {slots?.map((s) => (
              <button
                key={s.start}
                onClick={() => setSelected(s)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  selected?.start === s.start
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white hover:border-gray-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">4. Confirm</h2>
          <p className="mt-2 text-gray-700">
            {service.name} on <span className="font-medium">{date}</span> at{" "}
            <span className="font-medium">{selected.label}</span>
          </p>
          <textarea
            placeholder="Notes (optional)"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-3 w-full rounded-lg border border-gray-300 p-2"
            rows={2}
          />
          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Booking..." : user ? "Confirm booking" : "Log in to confirm"}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
import { useEffect, useState, type ReactNode } from "react";
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
import Avatar from "../components/ui/Avatar";
import ServiceIcon from "../components/ui/ServiceIcon";
import Skeleton from "../components/ui/Skeleton";

// የአዲስ አበባ የዛሬ ቀን (UTC+3)
function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function prettyDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

const PARTS = [
  { label: "Morning", match: (h: number) => h < 12 },
  { label: "Afternoon", match: (h: number) => h >= 12 && h < 17 },
  { label: "Evening", match: (h: number) => h >= 17 },
];

// label ሁልጊዜ "HH:MM" የአዲስ አበባ ሰዓት ነው
const hourOf = (slot: Slot) => parseInt(slot.label.slice(0, 2), 10);

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-semibold text-slate-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-sm text-white">
        {n}
      </span>
      {children}
    </h2>
  );
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

  if (!providers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <p className="text-slate-700">
        Service not found.{" "}
        <Link to="/" className="underline">
          Back to services
        </Link>
      </p>
    );
  }

  const provider = providers.find((p) => p.id === providerId);

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← All services
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ServiceIcon name={service.name} className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{service.name}</h1>
            <p className="text-slate-600">
              {service.durationMinutes} min · {service.price} ETB
            </p>
          </div>
        </div>
      </div>

      <section>
        <StepTitle n={1}>Choose a specialist</StepTitle>
        {providers.length === 0 && <p className="mt-3 text-slate-500">No specialists offer this service yet.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => chooseProvider(p.id)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                providerId === p.id
                  ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                  : "border-slate-200 bg-white hover:border-brand-300"
              }`}
            >
              <Avatar name={p.name} className="h-11 w-11 text-base" />
              <span>
                <span className="block font-medium text-slate-900">{p.name}</span>
                <span className="mt-0.5 block text-sm text-slate-600">{p.bio}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {providerId && (
        <section>
          <StepTitle n={2}>Choose a date</StepTitle>
          <input
            type="date"
            value={date}
            min={todayInAddis()}
            onChange={(e) => chooseDate(e.target.value)}
            className="mt-4 rounded-lg border border-slate-300 bg-white p-2"
          />
        </section>
      )}

      {providerId && (
        <section>
          <StepTitle n={3}>Choose a time</StepTitle>

          {slots === null && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-20" />
              ))}
            </div>
          )}

          {slots?.length === 0 && (
            <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
              No free times on this day. Try another date.
            </p>
          )}

          {slots && slots.length > 0 && (
            <div className="mt-4 space-y-4">
              {PARTS.map((part) => {
                const inPart = slots.filter((s) => part.match(hourOf(s)));
                if (inPart.length === 0) return null;
                return (
                  <div key={part.label}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{part.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {inPart.map((s) => (
                        <button
                          key={s.start}
                          onClick={() => setSelected(s)}
                          className={`rounded-lg border px-3 py-2 text-sm transition ${
                            selected?.start === s.start
                              ? "border-brand-700 bg-brand-700 text-white"
                              : "border-slate-300 bg-white text-slate-800 hover:border-brand-600 hover:text-brand-700"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {selected && (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <StepTitle n={4}>Confirm</StepTitle>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Service</dt>
              <dd className="font-medium text-slate-900">{service.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Specialist</dt>
              <dd className="font-medium text-slate-900">{provider?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">When</dt>
              <dd className="font-medium text-slate-900">
                {prettyDate(date)} at {selected.label}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Price</dt>
              <dd className="font-medium text-slate-900">{service.price} ETB</dd>
            </div>
          </dl>
          <textarea
            placeholder="Notes (optional)"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white p-2"
            rows={2}
          />
          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-3 rounded-lg bg-brand-700 px-5 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {submitting ? "Booking..." : user ? "Confirm booking" : "Log in to confirm"}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
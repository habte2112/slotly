import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createBooking,
  getAvailability,
  getProviders,
  getRatingsSummary,
  getServices,
  type RatingInfo,
  type Provider,
  type ProviderStyle,
  type Service,
  type Slot,
  type Style,
} from "../lib/api";
import { useAuth } from "../context/auth-context";
import Avatar from "../components/ui/Avatar";
import ServiceIcon from "../components/ui/ServiceIcon";
import Skeleton from "../components/ui/Skeleton";
import StyleImage from "../components/ui/StyleImage";
import { RatingBadge } from "../components/ui/Rating";
import { intlLocale, timeWithLocal } from "../i18n/format";
import type { Locale } from "../i18n/context";
import { useI18n } from "../i18n/useI18n";

// የአዲስ አበባ የዛሬ ቀን (UTC+3)
function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function maxDateInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000 + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function prettyDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

const PARTS = [
  { labelKey: "part.morning", match: (h: number) => h < 12 },
  { labelKey: "part.afternoon", match: (h: number) => h >= 12 && h < 17 },
  { labelKey: "part.evening", match: (h: number) => h >= 17 },
] as const;

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
  const { t, locale } = useI18n();
  const { serviceId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [service, setService] = useState<Service | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingInfo>>({});
  const [loadError, setLoadError] = useState("");

  const [styleId, setStyleId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(todayInAddis);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [terms, setTerms] = useState<{ durationMinutes: number; price: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // አገልግሎቱን እና ባለሙያዎቹን ይጭናል
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getServices(),
      getProviders(serviceId),
      getRatingsSummary().catch((): Record<string, RatingInfo> => ({})),
    ])
      .then(([services, provs, rs]) => {
        if (cancelled) return;
        setService(services.find((s) => s.id === serviceId) ?? null);
        setProviders(provs);
        setRatings(rs);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const styles: Style[] = service?.variants ?? [];
  const hasStyles = styles.length > 0;
  const style = styles.find((s) => s.id === styleId) ?? null;

  // ዘይቤው የሚፈለግ ከሆነ ባለሙያዎቹ ያንን ዘይቤ የሚሰጡት ብቻ ናቸው
  const eligible = (providers ?? []).filter((p) =>
    hasStyles ? p.variants.some((v) => v.id === styleId && v.serviceId === serviceId) : true,
  );
  const provider = eligible.find((p) => p.id === providerId) ?? null;
  const styleOf = (p: Provider): ProviderStyle | undefined => p.variants.find((v) => v.id === styleId);

  // ባለሙያ፣ ዘይቤ ወይም ቀን ሲቀየር ባዶ ሰዓቶችን ይጭናል
  useEffect(() => {
    if (!providerId || !date || (hasStyles && !styleId)) return;
    let cancelled = false;
    getAvailability(providerId, serviceId, date, hasStyles ? styleId : undefined)
      .then((a) => {
        if (cancelled) return;
        setSlots(a.slots);
        setTerms({ durationMinutes: a.durationMinutes, price: a.price });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, date, serviceId, styleId, hasStyles, refreshKey]);

  function resetSelection() {
    setSlots(null);
    setTerms(null);
    setSelected(null);
    setError("");
  }

  function chooseStyle(id: string) {
    setStyleId(id);
    setProviderId("");
    resetSelection();
  }

  function chooseProvider(id: string) {
    setProviderId(id);
    resetSelection();
  }

  function chooseDate(value: string) {
    if (!value) return;
    setDate(value);
    resetSelection();
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
        variantId: hasStyles ? styleId : undefined,
        startAt: selected.start,
        notes: notes.trim() || undefined,
      });
      navigate("/my-bookings");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // ሌላ ሰው ቀድሞ ይዞታል፤ ዝርዝሩን አድሰን እንደገና እንዲመርጥ እናደርጋለን
        setError(t("bk.taken"));
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

  if (!providers || !service) {
    if (providers && !service) {
      return (
        <p className="text-slate-700">
          {t("bk.notFound")}{" "}
          <Link to="/" className="underline">
            {t("bk.backToServices")}
          </Link>
        </p>
      );
    }
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

  const specialistStep = hasStyles ? 2 : 1;
  const dateStep = specialistStep + 1;
  const timeStep = dateStep + 1;
  const confirmStep = timeStep + 1;
  const showSpecialists = !hasStyles || Boolean(styleId);

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
          {t("bk.allServices")}
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ServiceIcon name={service.name} className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{service.name}</h1>
            {!hasStyles && (
              <p className="text-slate-600">
                {t("bk.minPrice", { min: service.durationMinutes, price: service.price })}
              </p>
            )}
          </div>
        </div>
      </div>

      {hasStyles && (
        <section>
          <StepTitle n={1}>{t("bk.chooseStyle")}</StepTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseStyle(s.id)}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  styleId === s.id
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : "border-slate-200 bg-white hover:border-brand-300"
                }`}
              >
                <StyleImage src={s.imageUrl} alt={s.name} serviceName={service.name} className="h-32 w-full" />
                <span className="block p-3">
                  <span className="block font-medium text-slate-900">{s.name}</span>
                  {s.description && <span className="mt-0.5 block text-sm text-slate-600">{s.description}</span>}
                  <span className="mt-2 block text-sm text-slate-700">
                    {t("bk.styleLine", { min: s.durationMinutes, price: s.price })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {showSpecialists && (
        <section>
          <StepTitle n={specialistStep}>{t("bk.chooseSpecialist")}</StepTitle>
          {eligible.length === 0 && (
            <p className="mt-3 text-slate-500">{hasStyles ? t("bk.noSpecStyle") : t("bk.noSpecService")}</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {eligible.map((p) => {
              const own = hasStyles ? styleOf(p) : undefined;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-4 transition ${
                    providerId === p.id
                      ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                      : "border-slate-200 bg-white hover:border-brand-300"
                  }`}
                >
                  <button onClick={() => chooseProvider(p.id)} className="flex w-full items-start gap-3 text-left">
                    <Avatar name={p.name} className="h-11 w-11 text-base" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{p.name}</span>
                      <RatingBadge info={ratings[p.id]} />
                      <span className="mt-0.5 block text-sm text-slate-600">{p.bio}</span>
                      {own && (
                        <span className="mt-2 block text-sm font-medium text-brand-700">
                          {t("bk.priceMin", { price: own.price, min: own.durationMinutes })}
                        </span>
                      )}
                    </span>
                  </button>
                  <Link
                    to={`/specialists/${p.id}`}
                    className="mt-2 inline-block text-xs text-slate-500 underline hover:text-slate-900"
                  >
                    {t("bk.viewProfile")}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {providerId && (
        <section>
          <StepTitle n={dateStep}>{t("bk.chooseDate")}</StepTitle>
          <input
            type="date"
            value={date}
            min={todayInAddis()}
            max={maxDateInAddis()}
            onChange={(e) => chooseDate(e.target.value)}
            className="mt-4 rounded-lg border border-slate-300 bg-white p-2"
          />
        </section>
      )}

      {providerId && (
        <section>
          <StepTitle n={timeStep}>{t("bk.chooseTime")}</StepTitle>

          {slots === null && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-20" />
              ))}
            </div>
          )}

          {slots?.length === 0 && (
            <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">{t("bk.noTimes")}</p>
          )}

          {slots && slots.length > 0 && (
            <div className="mt-4 space-y-4">
              {PARTS.map((part) => {
                const inPart = slots.filter((s) => part.match(hourOf(s)));
                if (inPart.length === 0) return null;
                return (
                  <div key={part.labelKey}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t(part.labelKey)}
                    </p>
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

      {selected && terms && (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <StepTitle n={confirmStep}>{t("bk.confirm")}</StepTitle>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("bk.service")}</dt>
              <dd className="font-medium text-slate-900">{style ? `${service.name} · ${style.name}` : service.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("bk.specialist")}</dt>
              <dd className="font-medium text-slate-900">{provider?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("bk.when")}</dt>
              <dd className="font-medium text-slate-900">
              {t("bk.whenValue", { date: prettyDate(date, locale), time: timeWithLocal(locale, selected.label) })}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("bk.durationPrice")}</dt>
              <dd className="font-medium text-slate-900">
                {t("bk.minPrice", { min: terms.durationMinutes, price: terms.price })}
              </dd>
            </div>
          </dl>
          <textarea
            placeholder={t("bk.notesPh")}
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
            {submitting ? t("bk.booking") : user ? t("bk.confirmBooking") : t("bk.loginToConfirm")}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
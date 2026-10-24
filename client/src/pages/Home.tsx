import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getServices, type Service } from "../lib/api";
import { useI18n } from "../i18n/useI18n";
import ServiceIcon from "../components/ui/ServiceIcon";
import Skeleton from "../components/ui/Skeleton";

const STEPS = [
  { title: "home.step1.title", text: "home.step1.text" },
  { title: "home.step2.title", text: "home.step2.text" },
  { title: "home.step3.title", text: "home.step3.text" },
] as const;

export default function Home() {
  const { t } = useI18n();
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getServices()
      .then((s) => {
        if (!cancelled) setServices(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setSlow(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // ነጻው የ hosting ዕቅድ ሲተኛ መጀመሪያው ጥያቄ ረጅም ጊዜ ይወስዳል
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  function retry() {
    setError("");
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-brand-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-600/40" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-brand-900/60" />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-200">{t("home.badge")}</p>
          <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight sm:text-5xl">{t("home.title")}</h1>
          <p className="mt-4 max-w-xl text-brand-100">{t("home.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#services" className="rounded-lg bg-white px-5 py-3 font-medium text-brand-800 hover:bg-brand-50">
              {t("home.browse")}
            </a>
            <Link
              to="/register"
              className="rounded-lg border border-white/40 px-5 py-3 font-medium text-white hover:bg-white/10"
            >
              {t("home.create")}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100">
            <li>{t("home.feat1")}</li>
            <li>{t("home.feat2")}</li>
            <li>{t("home.feat3")}</li>
            <li>{t("home.feat4")}</li>
          </ul>
        </div>
      </section>

      <section id="services" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-slate-900">{t("home.servicesTitle")}</h2>
        <p className="mt-1 text-slate-600">{t("home.servicesSub")}</p>

        {loading && slow && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("home.waking")}</p>
        )}

        {error && !loading && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            <button onClick={retry} className="font-medium underline">
              {t("home.retry")}
            </button>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <p className="mt-6 text-slate-600">{t("home.noServices")}</p>
        )}

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Skeleton className="h-11 w-11" />
                <Skeleton className="mt-4 h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-6 h-10 w-full" />
              </li>
            ))}

          {services.map((s) => (
            <li
              key={s.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <ServiceIcon name={s.name} />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{s.name}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{s.description}</p>
              {s.variants.length > 0 && (
                <p className="mt-3 text-xs font-medium text-brand-700">
                  {t("home.styles", { count: s.variants.length })}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-sm">
                {s.variants.length > 0 ? (
                  <>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      {t("home.fromMin", { min: Math.min(...s.variants.map((v) => v.durationMinutes)) })}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {t("home.fromPrice", { price: Math.min(...s.variants.map((v) => v.price)) })}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      {t("home.min", { min: s.durationMinutes })}
                    </span>
                    <span className="font-semibold text-slate-900">{t("home.price", { price: s.price })}</span>
                  </>
                )}
              </div>
              <Link
                to={`/book/${s.id}`}
                className="mt-4 rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-800"
              >
                {t("home.book")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-slate-900">{t("home.howTitle")}</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{t(step.title)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(step.text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
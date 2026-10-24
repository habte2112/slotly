import type { Locale } from "../i18n/context";
import { useI18n } from "../i18n/useI18n";

const OPTIONS: { id: Locale; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "am", label: "አማ" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="flex overflow-hidden rounded-lg border border-slate-300 text-xs"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLocale(o.id)}
          aria-pressed={locale === o.id}
          className={`px-2.5 py-1.5 ${
            locale === o.id ? "bg-brand-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
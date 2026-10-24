import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { am } from "./am";
import { I18nContext, type I18n, type Locale } from "./context";
import { en, type Messages } from "./en";

const DICTS: Record<Locale, Messages> = { en, am };
const KEY = "slotly_locale";

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "am") return saved;
  } catch {
    /* ችላ በል */
  }
  return navigator.language?.toLowerCase().startsWith("am") ? "am" : "en";
}

export default function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ችላ በል */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<I18n["t"]>(
    (key, params) => {
      let text: string = DICTS[locale][key] ?? en[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
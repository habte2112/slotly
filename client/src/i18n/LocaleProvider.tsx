import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type I18n, type Locale } from "./context";
import { setCurrentLocale } from "./errors";
import { translate } from "./translate";

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
  const [locale, setLocaleState] = useState<Locale>(() => {
    const first = initialLocale();
    setCurrentLocale(first); // የ API ስህተት ተርጓሚው ከመጀመሪያው ጥያቄ በፊት ቋንቋውን ያውቃል
    return first;
  });

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
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

  const t = useCallback<I18n["t"]>((key, params) => translate(locale, key, params), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
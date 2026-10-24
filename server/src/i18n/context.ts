import { createContext } from "react";
import type { Messages } from "./en";

export type Locale = "en" | "am";

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Messages, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18n | null>(null);
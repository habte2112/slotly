import { am } from "./am";
import type { Locale } from "./context";
import { en, type Messages } from "./en";

const DICTS: Record<Locale, Messages> = { en, am };

// ከ React ውጭም ጥቅም ላይ ይውላል (ለምሳሌ ከአገልጋይ የሚመጡ ስህተቶች)
export function translate(locale: Locale, key: keyof Messages, params?: Record<string, string | number>): string {
  const text: string = DICTS[locale][key] ?? en[key] ?? key;
  if (!params) return text;
  // ሁሉም ቁልፎች በአንድ ጊዜ ይተካሉ፣ ስለዚህ በስም ውስጥ ያለ "{...}" በስህተት አይተካም
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
import type { Locale } from "./context";

// ለ Intl የቋንቋ ኮድ፤ የአማርኛ ወራት በግሪጎሪያን ካሌንደር ይታያሉ
export const intlLocale = (locale: Locale) => (locale === "am" ? "am-ET" : "en-GB");

// "HH:MM" (24 ሰዓት) → የኢትዮጵያ ሰዓት አቆጣጠር (የ6 ሰዓት ልዩነት)፤ 10:00 → "ጠዋት 4 ሰዓት"
export function ethiopianTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = (h + 6) % 12 || 12;
  const period = h >= 6 && h < 12 ? "ጠዋት" : h >= 12 && h < 18 ? "ቀን" : h >= 18 ? "ማታ" : "ሌሊት";
  return `${period} ${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ሰዓት`;
}

// በአማርኛ ሁነታ ብቻ የኢትዮጵያን ሰዓት በቅንፍ ይጨምራል፤ በእንግሊዝኛ እንዳለ ይመለሳል
export function timeWithLocal(locale: Locale, hhmm: string): string {
  return locale === "am" ? `${hhmm} (${ethiopianTime(hhmm)})` : hhmm;
}
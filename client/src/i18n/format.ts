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

const ADDIS = "Africa/Addis_Ababa";
const hhmmFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ADDIS,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ቀንና ሰዓት (የአዲስ አበባ ሰዓት)፤ አማርኛ ሞድ ላይ ሰዓቱ ከኢትዮጵያ ሰዓት ጋር
// እንግሊዝኛ: "26 Oct 2026, 10:00" · አማርኛ: "<ቀን>, 10:00 (ጠዋት 4 ሰዓት)"
export function dateTimeWithLocal(locale: Locale, value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (locale !== "am") {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone: ADDIS,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }
  const date = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ADDIS, dateStyle: "medium" }).format(d);
  return `${date}, ${timeWithLocal(locale, hhmmFormat.format(d))}`;
}
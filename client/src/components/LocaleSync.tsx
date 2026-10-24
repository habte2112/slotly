import { useEffect } from "react";
import { useAuth } from "../context/auth-context";
import { useI18n } from "../i18n/useI18n";
import { saveLocale } from "../lib/api";

// ተጠቃሚው ሲገባ ወይም ቋንቋ ሲቀይር ምርጫውን ለአገልጋዩ ይልካል፤ ቴሌግራም በዚያ ቋንቋ ይጽፋል
export default function LocaleSync() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    saveLocale(locale).catch(() => {
      /* ማሳወቂያዎች በነባሪ ቋንቋ ይቀጥላሉ፤ ገጹን አያበላሽም */
    });
  }, [userId, locale]);

  return null;
}
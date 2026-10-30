import type { Locale } from "./context";
import type { Messages } from "./en";
import { translate } from "./translate";

let current: Locale = "en";
export const setCurrentLocale = (locale: Locale) => {
  current = locale;
};

// የአገልጋዩ ትክክለኛ የእንግሊዝኛ ጽሑፍ → የትርጉም ቁልፍ
const EXACT: Record<string, keyof Messages> = {
  "Missing token": "err.session",
  "Invalid or expired token": "err.session",
  "Session expired. Please log in again.": "err.session",
  Forbidden: "err.forbidden",
  "Invalid input": "err.invalidInput",
  "Email already registered": "err.emailTaken",
  "Invalid email or password": "err.badLogin",
  "Booking not found": "err.bookingNotFound",
  "This time slot is not available": "err.slotUnavailable",
  "This time slot was just taken": "err.slotTaken",
  "Cannot cancel a booking that already started": "err.cancelStarted",
  "Cannot reschedule a booking that already started": "err.rescheduleStarted",
  "Please choose a different time": "err.differentTime",
  "This service is no longer available": "err.serviceGone",
  "Cannot mark a booking that has not started yet": "err.notStartedYet",
  "Please enter a valid phone number": "err.badPhone",
  "End time must be after start time": "err.endAfterStart",
  "End must be after start": "err.endAfterStart",
  "Working hours on the same day must not overlap": "err.hoursOverlap",
  "Time off not found": "err.timeOffNotFound",
  "Provider profile not found": "err.providerMissing",
  "This reset link is invalid or has expired": "err.resetInvalid",
  "Current password is incorrect": "err.wrongCurrent",
  "New password must be different from the current one": "err.samePassword",
  "Request failed": "err.generic",
};

const STATUS_KEYS = {
  cancelled: "status.CANCELLED",
  completed: "status.COMPLETED",
  no_show: "status.NO_SHOW",
} as const;

// እንግሊዝኛ ሁነታ ላይ የአገልጋዩ ጽሑፍ እንዳለ ይመለሳል፤ የማይታወቅ መልዕክትም እንዳለ ይመለሳል
export function translateServerError(message: string): string {
  if (current === "en") return message;

  const key = EXACT[message];
  if (key) return translate(current, key);

  const already = /^Booking is already (cancelled|completed|no_show)$/.exec(message);
  if (already) {
    const status = translate(current, STATUS_KEYS[already[1] as keyof typeof STATUS_KEYS]);
    return translate(current, "err.alreadyStatus", { status });
  }

  const conflict = /^You have (\d+) booking\(s\) in this period\. Cancel them first\.$/.exec(message);
  if (conflict) return translate(current, "err.timeOffConflict", { count: conflict[1] });

  return message;
}
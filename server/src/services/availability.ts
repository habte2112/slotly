export const TIMEZONE = "Africa/Addis_Ababa";
// ኢትዮጵያ የበጋ/ክረምት ሰዓት ለውጥ (DST) ስለሌላት ቋሚ UTC+3 ነው
const OFFSET_MS = 3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WorkingWindow {
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface Slot {
  start: Date;
  end: Date;
  label: string; // የአካባቢ ሰዓት፣ ለምሳሌ "08:30"
}

function splitDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = splitDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 0 = እሑድ ... 6 = ቅዳሜ (ከ schema ጋር ተመሳሳይ) */
export function dayOfWeek(date: string): number {
  const [y, m, d] = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** የአካባቢ ቀን እና ደቂቃ (ከእኩለ ሌሊት) ወደ UTC Date ይቀይራል */
function localToUtc(date: string, minutesFromMidnight: number): Date {
  const [y, m, d] = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d, 0, minutesFromMidnight) - OFFSET_MS);
}

export function dayBoundsUtc(date: string): TimeRange {
  return { start: localToUtc(date, 0), end: localToUtc(date, 24 * 60) };
}

function formatLocalTime(d: Date): string {
  const local = new Date(d.getTime() + OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && a.end > b.start;
}

export interface AvailabilityInput {
  date: string; // "YYYY-MM-DD" (የአካባቢ ቀን)
  windows: WorkingWindow[]; // ለዚያ ቀን የሚሰራባቸው ሰዓቶች (ምሳሌ ከምሳ እረፍት ጋር ሁለት)
  durationMinutes: number;
  busy: TimeRange[]; // ቀጠሮዎች እና እረፍት
  now?: Date;
  stepMinutes?: number; // slot የሚጀምርበት ክፍተት (ነባሪ 30)
}

export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const { date, windows, durationMinutes, busy, now = new Date(), stepMinutes = 30 } = input;
  const durationMs = durationMinutes * MINUTE_MS;
  const stepMs = stepMinutes * MINUTE_MS;

  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const w of windows) {
    const windowStart = localToUtc(date, parseTime(w.startTime)).getTime();
    const windowEnd = localToUtc(date, parseTime(w.endTime)).getTime();

    for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
      if (seen.has(t)) continue;
      const slot: TimeRange = { start: new Date(t), end: new Date(t + durationMs) };

      if (slot.start < now) continue;
      if (busy.some((b) => overlaps(slot, b))) continue;

      seen.add(t);
      slots.push({ ...slot, label: formatLocalTime(slot.start) });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
import { describe, it, expect } from "vitest";
import { computeAvailableSlots, dayOfWeek, isValidDateString } from "./availability";

const DATE = "2026-10-12"; // ሰኞ
const FULL_DAY = [{ startTime: "08:00", endTime: "17:00" }];
const LONG_AGO = new Date("2026-01-01T00:00:00Z");

// "10:00" የአካባቢ ሰዓት (UTC+3) ወደ Date
const local = (time: string) => new Date(`${DATE}T${time}:00+03:00`);

function run(overrides: Partial<Parameters<typeof computeAvailableSlots>[0]> = {}) {
  return computeAvailableSlots({
    date: DATE,
    windows: FULL_DAY,
    durationMinutes: 30,
    busy: [],
    now: LONG_AGO,
    ...overrides,
  });
}

const labels = (slots: { label: string }[]) => slots.map((s) => s.label);

describe("computeAvailableSlots", () => {
  it("returns every 30-minute slot on a free day", () => {
    const slots = run();
    expect(slots).toHaveLength(18);
    expect(slots[0].label).toBe("08:00");
    expect(slots[slots.length - 1].label).toBe("16:30");
  });

  it("converts Addis Ababa time (UTC+3) to UTC", () => {
    const [first] = run();
    expect(first.start.toISOString()).toBe("2026-10-12T05:00:00.000Z");
    expect(first.end.toISOString()).toBe("2026-10-12T05:30:00.000Z");
  });

  it("removes a booked slot but keeps adjacent ones", () => {
    const result = labels(run({ busy: [{ start: local("10:00"), end: local("10:30") }] }));
    expect(result).not.toContain("10:00");
    expect(result).toContain("09:30");
    expect(result).toContain("10:30");
  });

  it("blocks every slot whose duration overlaps a booking", () => {
    const result = labels(
      run({ durationMinutes: 90, busy: [{ start: local("10:00"), end: local("10:30") }] }),
    );
    expect(result).toContain("08:30"); // 08:30-10:00 ይነካካል ግን አይደራረብም
    expect(result).not.toContain("09:00");
    expect(result).not.toContain("09:30");
    expect(result).not.toContain("10:00");
    expect(result).toContain("10:30");
    expect(result[result.length - 1]).toBe("15:30"); // 15:30-17:00 የመጨረሻው
  });

  it("respects a lunch break (two working windows)", () => {
    const result = labels(
      run({
        durationMinutes: 60,
        windows: [
          { startTime: "08:00", endTime: "12:00" },
          { startTime: "13:00", endTime: "17:00" },
        ],
      }),
    );
    expect(result).toHaveLength(14);
    expect(result).toContain("11:00");
    expect(result).not.toContain("11:30"); // 11:30-12:30 ከእረፍት ጋር ይደራረባል
    expect(result).not.toContain("12:00");
    expect(result).toContain("13:00");
  });

  it("removes slots in the past", () => {
    expect(run({ now: local("10:00") })[0].label).toBe("10:00");
    expect(run({ now: local("10:10") })[0].label).toBe("10:30");
  });

  it("returns nothing when the provider is on time off all day", () => {
    expect(run({ busy: [{ start: local("00:00"), end: local("23:59") }] })).toEqual([]);
  });

  it("returns nothing when the day is fully booked", () => {
    expect(run({ busy: [{ start: local("08:00"), end: local("17:00") }] })).toEqual([]);
  });

  it("returns nothing when the service is longer than the working window", () => {
    expect(run({ durationMinutes: 600 })).toEqual([]);
  });

  it("returns nothing when there are no working hours", () => {
    expect(run({ windows: [] })).toEqual([]);
  });
});

describe("date helpers", () => {
  it("computes the day of week (0 = Sunday)", () => {
    expect(dayOfWeek("2026-10-11")).toBe(0);
    expect(dayOfWeek("2026-10-12")).toBe(1);
    expect(dayOfWeek("2026-10-10")).toBe(6);
  });

  it("validates date strings", () => {
    expect(isValidDateString("2026-10-12")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("12-10-2026")).toBe(false);
  });
});
import { describe, expect, it } from "vitest";
import { MESSAGES, ethiopianTime, formatWhen, tg, type MessageKey } from "./telegram-messages";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("telegram messages", () => {
  it("Amharic uses the same placeholders as English", () => {
    for (const key of Object.keys(MESSAGES.en) as MessageKey[]) {
      expect(placeholders(MESSAGES.am[key]), key).toEqual(placeholders(MESSAGES.en[key]));
    }
  });

  it("fills placeholders in a single pass", () => {
    expect(tg("en", "booking.title", { service: "{provider}", provider: "Abebe" })).toBe("{provider} with Abebe");
  });

  it("keeps the English wording unchanged", () => {
    expect(tg("en", "bot.cancelConfirm", { service: "Haircut", when: "Mon" })).toBe("Cancel <b>Haircut</b> on Mon?");
  });

  it("formats English times in Addis Ababa time", () => {
    expect(formatWhen("en", "time", new Date("2026-10-24T12:00:00Z"))).toBe("15:00");
  });

  it("shows the Ethiopian clock next to the time in Amharic", () => {
    expect(formatWhen("am", "time", new Date("2026-10-24T12:00:00Z"))).toBe("15:00 (ቀን 9 ሰዓት)");
    expect(formatWhen("am", "full", new Date("2026-10-24T12:00:00Z"))).toContain("15:00 (ቀን 9 ሰዓት)");
  });

  it("handles midnight in Addis time", () => {
    expect(formatWhen("am", "time", new Date("2026-10-24T21:00:00Z"))).toBe("00:00 (ሌሊት 6 ሰዓት)");
  });

  it("converts 24-hour time to the Ethiopian clock", () => {
    expect(ethiopianTime("06:00")).toBe("ጠዋት 12 ሰዓት");
    expect(ethiopianTime("10:00")).toBe("ጠዋት 4 ሰዓት");
    expect(ethiopianTime("13:30")).toBe("ቀን 7:30 ሰዓት");
    expect(ethiopianTime("18:00")).toBe("ማታ 12 ሰዓት");
    expect(ethiopianTime("00:00")).toBe("ሌሊት 6 ሰዓት");
  });
});
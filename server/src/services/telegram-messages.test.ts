import { describe, expect, it } from "vitest";
import { MESSAGES, formatWhen, tg, type MessageKey } from "./telegram-messages";

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

  it("formats times in Addis Ababa time in both languages", () => {
    const noonUtc = new Date("2026-10-24T12:00:00Z");
    expect(formatWhen("en", "time", noonUtc)).toBe("15:00");
    expect(formatWhen("am", "time", noonUtc)).toBe("15:00");
  });
});
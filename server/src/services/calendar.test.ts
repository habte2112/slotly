import { describe, it, expect } from "vitest";
import { buildIcs, googleCalendarUrl } from "./calendar";

const event = {
  id: "abc123",
  startAt: new Date("2026-10-12T09:00:00+03:00"),
  endAt: new Date("2026-10-12T09:30:00+03:00"),
  title: "Haircut, with Selam; Tadesse",
  description: "Booked on Slotly",
};

describe("calendar helpers", () => {
  it("writes the event times in UTC", () => {
    const ics = buildIcs(event, new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261012T060000Z");
    expect(ics).toContain("DTEND:20261012T063000Z");
    expect(ics).toContain("UID:abc123@slotly");
  });

  it("escapes special characters and uses CRLF line endings", () => {
    const ics = buildIcs(event);
    expect(ics).toContain("SUMMARY:Haircut\\, with Selam\\; Tadesse");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("builds a Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261012T060000Z/20261012T063000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
  });
});
import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("brings common Ethiopian formats to +251", () => {
    expect(normalizePhone("0911 22 33 44")).toBe("+251911223344");
    expect(normalizePhone("251911223344")).toBe("+251911223344");
    expect(normalizePhone("+251-911-223344")).toBe("+251911223344");
    expect(normalizePhone("911223344")).toBe("+251911223344");
    expect(normalizePhone("0711223344")).toBe("+251711223344");
  });
  it("keeps other international numbers and rejects junk", () => {
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("09112")).toBeNull();
  });
});
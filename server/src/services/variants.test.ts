import { describe, it, expect } from "vitest";
import { resolveTerms } from "./variants";

const base = { durationMinutes: 45, price: 400 };

describe("resolveTerms", () => {
  it("uses the variant's own terms when the specialist has no override", () => {
    expect(resolveTerms(base)).toEqual({ durationMinutes: 45, price: 400 });
    expect(resolveTerms(base, { priceOverride: null, durationOverride: null })).toEqual({
      durationMinutes: 45,
      price: 400,
    });
  });

  it("applies a price override only", () => {
    expect(resolveTerms(base, { priceOverride: 450, durationOverride: null })).toEqual({
      durationMinutes: 45,
      price: 450,
    });
  });

  it("applies a duration override only", () => {
    expect(resolveTerms(base, { priceOverride: null, durationOverride: 30 })).toEqual({
      durationMinutes: 30,
      price: 400,
    });
  });

  it("applies both overrides", () => {
    expect(resolveTerms(base, { priceOverride: 520, durationOverride: 60 })).toEqual({
      durationMinutes: 60,
      price: 520,
    });
  });

  it("treats a price override of 0 as a real value", () => {
    expect(resolveTerms(base, { priceOverride: 0, durationOverride: null }).price).toBe(0);
  });
});
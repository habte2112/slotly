import { describe, it, expect } from "vitest";
import { signParams } from "./cloudinary-sign";

describe("cloudinary signing", () => {
  it("matches the documented example (timestamp only)", () => {
    expect(signParams({ timestamp: "1315060510" }, "abcd")).toBe(
      "a21ad0f63beb4de2e5575204b79ab90bffb02c10",
    );
  });

  it("sorts params alphabetically before signing", () => {
    expect(
      signParams(
        { timestamp: "1315060510", public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" },
        "abcd",
      ),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});
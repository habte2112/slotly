import { describe, it, expect } from "vitest";
import { serviceLabel } from "./labels";

describe("serviceLabel", () => {
  it("joins the service and style names", () => {
    expect(serviceLabel("Haircut", "Fade")).toBe("Haircut · Fade");
  });

  it("shows only the service name when there is no style", () => {
    expect(serviceLabel("General Checkup")).toBe("General Checkup");
    expect(serviceLabel("General Checkup", null)).toBe("General Checkup");
  });
});
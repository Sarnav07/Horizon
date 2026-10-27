import { describe, expect, it } from "vitest";
import { formatMicroUsd, formatUnits } from "./format";

describe("paper amount display", () => {
  it("formats large signed raw balances without Number precision loss", () => {
    expect(formatUnits("1234567890123456789012345", 18, 4)).toBe("1,234,567.8901");
    expect(formatUnits("-1250000", 6, 4)).toBe("-1.25");
  });
  it("keeps modeled USD amounts separate from raw token units", () => {
    expect(formatMicroUsd("49798")).toBe("$0.04");
    expect(formatMicroUsd("-2500000")).toBe("-$2.5");
  });
});

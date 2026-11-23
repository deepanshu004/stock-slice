import { describe, expect, it } from "vitest";
import { shareQuantityUnits } from "./share-quantity.js";

describe("decimal share units", () => {
  it("converts high-precision fractions and scientific notation without multiplication rounding", () => {
    expect(shareQuantityUnits(0.4285714286, 10)).toBe(4_285_714_286);
    expect(shareQuantityUnits(16.28571429, 8)).toBe(1_628_571_429);
    expect(shareQuantityUnits(1e-10, 10)).toBe(1);
    expect(shareQuantityUnits(0, 10)).toBe(0);
  });

  it("rejects unsupported precision, quantities and excess fractional digits", () => {
    expect(shareQuantityUnits(0.0001, 3)).toBeUndefined();
    expect(shareQuantityUnits(Number.MAX_SAFE_INTEGER, 10)).toBeUndefined();
    expect(shareQuantityUnits(Infinity, 3)).toBeUndefined();
    expect(shareQuantityUnits(-1, 3)).toBeUndefined();
    expect(shareQuantityUnits(1, 11)).toBeUndefined();
  });
});

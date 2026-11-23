import { describe, expect, it } from "vitest";
import { createPlaceOrderSchema } from "./order.schema.js";

describe("quantity-based sell validation", () => {
  it("rejects buy amounts below a cent and hidden fractional cents", () => {
    for (const amount of [1e-12, 1.00000000001]) {
      expect(createPlaceOrderSchema(3).safeParse({ type: "BUY", amount, portfolio: {
        holdings: [{ symbol: "AAPL", allocationPercent: 100 }],
      } }).success).toBe(false);
    }
  });

  it("normalizes symbols and uses the configured share precision", () => {
    expect(createPlaceOrderSchema(3).parse({ type: "SELL", positions: [{ symbol: " aapl ", quantity: 1.123 }] }))
      .toEqual({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 1.123 }] });
    expect(createPlaceOrderSchema(2).safeParse({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 1.123 }] }).success).toBe(false);
  });

  it.each([
    { precision: 10, quantity: 0.4285714286 },
    { precision: 10, quantity: 4.3478260869 },
    { precision: 8, quantity: 16.28571429 },
  ])("accepts valid decimal quantity $quantity at precision $precision", ({ precision, quantity }) => {
    expect(createPlaceOrderSchema(precision).safeParse({ type: "SELL", positions: [{ symbol: "AAPL", quantity }] }).success).toBe(true);
  });

  it("rejects normalized duplicates, empty selections, unsafe and zero quantities", () => {
    const schema = createPlaceOrderSchema(3);
    expect(schema.safeParse({ type: "SELL", positions: [] }).success).toBe(false);
    expect(schema.safeParse({ type: "SELL", positions: [
      { symbol: "aapl", quantity: 1 }, { symbol: "AAPL", quantity: 1 },
    ] }).success).toBe(false);
    for (const quantity of [0, -1, Infinity, NaN, 0.00000001, Number.MAX_SAFE_INTEGER]) {
      expect(schema.safeParse({ type: "SELL", positions: [{ symbol: "AAPL", quantity }] }).success).toBe(false);
    }
  });

  it("rejects amount-based SELL requests and client-supplied sell prices", () => {
    const schema = createPlaceOrderSchema(3);
    expect(schema.safeParse({ type: "SELL", amount: 100, portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100 }] } }).success).toBe(false);
    expect(schema.safeParse({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 1, marketPrice: 999 }] }).success).toBe(false);
  });
});

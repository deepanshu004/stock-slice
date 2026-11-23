import { describe, expect, it } from "vitest";
import { createOrderSchema } from "./order.schema.js";

const validInput = {
  type: "BUY",
  amount: 100,
  portfolio: {
    name: "Core growth",
    holdings: [
      { symbol: "aapl", allocationPercent: 60 },
      { symbol: "TSLA", allocationPercent: 40 },
    ],
  },
};

describe("createOrderSchema", () => {
  it("normalizes holding symbols", () => {
    const result = createOrderSchema.parse(validInput);
    expect(result.portfolio.holdings[0]?.symbol).toBe("AAPL");
  });

  it("rejects allocations that do not total 100%", () => {
    const result = createOrderSchema.safeParse({
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [{ symbol: "AAPL", allocationPercent: 90 }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate symbols and amounts with fractional cents", () => {
    expect(createOrderSchema.safeParse({ ...validInput, amount: 1.001 }).success).toBe(false);
    expect(createOrderSchema.safeParse({
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [
        { symbol: "aapl", allocationPercent: 50 }, { symbol: "AAPL", allocationPercent: 50 },
      ] },
    }).success).toBe(false);
  });
});

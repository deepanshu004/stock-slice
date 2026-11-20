import { describe, expect, it } from "vitest";
import { createOrder, createOrderSchema, nextMarketOpen } from "./order.js";

const validInput = {
  type: "BUY" as const,
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

describe("createOrder", () => {
  it("uses partner prices, applies configured precision, and preserves the total allocation", () => {
    const input = createOrderSchema.parse({
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [
        { symbol: "AAPL", allocationPercent: 60, marketPrice: 120 },
        { symbol: "TSLA", allocationPercent: 40 },
      ] },
    });

    const order = createOrder(input, 3, new Date("2026-11-23T12:00:00.000Z"));
    expect(order.allocations.map(({ price }) => price)).toEqual([120, 100]);
    expect(order.allocations.map(({ shares }) => shares)).toEqual([0.5, 0.4]);
    expect(order.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(100);
    expect(order.allocations[0]?.symbol).toBe("AAPL");
  });

  it("rounds down shares at the configured precision so an allocation is not exceeded", () => {
    const input = createOrderSchema.parse({
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [
        { symbol: "AAPL", allocationPercent: 100, marketPrice: 3 },
      ] },
    });
    const order = createOrder(input, 2, new Date("2026-11-23T12:00:00.000Z"));
    expect(order.allocations[0]?.shares).toBe(33.33);
    expect(order.allocations[0]?.estimatedTradeValue).toBeLessThanOrEqual(100);
  });

  it("distributes cents by largest remainder without creating negative allocations", () => {
    const input = createOrderSchema.parse({
      ...validInput,
      amount: 0.01,
      portfolio: { holdings: [
        { symbol: "AAA", allocationPercent: 33.33 },
        { symbol: "BBB", allocationPercent: 33.33 },
        { symbol: "CCC", allocationPercent: 33.34 },
      ] },
    });
    const order = createOrder(input, 3, new Date("2026-11-23T12:00:00.000Z"));
    expect(order.allocations.map(({ amount }) => amount)).toEqual([0, 0, 0.01]);
    expect(order.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(0.01);
    expect(order.allocations.every(({ amount }) => amount >= 0)).toBe(true);
  });
});

describe("nextMarketOpen", () => {
  it("schedules before the open on the same weekday", () => {
    expect(nextMarketOpen(new Date("2026-11-23T12:00:00.000Z")))
      .toBe("2026-11-23T14:30:00.000Z");
  });

  it("skips weekends and schedules after-open orders for the next weekday", () => {
    expect(nextMarketOpen(new Date("2026-11-21T16:00:00.000Z")))
      .toBe("2026-11-23T14:30:00.000Z");
    expect(nextMarketOpen(new Date("2026-11-23T15:00:00.000Z")))
      .toBe("2026-11-24T14:30:00.000Z");
  });
});
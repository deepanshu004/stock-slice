import { describe, expect, it } from "vitest";
import { createOrder, nextMarketOpen, type CreateOrderInput } from "./order.js";

const validInput: CreateOrderInput = {
  type: "BUY",
  amount: 100,
  portfolio: {
    name: "Core growth",
    holdings: [
      { symbol: "AAPL", allocationPercent: 60 },
      { symbol: "TSLA", allocationPercent: 40 },
    ],
  },
};

describe("createOrder", () => {
  it("uses partner prices, applies configured precision, and preserves the total allocation", () => {
    const input: CreateOrderInput = {
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [
        { symbol: "AAPL", allocationPercent: 60, marketPrice: 120 },
        { symbol: "TSLA", allocationPercent: 40 },
      ] },
    };

    const order = createOrder(input, 3, new Date("2026-11-23T12:00:00.000Z"));
    expect(order).toMatchObject({
      status: "COMPLETED",
      createdAt: "2026-11-23T12:00:00.000Z",
      executionAt: "2026-11-23T12:00:00.000Z",
      executionTimezone: "America/New_York",
    });
    expect(order.allocations.map(({ price }) => price)).toEqual([120, 100]);
    expect(order.allocations.map(({ shares }) => shares)).toEqual([0.5, 0.4]);
    expect(order.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(100);
    expect(order.allocations[0]?.symbol).toBe("AAPL");
  });

  it("schedules a weekend buy for Monday opening", () => {
    const order = createOrder(validInput, 3, new Date("2026-11-21T16:00:00.000Z"));
    expect(order).toMatchObject({
      status: "SCHEDULED",
      createdAt: "2026-11-21T16:00:00.000Z",
      executionAt: "2026-11-23T14:30:00.000Z",
      executionTimezone: "America/New_York",
    });
  });

  it("rounds down shares at the configured precision so an allocation is not exceeded", () => {
    const input: CreateOrderInput = {
      ...validInput,
      portfolio: { ...validInput.portfolio, holdings: [
        { symbol: "AAPL", allocationPercent: 100, marketPrice: 3 },
      ] },
    };
    const order = createOrder(input, 2, new Date("2026-11-23T12:00:00.000Z"));
    expect(order.allocations[0]?.shares).toBe(33.33);
    expect(order.allocations[0]?.estimatedTradeValue).toBeLessThanOrEqual(100);
  });

  it("distributes cents by largest remainder without creating negative allocations", () => {
    const input: CreateOrderInput = {
      ...validInput,
      amount: 0.01,
      portfolio: { holdings: [
        { symbol: "AAA", allocationPercent: 33.33 },
        { symbol: "BBB", allocationPercent: 33.33 },
        { symbol: "CCC", allocationPercent: 33.34 },
      ] },
    };
    const order = createOrder(input, 3, new Date("2026-11-23T12:00:00.000Z"));
    expect(order.allocations.map(({ amount }) => amount)).toEqual([0, 0, 0.01]);
    expect(order.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(0.01);
    expect(order.allocations.every(({ amount }) => amount >= 0)).toBe(true);
  });
});

describe("nextMarketOpen", () => {
  it.each([
    { scenario: "weekday before open", now: "2026-11-23T12:00:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "weekday at open", now: "2026-11-23T14:30:00.000Z", expected: "2026-11-24T14:30:00.000Z" },
    { scenario: "weekday after open", now: "2026-11-23T15:00:00.000Z", expected: "2026-11-24T14:30:00.000Z" },
    { scenario: "Friday before open", now: "2026-11-20T14:29:59.999Z", expected: "2026-11-20T14:30:00.000Z" },
    { scenario: "Friday at open", now: "2026-11-20T14:30:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "Friday after close", now: "2026-11-20T22:00:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "Saturday", now: "2026-11-21T16:00:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "Sunday", now: "2026-11-22T16:00:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "Sunday in New York but Monday in UTC", now: "2026-11-23T02:00:00.000Z", expected: "2026-11-23T14:30:00.000Z" },
    { scenario: "spring daylight-saving weekend", now: "2026-03-07T16:00:00.000Z", expected: "2026-03-09T13:30:00.000Z" },
    { scenario: "fall daylight-saving weekend", now: "2026-10-31T16:00:00.000Z", expected: "2026-11-02T14:30:00.000Z" },
  ])("schedules $scenario at 09:30 Eastern on the next eligible weekday", ({ now, expected }) => {
    expect(nextMarketOpen(new Date(now))).toBe(expected);
  });
});

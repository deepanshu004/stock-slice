import { describe, expect, it } from "vitest";
import { createSellOrder } from "./sell-order.js";

describe("quantity-based sell order", () => {
  it("rounds proceeds per position and schedules execution at the next weekday open", () => {
    const order = createSellOrder([
      { symbol: "AAPL", quantity: 0.001, price: 16 },
      { symbol: "MSFT", quantity: 0.001, price: 16 },
    ], new Date("2026-11-21T12:00:00.000Z"));
    expect(order).toMatchObject({
      type: "SELL", amount: 0.04, status: "SCHEDULED",
      executionAt: "2026-11-23T14:30:00.000Z",
      executionTimezone: "America/New_York",
      createdAt: "2026-11-21T12:00:00.000Z",
    });
    expect(order.allocations.map(({ amount }) => amount)).toEqual([0.02, 0.02]);
    expect(order.allocations.map(({ shares }) => shares)).toEqual([0.001, 0.001]);
    expect(order.allocations.map(({ allocationPercent }) => allocationPercent)).toEqual([50, 50]);
  });
});

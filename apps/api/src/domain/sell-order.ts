import { randomUUID } from "node:crypto";
import type { AccountPosition } from "./account.js";
import { orderExecution, type Order } from "./order.js";

export function createSellOrder(positions: AccountPosition[], now = new Date()): Order {
  const proceedsCents = positions.map(({ quantity, price }) => Math.round(quantity * price * 100));
  const totalCents = proceedsCents.reduce((total, cents) => total + cents, 0);
  const totalValue = positions.reduce((total, { quantity, price }) => total + quantity * price, 0);
  const createdAt = now.toISOString();

  return {
    id: randomUUID(),
    type: "SELL",
    amount: totalCents / 100,
    portfolioName: "Selected positions",
    allocations: positions.map(({ symbol, quantity, price }, index) => {
      const amount = (proceedsCents[index] ?? 0) / 100;
      return {
        symbol,
        allocationPercent: quantity * price / totalValue * 100,
        price,
        amount,
        shares: quantity,
        estimatedTradeValue: amount,
        unallocatedAmount: 0,
      };
    }),
    ...orderExecution(now),
    executionTimezone: "America/New_York",
    createdAt,
  };
}

import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { CreatePortfolioInput } from "./portfolio.js";

export interface CreateOrderInput {
  type: "BUY" | "SELL";
  amount: number;
  portfolio: CreatePortfolioInput;
}

export interface BuyOrderInput extends Omit<CreateOrderInput, "type"> {
  type: "BUY";
}

export interface SellOrderInput {
  type: "SELL";
  positions: { symbol: string; quantity: number }[];
}

export type PlaceOrderInput = (BuyOrderInput | SellOrderInput) & {
  simulationDate?: string | undefined;
};

export type SharePrecision = number;

export interface OrderAllocation {
  symbol: string;
  allocationPercent: number;
  price: number;
  amount: number;
  shares: number;
  estimatedTradeValue: number;
  unallocatedAmount: number;
}

export interface Order {
  id: string;
  type: "BUY" | "SELL";
  amount: number;
  portfolioName: string;
  allocations: OrderAllocation[];
  executionAt: string;
  executionTimezone: "America/New_York";
  createdAt: string;
  status: "SCHEDULED" | "COMPLETED";
  simulationDate?: string;
}

export function nextMarketOpen(now: Date): string {
  const localNow = DateTime.fromJSDate(now, { zone: "utc" }).setZone("America/New_York");
  let marketOpen = localNow.startOf("day").set({ hour: 9, minute: 30 });

  if (localNow.weekday > 5 || localNow.toMillis() >= marketOpen.toMillis()) {
    marketOpen = marketOpen.plus({ days: 1 });
    while (marketOpen.weekday > 5) marketOpen = marketOpen.plus({ days: 1 });
  }

  return marketOpen.toUTC().toISO() ?? "";
}

export function orderExecution(now: Date): Pick<Order, "executionAt" | "status"> {
  const weekend = DateTime.fromJSDate(now, { zone: "America/New_York" }).weekday > 5;
  return {
    executionAt: weekend ? nextMarketOpen(now) : now.toISOString(),
    status: weekend ? "SCHEDULED" : "COMPLETED",
  };
}

export function createOrder(input: CreateOrderInput, precision: SharePrecision, now = new Date()): Order {
  if (!Number.isInteger(precision) || precision < 0 || precision > 10) {
    throw new RangeError("Share precision must be an integer from 0 to 10");
  }

  const totalCents = Math.round(input.amount * 100);
  const totalWeight = input.portfolio.holdings.reduce((total, holding) => total + holding.allocationPercent, 0);
  const rawCents = input.portfolio.holdings.map((holding) => totalCents * holding.allocationPercent / totalWeight);
  const cents = rawCents.map(Math.floor);
  let remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);
  const remainderPriority = rawCents
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < remainder; index += 1) {
    const target = remainderPriority[index % remainderPriority.length];
    if (target) cents[target.index] = (cents[target.index] ?? 0) + 1;
  }

  const allocations = input.portfolio.holdings.map((holding, index): OrderAllocation => {
    const amountCents = cents[index] ?? 0;

    const amount = amountCents / 100;
    const price = holding.marketPrice ?? 100;
    const scale = 10 ** precision;
    const shares = Math.floor((amount / price) * scale + 1e-10) / scale;
    const estimatedTradeValue = Math.round(shares * price * 100) / 100;

    return {
      symbol: holding.symbol,
      allocationPercent: holding.allocationPercent,
      price,
      amount,
      shares,
      estimatedTradeValue,
      unallocatedAmount: Math.round((amount - estimatedTradeValue) * 100) / 100,
    };
  });

  return {
    id: randomUUID(),
    type: input.type,
    amount: totalCents / 100,
    portfolioName: input.portfolio.name ?? "Untitled portfolio",
    allocations,
    ...orderExecution(now),
    executionTimezone: "America/New_York",
    createdAt: now.toISOString(),
  };
}

import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { z } from "zod";

const holdingSchema = z.object({
  symbol: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9.-]+$/).transform((value) => value.toUpperCase()),
  allocationPercent: z.number().positive().max(100),
  marketPrice: z.number().positive().max(1_000_000).optional(),
}).strict();

export const portfolioSchema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    holdings: z.array(holdingSchema).min(1).max(50),
}).strict().superRefine((portfolio, context) => {
  const symbols = portfolio.holdings.map(({ symbol }) => symbol);
  if (new Set(symbols).size !== symbols.length) {
    context.addIssue({ code: "custom", path: ["portfolio", "holdings"], message: "Holding symbols must be unique" });
  }

  const allocationTotal = portfolio.holdings.reduce((total, holding) => total + holding.allocationPercent, 0);
  if (Math.abs(allocationTotal - 100) > 0.0001) {
    context.addIssue({ code: "custom", path: ["portfolio", "holdings"], message: "Holding allocations must total 100%" });
  }
});

export const createOrderSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  amount: z.number().positive().max(1_000_000_000).refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Amount must have no more than two decimal places",
  ),
  portfolio: portfolioSchema,
}).strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
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
    executionAt: nextMarketOpen(now),
    executionTimezone: "America/New_York",
    createdAt: now.toISOString(),
  };
}
import { z } from "zod";
import { shareQuantityUnits } from "../domain/share-quantity.js";
import { portfolioSchema } from "./portfolio.schema.js";
import { moneyAmountSchema } from "./money.schema.js";

export const createOrderSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  amount: z.number().positive().max(1_000_000_000).refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Amount must have no more than two decimal places",
  ),
  portfolio: portfolioSchema,
}).strict();

export const buyOrderSchema = createOrderSchema.extend({ type: z.literal("BUY"), amount: moneyAmountSchema });

export function createSellOrderSchema(sharePrecision: number) {
  return z.object({
    type: z.literal("SELL"),
    positions: z.array(z.object({
      symbol: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9.-]+$/).transform((value) => value.toUpperCase()),
      quantity: z.number().positive().refine((value) => {
        const units = shareQuantityUnits(value, sharePrecision);
        return units !== undefined && units > 0;
      }, `Quantity must have no more than ${sharePrecision} decimal places and fit within supported share limits`),
    }).strict()).min(1).max(50),
  }).strict().superRefine((input, context) => {
    const symbols = input.positions.map(({ symbol }) => symbol);
    if (new Set(symbols).size !== symbols.length) {
      context.addIssue({ code: "custom", path: ["positions"], message: "Position symbols must be unique" });
    }
  });
}

export function createPlaceOrderSchema(sharePrecision: number) {
  return z.discriminatedUnion("type", [buyOrderSchema, createSellOrderSchema(sharePrecision)]);
}

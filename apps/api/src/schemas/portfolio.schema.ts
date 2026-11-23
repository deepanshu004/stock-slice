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

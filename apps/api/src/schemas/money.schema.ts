import { z } from "zod";

export const moneyAmountSchema = z.number().positive().max(1_000_000_000).refine(
  (value) => Number(value.toFixed(2)) === value,
  "Amount must have no more than two decimal places",
);

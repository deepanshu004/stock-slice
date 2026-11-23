import { z } from "zod";
import { moneyAmountSchema } from "./money.schema.js";

export const topUpSchema = z.object({
  amount: moneyAmountSchema,
  paymentMethod: z.literal("demo-card"),
}).strict();

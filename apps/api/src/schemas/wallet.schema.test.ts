import { describe, expect, it } from "vitest";
import { topUpSchema } from "./wallet.schema.js";

describe("demo-card top-ups", () => {
  it("accepts positive cents and only the demo payment method", () => {
    expect(topUpSchema.parse({ amount: 12.34, paymentMethod: "demo-card" })).toEqual({ amount: 12.34, paymentMethod: "demo-card" });
  });

  it.each([0, -1, 0.001, 1e-12, 1.00000000001, Infinity, NaN, 1_000_000_001])("rejects invalid amount %s", (amount) => {
    expect(topUpSchema.safeParse({ amount, paymentMethod: "demo-card" }).success).toBe(false);
  });

  it("rejects real payment methods and raw payment details", () => {
    expect(topUpSchema.safeParse({ amount: 10, paymentMethod: "card" }).success).toBe(false);
    expect(topUpSchema.safeParse({ amount: 10, paymentMethod: "demo-card", cardNumber: "4242424242424242" }).success).toBe(false);
  });
});

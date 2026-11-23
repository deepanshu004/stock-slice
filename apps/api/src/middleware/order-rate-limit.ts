import rateLimit from "express-rate-limit";

export function createOrderRateLimiter() {
  return rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
}

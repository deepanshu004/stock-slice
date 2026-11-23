import rateLimit from "express-rate-limit";

export function createTopUpRateLimiter() {
  return rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
}

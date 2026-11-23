import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller.js";
import { createTopUpRateLimiter } from "../middleware/top-up-rate-limit.js";
import type { AccountService } from "../services/account.service.js";

export function createWalletRouter(accountService: AccountService): Router {
  const router = Router();
  const controller = new WalletController(accountService);
  router.get("/", controller.get);
  router.post("/top-ups", createTopUpRateLimiter(), controller.topUp);
  return router;
}

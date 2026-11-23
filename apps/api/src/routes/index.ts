import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import type { OrderService } from "../services/order.service.js";
import type { PortfolioService } from "../services/portfolio.service.js";
import type { AccountService } from "../services/account.service.js";
import { createConfigRouter } from "./config.routes.js";
import { createHealthRouter } from "./health.routes.js";
import { createOrderRouter } from "./order.routes.js";
import { createPortfolioRouter } from "./portfolio.routes.js";
import { createWalletRouter } from "./wallet.routes.js";
import { createPositionRouter } from "./position.routes.js";

interface ApiRouterDependencies {
  config: AppConfig;
  orderService: OrderService;
  portfolioService: PortfolioService;
  accountService: AccountService;
}

export function createApiRouter({ config, orderService, portfolioService, accountService }: ApiRouterDependencies): Router {
  const router = Router();

  router.use("/health", createHealthRouter(orderService));
  router.use("/config", createConfigRouter(config));
  router.use("/orders", createOrderRouter(orderService, config.sharePrecision));
  router.use("/portfolios", createPortfolioRouter(portfolioService));
  router.use("/wallet", createWalletRouter(accountService));
  router.use("/positions", createPositionRouter(accountService));

  return router;
}

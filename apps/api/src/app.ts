import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config, type AppConfig } from "./config/env.js";
import { errorHandler } from "./handlers/error.handler.js";
import { cacheControl } from "./middleware/cache-control.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createApiRouter } from "./routes/index.js";
import { OrderService } from "./services/order.service.js";
import { PortfolioService } from "./services/portfolio.service.js";
import { OrderStore } from "./store/order-store.js";
import { PortfolioStore } from "./store/portfolio-store.js";
import { AccountStore } from "./store/account-store.js";
import { AccountService } from "./services/account.service.js";

interface AppDependencies {
  config?: AppConfig;
  orderStore?: OrderStore;
  portfolioStore?: PortfolioStore;
  accountStore?: AccountStore;
}

export function createApp({
  config: appConfig = config,
  orderStore = new OrderStore(),
  portfolioStore = new PortfolioStore(),
  accountStore = new AccountStore(),
}: AppDependencies = {}) {
  const app = express();
  const accountService = new AccountService(accountStore, appConfig.sharePrecision);
  const orderService = new OrderService(orderStore, appConfig.sharePrecision, accountService);
  const portfolioService = new PortfolioService(portfolioStore);

  app.disable("x-powered-by");
  app.disable("etag");
  app.use(helmet());
  app.use(cors({ origin: appConfig.corsOrigins }));
  app.use(cacheControl);
  app.use(express.json({ limit: "32kb" }));
  app.use(requestLogger);
  app.use("/api", createApiRouter({ config: appConfig, orderService, portfolioService, accountService }));
  app.use(errorHandler);

  return app;
}

export const app = createApp();

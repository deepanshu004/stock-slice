import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config.js";
import { createOrder, createOrderSchema, portfolioSchema } from "./domain/order.js";
import { OrderStore } from "./store/order-store.js";
import { PortfolioStore } from "./store/portfolio-store.js";

export const orderStore = new OrderStore();
export const portfolioStore = new PortfolioStore();
export const app = express();

app.disable("x-powered-by");
app.disable("etag");
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use((request, response, next) => {
  const startedAt = process.hrtime.bigint();
  response.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs.toFixed(2)}ms`);
  });
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", storage: "in-memory", orders: orderStore.size });
});

app.get("/api/config", (_request, response) => {
  response.json({ sharePrecision: config.sharePrecision, defaultPrice: 100, currency: "USD" });
});

app.get("/api/portfolios", (_request, response) => {
  response.json({ data: portfolioStore.list(), count: portfolioStore.list().length });
});

app.post("/api/portfolios", (request, response, next) => {
  try {
    const parsed = portfolioSchema.parse(request.body);
    const holdings = parsed.holdings.map((holding) => ({
      symbol: holding.symbol,
      allocationPercent: holding.allocationPercent,
      ...(holding.marketPrice === undefined ? {} : { marketPrice: holding.marketPrice }),
    }));
    const portfolio = portfolioStore.add({
      id: crypto.randomUUID(),
      name: parsed.name ?? "Untitled portfolio",
      holdings,
      createdAt: new Date().toISOString(),
    });
    response.status(201).json({ data: portfolio });
  } catch (error) {
    next(error);
  }
});

const orderLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });

app.post("/api/orders", orderLimiter, (request, response, next) => {
  try {
    const input = createOrderSchema.parse(request.body);
    const order = orderStore.add(createOrder(input, config.sharePrecision));
    response.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", (_request, response) => {
  response.json({ data: orderStore.list(), count: orderStore.size });
});

app.get("/api/orders/:id", (request, response) => {
  const order = orderStore.get(request.params.id ?? "");
  if (!order) {
    response.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found" } });
    return;
  }
  response.json({ data: order });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request could not be validated",
        details: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      },
    });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
    return;
  }
  console.error("Unhandled API error", error);
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};

app.use(errorHandler);
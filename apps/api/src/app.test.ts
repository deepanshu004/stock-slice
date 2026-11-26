import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { OrderStore } from "./store/order-store.js";

const orderRequest = {
  type: "BUY",
  amount: 100,
  portfolio: {
    name: "Core growth",
    holdings: [
      { symbol: "AAPL", allocationPercent: 60, marketPrice: 150 },
      { symbol: "TSLA", allocationPercent: 40 },
    ],
  },
};

let app: Express;

async function addMoney(target = app, amount = 1_000) {
  return request(target).post("/api/wallet/top-ups").send({ amount, paymentMethod: "demo-card" }).expect(201);
}

beforeEach(() => {
  app = createApp();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("orders API", () => {
  it.each([
    { placedAt: "2026-11-21T16:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
    { placedAt: "2026-11-22T16:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
    { placedAt: "2026-11-20T21:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
    { placedAt: "2026-11-23T12:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
    { placedAt: "2026-03-07T16:00:00.000Z", executionAt: "2026-03-09T13:30:00.000Z" },
    { placedAt: "2026-10-31T16:00:00.000Z", executionAt: "2026-11-02T14:30:00.000Z" },
  ])("preserves the market-open schedule for buys, sells, and history placed at $placedAt", async ({ placedAt, executionAt }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(placedAt));
    await addMoney();
    const bought = await request(app).post("/api/orders").send(orderRequest).expect(201);
    const sold = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }],
    }).expect(201);

    for (const result of [bought, sold]) {
      expect(result.body.data).toMatchObject({
        status: "SCHEDULED", executionAt,
        executionTimezone: "America/New_York", createdAt: placedAt,
      });
      const retrieved = await request(app).get(`/api/orders/${result.body.data.id}`).expect(200);
      expect(retrieved.body.data).toEqual(result.body.data);
    }
    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body.data).toEqual([sold.body.data, bought.body.data]);
  });

  it("creates calculated orders and returns history newest first", async () => {
    await addMoney();
    const first = await request(app).post("/api/orders").send(orderRequest).expect(201);
    expect(first.body.data.type).toBe("BUY");
    expect(first.body.data.allocations[0]).toMatchObject({ symbol: "AAPL", price: 150, amount: 60, shares: 0.4 });

    const second = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }],
    }).expect(201);
    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body.count).toBe(2);
    expect(history.body.data.map((order: { id: string }) => order.id)).toEqual([
      second.body.data.id,
      first.body.data.id,
    ]);
  });

  it("retrieves a saved order by ID", async () => {
    await addMoney();
    const created = await request(app).post("/api/orders").send(orderRequest).expect(201);
    const retrieved = await request(app).get(`/api/orders/${created.body.data.id}`).expect(200);
    expect(retrieved.body).toEqual({ data: created.body.data });
  });

  it("rejects invalid order input with actionable errors and saves nothing", async () => {
    const response = await request(app).post("/api/orders").send({ ...orderRequest, amount: -1 }).expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "amount", message: expect.any(String) }),
    ]));
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
  });

  it("returns a structured error for malformed JSON", async () => {
    await request(app)
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send('{"amount":')
      .expect(400, { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
  });

  it("returns the existing error contract for an unknown order", async () => {
    await request(app).get("/api/orders/missing")
      .expect(404, { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } });
  });

  it("uses injected share precision in both configuration and calculations", async () => {
    app = createApp({ config: { ...config, sharePrecision: 2 } });
    await request(app).get("/api/config").expect(200, {
      sharePrecision: 2,
      defaultPrice: 100,
      currency: "USD",
    });
    await addMoney();
    const created = await request(app).post("/api/orders").send({
      ...orderRequest,
      portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 3 }] },
    }).expect(201);
    expect(created.body.data.allocations[0].shares).toBe(33.33);
  });

  it("returns a generic 500 response when persistence fails", async () => {
    const orderStore = new OrderStore();
    vi.spyOn(orderStore, "add").mockImplementation(() => {
      throw new Error("Private persistence failure");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    app = createApp({ orderStore });
    await addMoney(app, 100);

    await request(app).post("/api/orders").send(orderRequest)
      .expect(500, { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
    expect(errorLog).toHaveBeenCalled();
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 100, currency: "USD", paymentMode: "demo" },
    });
    await request(app).get("/api/positions").expect(200, { data: [], count: 0 });
  });

  it("limits order creation per app while keeping reads and portfolio creation available", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await request(app).post("/api/orders").send({}).expect(400);
    }
    await request(app).post("/api/orders").send(orderRequest).expect(429);
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
    await request(app).post("/api/portfolios").send(orderRequest.portfolio).expect(201);

    const anotherApp = createApp();
    await addMoney(anotherApp);
    await request(anotherApp).post("/api/orders").send(orderRequest).expect(201);
  });
});

describe("portfolios API", () => {
  it("creates a reusable portfolio and returns it from the portfolio list", async () => {
    const portfolio = { name: "Balanced", holdings: [
      { symbol: "AAPL", allocationPercent: 70 },
      { symbol: "MSFT", allocationPercent: 30, marketPrice: 420 },
    ] };
    const created = await request(app).post("/api/portfolios").send(portfolio).expect(201);
    expect(created.body.data).toMatchObject({ name: "Balanced", holdings: portfolio.holdings });
    expect(created.body.data.id).toEqual(expect.any(String));
    expect(created.body.data.createdAt).toEqual(expect.any(String));

    const history = await request(app).get("/api/portfolios").expect(200);
    expect(history.body).toEqual({ data: [created.body.data], count: 1 });
  });

  it("normalizes symbols, defaults the portfolio name, and omits absent prices", async () => {
    const created = await request(app).post("/api/portfolios").send({
      holdings: [{ symbol: " aapl ", allocationPercent: 100 }],
    }).expect(201);
    expect(created.body.data.name).toBe("Untitled portfolio");
    expect(created.body.data.holdings).toEqual([{ symbol: "AAPL", allocationPercent: 100 }]);
  });

  it("rejects invalid portfolio allocations without saving them", async () => {
    const response = await request(app).post("/api/portfolios").send({
      holdings: [{ symbol: "AAPL", allocationPercent: 90 }],
    }).expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "Holding allocations must total 100%" }),
    ]));
    await request(app).get("/api/portfolios").expect(200, { data: [], count: 0 });
  });
});

describe("demo wallet and owned positions", () => {
  it("starts with an empty USD demo wallet and no owned stocks", async () => {
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    await request(app).get("/api/positions").expect(200, { data: [], count: 0 });
  });

  it("adds demo-card funds in cents without creating orders", async () => {
    await addMoney(app, 10.01);
    const funded = await addMoney(app, 1.99);
    expect(funded.body).toEqual({ data: { balance: 12, currency: "USD", paymentMode: "demo" } });
    await request(app).get("/api/wallet").expect(200, funded.body);
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
  });

  it.each([
    { amount: 0, paymentMethod: "demo-card" },
    { amount: -10, paymentMethod: "demo-card" },
    { amount: 1.001, paymentMethod: "demo-card" },
    { amount: "100", paymentMethod: "demo-card" },
    { amount: 100, paymentMethod: "real-card" },
    { amount: 100, paymentMethod: "demo-card", cardNumber: "4242424242424242" },
  ])("rejects invalid top-up input without changing the wallet: %j", async (input) => {
    const result = await request(app).post("/api/wallet/top-ups").send(input).expect(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
  });

  it("funds a buy, sells part of an owned stock, and closes the remaining positions", async () => {
    await addMoney(app, 500);
    const bought = await request(app).post("/api/orders").send(orderRequest).expect(201);
    expect(bought.body.data.status).toBe("SCHEDULED");
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 400, currency: "USD", paymentMode: "demo" },
    });
    const owned = await request(app).get("/api/positions").expect(200);
    expect(owned.body.count).toBe(2);
    expect(owned.body.data).toEqual(expect.arrayContaining([
      { symbol: "AAPL", quantity: 0.4, price: 150, marketValue: 60 },
      { symbol: "TSLA", quantity: 0.4, price: 100, marketValue: 40 },
    ]));

    const partial = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: " aapl ", quantity: 0.15 }],
    }).expect(201);
    expect(partial.body.data).toMatchObject({ type: "SELL", amount: 22.5, status: "SCHEDULED" });
    expect(partial.body.data.allocations[0]).toMatchObject({ symbol: "AAPL", shares: 0.15, price: 150 });
    const remaining = await request(app).get("/api/positions").expect(200);
    expect(remaining.body.data).toEqual(expect.arrayContaining([
      { symbol: "AAPL", quantity: 0.25, price: 150, marketValue: 37.5 },
    ]));
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 422.5, currency: "USD", paymentMode: "demo" },
    });

    const closed = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.25 }, { symbol: "TSLA", quantity: 0.4 }],
    }).expect(201);
    expect(closed.body.data.amount).toBe(77.5);
    await request(app).get("/api/positions").expect(200, { data: [], count: 0 });
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 500, currency: "USD", paymentMode: "demo" },
    });
    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body.count).toBe(3);
  });

  it("rejects unfunded buys without adding orders or positions", async () => {
    await addMoney(app, 99.99);
    const rejected = await request(app).post("/api/orders").send(orderRequest).expect(409);
    expect(rejected.body.error.code).toBe("INSUFFICIENT_FUNDS");
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 99.99, currency: "USD", paymentMode: "demo" },
    });
    await request(app).get("/api/positions").expect(200, { data: [], count: 0 });
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
  });

  it("accumulates stock quantities across repeated funded buys", async () => {
    await addMoney(app, 200);
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    const owned = await request(app).get("/api/positions").expect(200);
    expect(owned.body.count).toBe(2);
    expect(owned.body.data).toEqual(expect.arrayContaining([
      { symbol: "AAPL", quantity: 0.8, price: 150, marketValue: 120 },
      { symbol: "TSLA", quantity: 0.8, price: 100, marketValue: 80 },
    ]));
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
  });

  it("rejects selling a stock the account does not own", async () => {
    const rejected = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "MSFT", quantity: 1 }],
    }).expect(409);
    expect(rejected.body.error.code).toBe("POSITION_NOT_FOUND");
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
  });

  it("rejects an oversell atomically across multiple stocks", async () => {
    await addMoney(app, 100);
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    const before = await request(app).get("/api/positions").expect(200);
    const rejected = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "TSLA", quantity: 0.1 }, { symbol: "AAPL", quantity: 0.401 }],
    }).expect(409);
    expect(rejected.body.error.code).toBe("INSUFFICIENT_QUANTITY");
    await request(app).get("/api/positions").expect(200, before.body);
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body.count).toBe(1);
  });

  it.each([
    { positions: [] },
    { positions: [{ symbol: "AAPL", quantity: 0 }] },
    { positions: [{ symbol: "AAPL", quantity: -1 }] },
    { positions: [{ symbol: "AAPL", quantity: 0.0001 }] },
    { positions: [{ symbol: "aapl", quantity: 0.1 }, { symbol: "AAPL", quantity: 0.1 }] },
    { positions: [{ symbol: "AAPL", quantity: 0.1, marketPrice: 1_000 }] },
  ])("rejects invalid or duplicate sell quantities: %j", async ({ positions }) => {
    const rejected = await request(app).post("/api/orders").send({ type: "SELL", positions }).expect(400);
    expect(rejected.body.error.code).toBe("VALIDATION_ERROR");
    await request(app).get("/api/orders").expect(200, { data: [], count: 0 });
  });

  it("debits the buy notional and enforces configured fractional sell precision", async () => {
    app = createApp({ config: { ...config, sharePrecision: 2 } });
    await addMoney(app, 100);
    await request(app).post("/api/orders").send({
      type: "BUY", amount: 100,
      portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 3 }] },
    }).expect(201);
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.001 }],
    }).expect(400);
    const sold = await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 33.33 }],
    }).expect(201);
    expect(sold.body.data.amount).toBe(99.99);
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 99.99, currency: "USD", paymentMode: "demo" },
    });
    await request(app).get("/api/positions").expect(200, { data: [], count: 0 });
  });

  it("keeps funds and owned quantities unchanged if saving a sell order fails", async () => {
    const orderStore = new OrderStore();
    app = createApp({ orderStore });
    await addMoney(app, 100);
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    const before = await request(app).get("/api/positions").expect(200);
    vi.spyOn(orderStore, "add").mockImplementation(() => { throw new Error("Persistence unavailable"); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await request(app).post("/api/orders").send({
      type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }],
    }).expect(500);
    await request(app).get("/api/positions").expect(200, before.body);
    await request(app).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body.count).toBe(1);
  });
});

describe("application composition", () => {
  it("reports health with the current order count", async () => {
    await request(app).get("/api/health").expect(200, { status: "ok", storage: "in-memory", orders: 0 });
    await addMoney();
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    await request(app).get("/api/health").expect(200, { status: "ok", storage: "in-memory", orders: 1 });
  });

  it("preserves cache and security headers", async () => {
    const response = await request(app).get("/api/config")
      .expect(200)
      .expect("Cache-Control", "no-store")
      .expect("X-Content-Type-Options", "nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers.etag).toBeUndefined();
  });

  it("allows configured origins and withholds CORS access for other origins", async () => {
    app = createApp({ config: { ...config, corsOrigins: ["http://localhost:5174"] } });
    await request(app)
      .get("/api/config")
      .set("Origin", "http://localhost:5174")
      .expect(200)
      .expect("Access-Control-Allow-Origin", "http://localhost:5174");
    const blocked = await request(app).get("/api/config").set("Origin", "https://unconfigured.example").expect(200);
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("isolates order and portfolio state between application instances", async () => {
    await addMoney();
    await request(app).post("/api/orders").send(orderRequest).expect(201);
    await request(app).post("/api/portfolios").send(orderRequest.portfolio).expect(201);

    const anotherApp = createApp();
    await request(anotherApp).get("/api/orders").expect(200, { data: [], count: 0 });
    await request(anotherApp).get("/api/portfolios").expect(200, { data: [], count: 0 });
    await request(anotherApp).get("/api/wallet").expect(200, {
      data: { balance: 0, currency: "USD", paymentMode: "demo" },
    });
    await request(anotherApp).get("/api/positions").expect(200, { data: [], count: 0 });
    await request(anotherApp).get("/api/health").expect(200, { status: "ok", storage: "in-memory", orders: 0 });
    await request(app).get("/api/health").expect(200, { status: "ok", storage: "in-memory", orders: 1 });
  });
});

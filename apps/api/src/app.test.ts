import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, orderStore, portfolioStore } from "./app.js";

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

afterEach(() => {
  vi.restoreAllMocks();
  const ids = orderStore.list().map(({ id }) => id);
  for (const id of ids) {
    const store = orderStore as unknown as { orders: Map<string, unknown> };
    store.orders.delete(id);
  }
  const portfolioIds = portfolioStore.list().map(({ id }) => id);
  for (const id of portfolioIds) {
    const store = portfolioStore as unknown as { portfolios: Map<string, unknown> };
    store.portfolios.delete(id);
  }
});

describe("orders API", () => {
  it("creates a calculated order and returns it in history", async () => {
    const created = await request(app).post("/api/orders").send(orderRequest).expect(201);
    expect(created.body.data.type).toBe("BUY");
    expect(created.body.data.allocations[0]).toMatchObject({ symbol: "AAPL", price: 150, amount: 60, shares: 0.4 });

    const history = await request(app).get("/api/orders").expect(200);
    expect(history.body).toMatchObject({ count: 1 });
    expect(history.body.data[0].id).toBe(created.body.data.id);
  });

  it("rejects malformed or invalid requests with actionable errors", async () => {
    const response = await request(app).post("/api/orders").send({ ...orderRequest, amount: -1 }).expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown order and exposes service configuration", async () => {
    await request(app).get("/api/orders/missing").expect(404);
    await request(app).get("/api/config").expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ sharePrecision: 3, defaultPrice: 100, currency: "USD" });
    });
  });

  it("allows the Vite fallback origin on port 5174", async () => {
    await request(app)
      .get("/api/config")
      .set("Origin", "http://localhost:5174")
      .expect(200)
      .expect("Access-Control-Allow-Origin", "http://localhost:5174");
  });

  it("creates a reusable portfolio and returns it from the in-memory portfolio list", async () => {
    const portfolio = { name: "Balanced", holdings: [
      { symbol: "AAPL", allocationPercent: 70 },
      { symbol: "MSFT", allocationPercent: 30, marketPrice: 420 },
    ] };
    const created = await request(app).post("/api/portfolios").send(portfolio).expect(201);
    expect(created.body.data).toMatchObject({ name: "Balanced", holdings: portfolio.holdings });

    const history = await request(app).get("/api/portfolios").expect(200);
    expect(history.body).toMatchObject({ count: 1 });
    expect(history.body.data[0].id).toBe(created.body.data.id);
  });
});
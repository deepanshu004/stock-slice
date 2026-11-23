import { describe, expect, it, vi } from "vitest";
import type { BuyOrderInput } from "../domain/order.js";
import { AccountStore } from "../store/account-store.js";
import { OrderStore } from "../store/order-store.js";
import { AccountService } from "./account.service.js";
import { OrderService } from "./order.service.js";

function setup(precision = 3) {
  const accountStore = new AccountStore();
  const orderStore = new OrderStore();
  const account = new AccountService(accountStore, precision);
  const orders = new OrderService(orderStore, precision, account);
  return { accountStore, orderStore, account, orders };
}

const buy: BuyOrderInput = {
  type: "BUY",
  amount: 100,
  portfolio: { name: "Core", holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 3 }] },
};

describe("simulated account settlement", () => {
  it("starts empty and accumulates top-ups in integer cents", () => {
    const { account } = setup();
    expect(account.wallet()).toEqual({ balance: 0, currency: "USD", paymentMode: "demo" });
    expect(account.positions()).toEqual([]);
    account.topUp({ amount: 0.1, paymentMethod: "demo-card" });
    expect(account.topUp({ amount: 0.2, paymentMethod: "demo-card" }).balance).toBe(0.3);
  });

  it("debits the requested buy amount and keeps rounded share residual disclosed", () => {
    const { account, orders } = setup(2);
    account.topUp({ amount: 100, paymentMethod: "demo-card" });
    const order = orders.create(buy);
    expect(order).toMatchObject({ amount: 100, status: "COMPLETED", executionAt: order.createdAt });
    expect(order.allocations[0]).toMatchObject({ shares: 33.33, unallocatedAmount: 0.01 });
    expect(account.wallet().balance).toBe(0);
    expect(account.positions()).toEqual([{ symbol: "AAPL", quantity: 33.33, price: 3, marketValue: 99.99 }]);
  });

  it("uses integer share units through partial and complete fractional sells", () => {
    const { account, orders } = setup();
    account.topUp({ amount: 0.3, paymentMethod: "demo-card" });
    orders.create({ ...buy, amount: 0.3, portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 1 }] } });
    orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }] });
    expect(account.positions()[0]?.quantity).toBe(0.2);
    orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.2 }] });
    expect(account.positions()).toEqual([]);
    expect(account.wallet().balance).toBe(0.3);
  });

  it.each([
    { precision: 8, amount: 114, price: 7, quantity: 16.28571428 },
    { precision: 10, amount: 100, price: 23, quantity: 4.3478260869 },
  ])("settles generated share quantities at precision $precision", ({ precision, amount, price, quantity }) => {
    const { account, orders } = setup(precision);
    account.topUp({ amount, paymentMethod: "demo-card" });
    orders.create({ ...buy, amount, portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: price }] } });
    expect(account.positions()[0]?.quantity).toBe(quantity);
    orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity }] });
    expect(account.positions()).toEqual([]);
    expect(account.wallet().balance).toBe(amount);
  });

  it("allows closing a dust quantity even when proceeds round to zero", () => {
    const { accountStore, account, orders } = setup();
    accountStore.prepare({ balanceCents: 0, positions: [{ symbol: "AAPL", quantity: 0.001, price: 1 }] })();
    const order = orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.001 }] });
    expect(order.amount).toBe(0);
    expect(account.positions()).toEqual([]);
    expect(account.wallet().balance).toBe(0);
  });

  it("updates the stored reference price to the last buy price", () => {
    const { account, orders } = setup();
    account.topUp({ amount: 300, paymentMethod: "demo-card" });
    orders.create({ ...buy, portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 100 }] } });
    orders.create({ ...buy, portfolio: { holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: 200 }] } });
    expect(account.positions()).toEqual([{ symbol: "AAPL", quantity: 1.5, price: 200, marketValue: 300 }]);
    expect(orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 1.5 }] }).amount).toBe(300);
    expect(account.wallet().balance).toBe(400);
  });

  it("leaves account state and history unchanged on a failed multi-position sale", () => {
    const { account, orders, orderStore } = setup();
    account.topUp({ amount: 100, paymentMethod: "demo-card" });
    orders.create(buy);
    const before = account.positions();
    expect(() => orders.create({ type: "SELL", positions: [
      { symbol: "AAPL", quantity: 1 }, { symbol: "MISSING", quantity: 1 },
    ] })).toThrow("You do not own MISSING");
    expect(account.positions()).toEqual(before);
    expect(account.wallet().balance).toBe(0);
    expect(orderStore.size).toBe(1);
  });

  it("does not settle a prepared order if history storage fails", () => {
    const { account, orders, orderStore } = setup();
    account.topUp({ amount: 200, paymentMethod: "demo-card" });
    orders.create(buy);
    const before = account.positions();
    vi.spyOn(orderStore, "add").mockImplementation(() => { throw new Error("Storage unavailable"); });
    expect(() => orders.create(buy)).toThrow("Storage unavailable");
    expect(() => orders.create({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 1 }] })).toThrow("Storage unavailable");
    expect(account.positions()).toEqual(before);
    expect(account.wallet().balance).toBe(100);
    expect(orderStore.size).toBe(1);
  });

  it("rejects unsupported quantities without storing non-finite state", () => {
    const { account, orders, orderStore } = setup();
    account.topUp({ amount: 100, paymentMethod: "demo-card" });
    expect(() => orders.create({ ...buy, portfolio: {
      holdings: [{ symbol: "AAPL", allocationPercent: 100, marketPrice: Number.MIN_VALUE }],
    } })).toThrow("supported position quantity");
    expect(account.wallet().balance).toBe(100);
    expect(account.positions()).toEqual([]);
    expect(orderStore.size).toBe(0);
  });

  it("copies snapshots and validates prepared state before committing", () => {
    const { accountStore, account } = setup();
    account.topUp({ amount: 100, paymentMethod: "demo-card" });
    const snapshot = accountStore.snapshot();
    snapshot.balanceCents = 0;
    snapshot.positions.push({ symbol: "AAPL", quantity: 1, price: 1 });
    expect(account.wallet().balance).toBe(100);
    expect(account.positions()).toEqual([]);
    expect(() => accountStore.prepare({ balanceCents: -1, positions: [] })).toThrow(RangeError);
    expect(() => accountStore.prepare({ balanceCents: 0, positions: [{ symbol: "AAPL", quantity: Infinity, price: 1 }] })).toThrow(RangeError);
    expect(account.wallet().balance).toBe(100);
  });
});

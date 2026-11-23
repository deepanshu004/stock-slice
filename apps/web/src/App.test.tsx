import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Order, Portfolio } from "./types";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

interface TestPosition {
  symbol: string;
  quantity: number;
  price: number;
  marketValue: number;
}

function orderFixture(type: "BUY" | "SELL"): Order {
  return {
    id: `${type.toLowerCase()}-order-1`, type, amount: type === "BUY" ? 100 : 10,
    portfolioName: type === "BUY" ? "Core growth" : "Owned stocks",
    allocations: type === "BUY" ? [
      { symbol: "AAPL", allocationPercent: 60, price: 100, amount: 60, shares: 0.6, estimatedTradeValue: 60, unallocatedAmount: 0 },
      { symbol: "TSLA", allocationPercent: 40, price: 100, amount: 40, shares: 0.4, estimatedTradeValue: 40, unallocatedAmount: 0 },
    ] : [
      { symbol: "AAPL", allocationPercent: 100, price: 100, amount: 10, shares: 0.1, estimatedTradeValue: 10, unallocatedAmount: 0 },
    ],
    status: "COMPLETED",
    executionAt: "2026-11-21T12:00:00.000Z", executionTimezone: "America/New_York", createdAt: "2026-11-21T12:00:00.000Z",
  };
}

function mockDeskApi(options: { balance?: number; positions?: TestPosition[] } = {}) {
  const state = {
    wallet: { balance: options.balance ?? 0, currency: "USD" as const, paymentMode: "demo" as const },
    positions: options.positions ?? [],
    orders: [] as Order[],
    portfolios: [] as Portfolio[],
    orderError: "",
    topUpError: "",
  };

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/config")) return Response.json({ sharePrecision: 3, defaultPrice: 100, currency: "USD" });
    if (path.endsWith("/wallet/top-ups")) {
      if (state.topUpError) return Response.json({ error: { message: state.topUpError } }, { status: 400 });
      const input = JSON.parse(String(init?.body)) as { amount: number };
      state.wallet.balance += input.amount;
      return Response.json({ data: state.wallet }, { status: 201 });
    }
    if (path.endsWith("/wallet")) return Response.json({ data: state.wallet });
    if (path.endsWith("/positions")) return Response.json({ data: state.positions, count: state.positions.length });
    if (path.endsWith("/portfolios") && init?.method === "POST") {
      const input = JSON.parse(String(init.body)) as Omit<Portfolio, "id" | "createdAt">;
      const portfolio = { ...input, id: "portfolio-1", createdAt: "2026-11-21T12:00:00.000Z" };
      state.portfolios = [portfolio, ...state.portfolios];
      return Response.json({ data: portfolio }, { status: 201 });
    }
    if (path.endsWith("/portfolios")) return Response.json({ data: state.portfolios, count: state.portfolios.length });
    if (path.endsWith("/orders") && init?.method === "POST") {
      if (state.orderError) return Response.json({ error: { message: state.orderError } }, { status: 409 });
      const input = JSON.parse(String(init.body)) as { type: "BUY" | "SELL" };
      const order = orderFixture(input.type);
      state.orders = [order, ...state.orders];
      if (input.type === "BUY") {
        state.wallet.balance = 400;
        state.positions = [
          { symbol: "AAPL", quantity: 0.6, price: 100, marketValue: 60 },
          { symbol: "TSLA", quantity: 0.4, price: 100, marketValue: 40 },
        ];
      } else {
        state.wallet.balance = 410;
        state.positions = [
          { symbol: "AAPL", quantity: 0.5, price: 100, marketValue: 50 },
          { symbol: "TSLA", quantity: 0.4, price: 100, marketValue: 40 },
        ];
      }
      return Response.json({ data: order }, { status: 201 });
    }
    if (path.endsWith("/orders")) return Response.json({ data: state.orders, count: state.orders.length });
    throw new Error(`Unexpected API path ${path}`);
  });
  return state;
}

function postedBodies(path: string) {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith(path) && (init as RequestInit | undefined)?.method === "POST")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("order desk", () => {
  it("adds demo funds, buys the entered portfolio, and sells an owned quantity", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText("Operational");
    expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$0.00");

    fireEvent.click(screen.getByRole("button", { name: "Add money" }));
    const dialog = screen.getByRole("dialog", { name: "Add money" });
    expect(within(dialog).getByText(/Demo card.*4242/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/card number/i)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Top-up amount"), { target: { value: "500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add funds" }));
    await waitFor(() => expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$500.00"));
    expect(postedBodies("/wallet/top-ups")).toEqual([{ amount: 500, paymentMethod: "demo-card" }]);

    fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(await screen.findByText("Buy order completed")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$400.00"));
    expect(postedBodies("/orders")[0]).toEqual({
      type: "BUY", amount: 100,
      portfolio: { name: "Core growth", holdings: [
        { symbol: "AAPL", allocationPercent: 60 },
        { symbol: "TSLA", allocationPercent: 40 },
      ] },
    });

    fireEvent.click(screen.getByRole("button", { name: "SELL" }));
    expect(screen.queryByLabelText("Investment amount")).not.toBeInTheDocument();
    const quantity = screen.getByLabelText("Sell quantity AAPL");
    fireEvent.click(screen.getByRole("button", { name: "Increase AAPL quantity" }));
    expect(quantity).toHaveValue(0.6);
    fireEvent.click(screen.getByRole("button", { name: "Increase AAPL quantity" }));
    expect(quantity).toHaveValue(0.6);
    fireEvent.click(screen.getByRole("button", { name: "Decrease AAPL quantity" }));
    expect(quantity).toHaveValue(0);
    fireEvent.change(quantity, { target: { value: "0.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    expect(await screen.findByText("Sell order completed")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$410.00"));
    expect(postedBodies("/orders")[1]).toEqual({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }] });
    expect(screen.getByLabelText("Sell quantity AAPL")).toHaveAttribute("max", "0.5");
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("prevents buying without enough wallet funds", async () => {
    mockDeskApi({ balance: 10 });
    render(<App />);
    await screen.findByText("Operational");
    fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
    expect(screen.getByText(/Insufficient wallet balance/)).toBeInTheDocument();
    expect(postedBodies("/orders")).toEqual([]);
  });

  it("shows the empty sell state and returns to buying stocks", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText("Operational");
    fireEvent.click(screen.getByRole("button", { name: "SELL" }));
    expect(screen.queryByLabelText(/Sell quantity/)).not.toBeInTheDocument();
    const buyStocks = screen.getByRole("button", { name: "Buy stocks" });
    fireEvent.click(buyStocks);
    expect(screen.getByLabelText("Investment amount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BUY" })).toHaveAttribute("aria-pressed", "true");
    expect(postedBodies("/orders")).toEqual([]);
  });

  it("keeps the wallet unchanged when a demo top-up is rejected", async () => {
    const state = mockDeskApi({ balance: 25 });
    state.topUpError = "Unable to add demo funds. Please try again.";
    render(<App />);
    await screen.findByText("Operational");
    fireEvent.click(screen.getByRole("button", { name: "Add money" }));
    const dialog = screen.getByRole("dialog", { name: "Add money" });
    fireEvent.change(within(dialog).getByLabelText("Top-up amount"), { target: { value: "50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add funds" }));
    expect(await screen.findByText(state.topUpError)).toBeInTheDocument();
    expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$25.00");
    expect(screen.getByRole("dialog", { name: "Add money" })).toBeInTheDocument();
  });

  it("shows sell errors while keeping the owned stock available", async () => {
    const state = mockDeskApi({ positions: [{ symbol: "AAPL", quantity: 0.6, price: 100, marketValue: 60 }] });
    state.orderError = "The requested sell quantity exceeds your owned shares.";
    render(<App />);
    await screen.findByText("Operational");
    fireEvent.click(screen.getByRole("button", { name: "SELL" }));
    fireEvent.change(screen.getByLabelText("Sell quantity AAPL"), { target: { value: "0.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    expect(await screen.findByText(state.orderError)).toBeInTheDocument();
    expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$0.00");
    expect(screen.getByLabelText("Sell quantity AAPL")).toHaveAttribute("max", "0.6");
    expect(screen.queryByText("Sell order completed")).not.toBeInTheDocument();
  });

  it("shows a useful service error instead of failing silently", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/Unable to reach the order service/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  });

  it("saves the editable model portfolio through the portfolio endpoint", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText("Operational");
    fireEvent.click(screen.getByRole("button", { name: "Save portfolio" }));
    expect(await screen.findByText("Portfolio saved")).toBeInTheDocument();
    expect(postedBodies("/portfolios")).toEqual([{
      name: "Core growth", holdings: [
        { symbol: "AAPL", allocationPercent: 60 },
        { symbol: "TSLA", allocationPercent: 40 },
      ],
    }]);
  });
});

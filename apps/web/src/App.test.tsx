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
    status: "SCHEDULED",
    executionAt: "2026-11-23T14:30:00.000Z", executionTimezone: "America/New_York", createdAt: "2026-11-21T12:00:00.000Z",
  };
}

const simulationFixtures: Record<string, Pick<Order, "status" | "executionAt" | "createdAt">> = {
  "2026-11-21": { status: "SCHEDULED", createdAt: "2026-11-21T17:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
  "2026-11-22": { status: "SCHEDULED", createdAt: "2026-11-22T17:00:00.000Z", executionAt: "2026-11-23T14:30:00.000Z" },
  "2026-11-23": { status: "COMPLETED", createdAt: "2026-11-23T17:00:00.000Z", executionAt: "2026-11-23T17:00:00.000Z" },
};

function mockDeskApi(options: {
  balance?: number;
  positions?: TestPosition[];
  orderTiming?: Pick<Order, "status" | "executionAt" | "createdAt">;
} = {}) {
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
      const input = JSON.parse(String(init.body)) as { type: "BUY" | "SELL"; simulationDate?: string };
      const timing = input.simulationDate ? simulationFixtures[input.simulationDate] : options.orderTiming;
      if (input.simulationDate && !timing) throw new Error(`Unexpected test date ${input.simulationDate}`);
      const order = {
        ...orderFixture(input.type), ...timing,
        id: `${input.type.toLowerCase()}-order-${state.orders.length + 1}`,
        ...(input.simulationDate ? { simulationDate: input.simulationDate } : {}),
      };
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
  it("adds demo funds and schedules weekend buy and sell orders for Monday market open", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText(/Connected to API/);
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
    expect(await screen.findByText("Buy order scheduled")).toBeInTheDocument();
    const buySchedule = screen.getByRole("group", { name: "Execution schedule" });
    expect(buySchedule).toHaveTextContent("Monday, Nov 23");
    expect(buySchedule).toHaveTextContent("9:30 AM EST · Next market open");
    expect(buySchedule).toHaveTextContent("SCHEDULED");
    const buyHistory = screen.getByRole("button", { name: /BUY order/ });
    expect(buyHistory).toHaveTextContent("Nov 23");
    expect(buyHistory).toHaveTextContent("9:30 AM EST");
    expect(buyHistory).toHaveTextContent("Nov 21");
    expect(within(buyHistory).getByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
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
    expect(await screen.findByText("Sell order scheduled")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Execution schedule" })).toHaveTextContent("Monday, Nov 23");
    expect(screen.getByRole("group", { name: "Execution schedule" })).toHaveTextContent("9:30 AM EST · Next market open");
    await waitFor(() => expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$410.00"));
    expect(postedBodies("/orders")[1]).toEqual({ type: "SELL", positions: [{ symbol: "AAPL", quantity: 0.1 }] });
    expect(screen.getByLabelText("Sell quantity AAPL")).toHaveAttribute("max", "0.5");
    expect(screen.getAllByText("Scheduled")).toHaveLength(2);
  });

  it.each([
    { type: "BUY", createdAt: "2026-11-23T12:00:00.000Z", day: "Monday, Nov 23", date: "Nov 23", time: "7:00 AM" },
    { type: "SELL", createdAt: "2026-11-28T01:15:00.000Z", day: "Friday, Nov 27", date: "Nov 27", time: "8:15 PM" },
  ] as const)("shows instant weekday $type execution from the order response", async ({ type, createdAt, day, date, time }) => {
    mockDeskApi({
      balance: 500,
      positions: [{ symbol: "AAPL", quantity: 0.6, price: 100, marketValue: 60 }],
      orderTiming: { status: "COMPLETED", executionAt: createdAt, createdAt },
    });
    render(<App />);
    await screen.findByText(/Connected to API/);
    if (type === "BUY") {
      fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    } else {
      fireEvent.click(screen.getByRole("button", { name: "SELL" }));
      fireEvent.change(screen.getByLabelText("Sell quantity AAPL"), { target: { value: "0.1" } });
    }
    fireEvent.click(screen.getByRole("button", { name: type === "BUY" ? "Buy" : "Sell" }));
    expect(await screen.findByText(`${type === "BUY" ? "Buy" : "Sell"} order completed`)).toBeInTheDocument();
    const execution = screen.getByRole("group", { name: "Demo execution" });
    expect(execution).toHaveTextContent(day);
    expect(execution).toHaveTextContent(`${time} EST · Completed in your demo account`);
    expect(execution).toHaveTextContent("COMPLETED");
    const history = screen.getByRole("button", { name: new RegExp(`${type} order`) });
    expect(within(history).getAllByText(date)).toHaveLength(2);
    expect(history).toHaveTextContent(`${time} EST`);
    expect(history).toHaveTextContent(`${time} ET`);
    expect(within(history).getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Execution schedule" })).not.toBeInTheDocument();
  });

  it.each([
    { type: "BUY", simulationDate: "2026-11-21", status: "SCHEDULED", time: "9:30 AM EST" },
    { type: "SELL", simulationDate: "2026-11-22", status: "SCHEDULED", time: "9:30 AM EST" },
    { type: "BUY", simulationDate: "2026-11-23", status: "COMPLETED", time: "12:00 PM EST" },
    { type: "SELL", simulationDate: "2026-11-23", status: "COMPLETED", time: "12:00 PM EST" },
  ] as const)("tests $type orders on selected date $simulationDate", async ({ type, simulationDate, status, time }) => {
    mockDeskApi({ balance: 500, positions: [{ symbol: "AAPL", quantity: 0.6, price: 100, marketValue: 60 }] });
    render(<App />);
    const dateInput = screen.getByLabelText("Test order date (New York)");
    expect(dateInput).toBeDisabled();
    await screen.findByText(/Connected to API/);
    expect(dateInput).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Use current time" })).not.toBeInTheDocument();
    fireEvent.change(dateInput, { target: { value: simulationDate } });
    expect(dateInput).toHaveValue(simulationDate);
    expect(screen.getByRole("button", { name: "Use current time" })).toBeEnabled();
    if (type === "BUY") {
      fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    } else {
      fireEvent.click(screen.getByRole("button", { name: "SELL" }));
      fireEvent.change(screen.getByLabelText("Sell quantity AAPL"), { target: { value: "0.1" } });
    }
    fireEvent.click(screen.getByRole("button", { name: type === "BUY" ? "Buy" : "Sell" }));
    const scheduled = status === "SCHEDULED";
    expect(await screen.findByText(`${type === "BUY" ? "Buy" : "Sell"} order ${scheduled ? "scheduled" : "completed"}`)).toBeInTheDocument();
    expect(postedBodies("/orders")).toHaveLength(1);
    expect(postedBodies("/orders")[0]).toMatchObject({ type, simulationDate });
    const execution = screen.getByRole("group", { name: scheduled ? "Execution schedule" : "Demo execution" });
    expect(execution).toHaveTextContent("Monday, Nov 23");
    expect(execution).toHaveTextContent(time);
    expect(execution).toHaveTextContent(status);
    expect(execution).toHaveTextContent(`Test date: ${simulationDate} (New York, noon)`);
    const history = screen.getByRole("button", { name: new RegExp(`${type} order`) });
    expect(history).toHaveTextContent(`Test date: ${simulationDate}`);
    expect(history).toHaveTextContent("12:00 PM ET");
    expect(within(history).getByText(scheduled ? "Scheduled" : "Completed")).toBeInTheDocument();
  });

  it("clears the test date and result, then omits simulationDate when using current time", async () => {
    const createdAt = "2026-11-23T17:00:00.000Z";
    mockDeskApi({ balance: 500, orderTiming: { status: "COMPLETED", createdAt, executionAt: createdAt } });
    render(<App />);
    await screen.findByText(/Connected to API/);
    const dateInput = screen.getByLabelText("Test order date (New York)");
    fireEvent.change(dateInput, { target: { value: "2026-11-21" } });
    fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByText("Buy order scheduled");
    await waitFor(() => expect(screen.getByRole("button", { name: "Use current time" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Use current time" }));
    expect(dateInput).toHaveValue("");
    expect(dateInput).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Use current time" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Execution schedule" })).not.toBeInTheDocument();
    expect(screen.queryByText("Buy order scheduled")).not.toBeInTheDocument();
    const simulatedHistory = screen.getByRole("button", { name: /BUY order/ });
    expect(simulatedHistory).toHaveTextContent("Test date: 2026-11-21");
    fireEvent.click(simulatedHistory);
    expect(screen.getByRole("group", { name: "Execution schedule" })).toHaveTextContent("Test date: 2026-11-21");
    expect(dateInput).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    await screen.findByText("Buy order completed");
    expect(postedBodies("/orders")).toHaveLength(2);
    expect(postedBodies("/orders")[0]).toHaveProperty("simulationDate", "2026-11-21");
    expect(postedBodies("/orders")[1]).not.toHaveProperty("simulationDate");
    expect(screen.getByRole("group", { name: "Demo execution" })).not.toHaveTextContent("Test date:");
  });

  it("prevents buying without enough wallet funds", async () => {
    mockDeskApi({ balance: 10 });
    render(<App />);
    await screen.findByText(/Connected to API/);
    fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
    expect(screen.getByText(/Insufficient wallet balance/)).toBeInTheDocument();
    expect(postedBodies("/orders")).toEqual([]);
  });

  it("shows the empty sell state and returns to buying stocks", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText(/Connected to API/);
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
    await screen.findByText(/Connected to API/);
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
    await screen.findByText(/Connected to API/);
    fireEvent.click(screen.getByRole("button", { name: "SELL" }));
    fireEvent.change(screen.getByLabelText("Sell quantity AAPL"), { target: { value: "0.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    expect(await screen.findByText(state.orderError)).toBeInTheDocument();
    expect(screen.getByLabelText("Wallet balance")).toHaveTextContent("$0.00");
    expect(screen.getByLabelText("Sell quantity AAPL")).toHaveAttribute("max", "0.6");
    expect(screen.queryByText("Sell order scheduled")).not.toBeInTheDocument();
  });

  it("shows a useful service error instead of failing silently", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/Unable to reach the order service/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy" })).toBeDisabled();
  });

  it("keeps completed orders marked completed in history and the preview", async () => {
    const state = mockDeskApi();
    const order = orderFixture("BUY");
    state.orders = [{ ...order, status: "COMPLETED", executionAt: "2026-11-23T12:00:00.000Z", createdAt: "2026-11-23T12:00:00.000Z" }];
    render(<App />);
    await screen.findByText(/Connected to API/);
    const history = screen.getByRole("button", { name: /BUY order/ });
    expect(within(history).getByText("Completed")).toBeInTheDocument();
    fireEvent.click(history);
    const execution = screen.getByRole("group", { name: "Demo execution" });
    expect(execution).toHaveTextContent("Monday, Nov 23");
    expect(execution).toHaveTextContent("7:00 AM EST · Completed in your demo account");
    expect(execution).toHaveTextContent("COMPLETED");
    expect(screen.queryByRole("group", { name: "Execution schedule" })).not.toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
  });

  it("saves the editable model portfolio through the portfolio endpoint", async () => {
    mockDeskApi();
    render(<App />);
    await screen.findByText(/Connected to API/);
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

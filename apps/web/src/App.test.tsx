import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("order desk", () => {
  it("loads API-backed configuration and submits the entered portfolio", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/config")) {
        return Response.json({ sharePrecision: 3, defaultPrice: 100, currency: "USD" });
      }
      if (String(url).endsWith("/orders") && init?.method === "POST") {
        return Response.json({ data: {
          id: "order-1", type: "BUY", amount: 100, portfolioName: "Core growth",
          allocations: [{ symbol: "AAPL", allocationPercent: 60, price: 100, amount: 60, shares: 0.6, estimatedTradeValue: 60, unallocatedAmount: 0 }],
          executionAt: "2026-11-23T14:30:00.000Z", executionTimezone: "America/New_York", createdAt: "2026-11-20T12:00:00.000Z",
        } }, { status: 201 });
      }
      return Response.json({ data: [], count: 0 });
    });

    render(<App />);
    await screen.findByText("Operational");
    fireEvent.change(screen.getByLabelText("Investment amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate order" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/orders"),
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("Order created")).toBeInTheDocument();
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
  });

  it("shows a useful service error instead of failing silently", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/Unable to reach the order service/)).toBeInTheDocument();
  });

  it("saves the editable model portfolio through the portfolio endpoint", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/config")) {
        return Response.json({ sharePrecision: 3, defaultPrice: 100, currency: "USD" });
      }
      if (String(url).endsWith("/portfolios") && init?.method === "POST") {
        return Response.json({ data: { id: "portfolio-1", name: "Core growth", holdings: [], createdAt: "2026-11-20T12:00:00.000Z" } }, { status: 201 });
      }
      return Response.json({ data: [], count: 0 });
    });

    render(<App />);
    await screen.findByText("Operational");
    fireEvent.click(screen.getByRole("button", { name: "Save portfolio" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/portfolios"),
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("Portfolio saved")).toBeInTheDocument();
  });
});
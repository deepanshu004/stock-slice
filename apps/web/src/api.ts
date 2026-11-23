import type { ApiConfig, CreateOrderInput, Order, Portfolio, PortfolioInput, Position, Wallet } from "./types";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("Unable to reach the order service. Check that the API is running and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      ? String((body.error as { message?: string }).message ?? "Request failed")
      : "Request failed. Please try again.";
    throw new Error(message);
  }
  return body as T;
}

export async function fetchConfig(): Promise<ApiConfig> {
  return request<ApiConfig>("/config");
}

export async function fetchOrders(): Promise<Order[]> {
  const result = await request<{ data: Order[] }>("/orders");
  return result.data;
}

export async function fetchPortfolios(): Promise<Portfolio[]> {
  const result = await request<{ data: Portfolio[] }>("/portfolios");
  return result.data;
}

export async function savePortfolio(input: PortfolioInput): Promise<Portfolio> {
  const result = await request<{ data: Portfolio }>("/portfolios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function submitOrder(input: CreateOrderInput): Promise<Order> {
  const result = await request<{ data: Order }>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function fetchWallet(): Promise<Wallet> {
  const result = await request<{ data: Wallet }>("/wallet");
  return result.data;
}

export async function topUpWallet(amount: number): Promise<Wallet> {
  const result = await request<{ data: Wallet }>("/wallet/top-ups", {
    method: "POST",
    body: JSON.stringify({ amount, paymentMethod: "demo-card" }),
  });
  return result.data;
}

export async function fetchPositions(): Promise<Position[]> {
  const result = await request<{ data: Position[] }>("/positions");
  return result.data;
}

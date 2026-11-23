export type OrderType = "BUY" | "SELL";

export interface HoldingInput {
  symbol: string;
  allocationPercent: string;
  marketPrice: string;
}

export interface OrderAllocation {
  symbol: string;
  allocationPercent: number;
  price: number;
  amount: number;
  shares: number;
  estimatedTradeValue: number;
  unallocatedAmount: number;
}

export interface Order {
  id: string;
  type: OrderType;
  amount: number;
  portfolioName: string;
  allocations: OrderAllocation[];
  executionAt: string;
  executionTimezone: string;
  createdAt: string;
  status: "COMPLETED";
}

export interface ApiConfig {
  sharePrecision: number;
  defaultPrice: number;
  currency: string;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: { symbol: string; allocationPercent: number; marketPrice?: number }[];
  createdAt: string;
}

export interface PortfolioInput {
  name: string;
  holdings: { symbol: string; allocationPercent: number; marketPrice?: number }[];
}

export type CreateOrderInput = {
  type: "BUY";
  amount: number;
  portfolio: PortfolioInput;
} | {
  type: "SELL";
  positions: { symbol: string; quantity: number }[];
};

export interface Wallet {
  balance: number;
  currency: "USD";
  paymentMode: "demo";
}

export interface Position {
  symbol: string;
  quantity: number;
  price: number;
  marketValue: number;
}

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
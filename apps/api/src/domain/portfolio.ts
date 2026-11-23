export interface Holding {
  symbol: string;
  allocationPercent: number;
  marketPrice?: number | undefined;
}

export interface CreatePortfolioInput {
  name?: string | undefined;
  holdings: Holding[];
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: Holding[];
  createdAt: string;
}

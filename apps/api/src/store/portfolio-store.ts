export interface Portfolio {
  id: string;
  name: string;
  holdings: { symbol: string; allocationPercent: number; marketPrice?: number }[];
  createdAt: string;
}

export class PortfolioStore {
  private readonly portfolios = new Map<string, Portfolio>();

  add(portfolio: Portfolio): Portfolio {
    this.portfolios.set(portfolio.id, portfolio);
    return portfolio;
  }

  list(): Portfolio[] {
    return [...this.portfolios.values()].reverse();
  }
}
import type { Portfolio } from "../domain/portfolio.js";

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

import { randomUUID } from "node:crypto";
import type { CreatePortfolioInput, Portfolio } from "../domain/portfolio.js";
import type { PortfolioStore } from "../store/portfolio-store.js";

export class PortfolioService {
  constructor(private readonly store: PortfolioStore) {}

  create(input: CreatePortfolioInput): Portfolio {
    const holdings = input.holdings.map((holding) => ({
      symbol: holding.symbol,
      allocationPercent: holding.allocationPercent,
      ...(holding.marketPrice === undefined ? {} : { marketPrice: holding.marketPrice }),
    }));

    return this.store.add({
      id: randomUUID(),
      name: input.name ?? "Untitled portfolio",
      holdings,
      createdAt: new Date().toISOString(),
    });
  }

  list(): Portfolio[] {
    return this.store.list();
  }
}

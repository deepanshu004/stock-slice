import type { RequestHandler } from "express";
import { portfolioSchema } from "../schemas/portfolio.schema.js";
import type { PortfolioService } from "../services/portfolio.service.js";

export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  readonly create: RequestHandler = (request, response) => {
    const input = portfolioSchema.parse(request.body);
    const portfolio = this.portfolioService.create(input);
    response.status(201).json({ data: portfolio });
  };

  readonly list: RequestHandler = (_request, response) => {
    const portfolios = this.portfolioService.list();
    response.json({ data: portfolios, count: portfolios.length });
  };
}

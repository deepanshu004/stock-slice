import { Router } from "express";
import { PortfolioController } from "../controllers/portfolio.controller.js";
import type { PortfolioService } from "../services/portfolio.service.js";

export function createPortfolioRouter(portfolioService: PortfolioService): Router {
  const router = Router();
  const controller = new PortfolioController(portfolioService);

  router.post("/", controller.create);
  router.get("/", controller.list);

  return router;
}

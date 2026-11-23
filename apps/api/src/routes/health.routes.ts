import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";
import type { OrderService } from "../services/order.service.js";

export function createHealthRouter(orderService: OrderService): Router {
  const router = Router();
  const controller = new HealthController(orderService);

  router.get("/", controller.get);

  return router;
}

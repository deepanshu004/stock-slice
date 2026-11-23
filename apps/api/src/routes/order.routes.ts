import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { createOrderRateLimiter } from "../middleware/order-rate-limit.js";
import type { OrderService } from "../services/order.service.js";

export function createOrderRouter(orderService: OrderService, sharePrecision: number): Router {
  const router = Router();
  const controller = new OrderController(orderService, sharePrecision);

  router.post("/", createOrderRateLimiter(), controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.get);

  return router;
}

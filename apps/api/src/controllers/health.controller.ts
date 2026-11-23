import type { RequestHandler } from "express";
import type { OrderService } from "../services/order.service.js";

export class HealthController {
  constructor(private readonly orderService: OrderService) {}

  readonly get: RequestHandler = (_request, response) => {
    response.json({ status: "ok", storage: "in-memory", orders: this.orderService.count });
  };
}

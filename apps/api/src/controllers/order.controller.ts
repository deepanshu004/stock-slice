import type { RequestHandler } from "express";
import { createPlaceOrderSchema } from "../schemas/order.schema.js";
import type { OrderService } from "../services/order.service.js";

export class OrderController {
  private readonly schema;

  constructor(private readonly orderService: OrderService, sharePrecision: number) {
    this.schema = createPlaceOrderSchema(sharePrecision);
  }

  readonly create: RequestHandler = (request, response) => {
    const input = this.schema.parse(request.body);
    const order = this.orderService.create(input);
    response.status(201).json({ data: order });
  };

  readonly list: RequestHandler = (_request, response) => {
    response.json({ data: this.orderService.list(), count: this.orderService.count });
  };

  readonly get: RequestHandler<{ id: string }> = (request, response) => {
    const order = this.orderService.get(request.params.id);
    if (!order) {
      response.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found" } });
      return;
    }
    response.json({ data: order });
  };
}

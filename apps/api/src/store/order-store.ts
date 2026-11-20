import type { Order } from "../domain/order.js";

export class OrderStore {
  private readonly orders = new Map<string, Order>();

  add(order: Order): Order {
    this.orders.set(order.id, order);
    return order;
  }

  get(id: string): Order | undefined {
    return this.orders.get(id);
  }

  list(): Order[] {
    return [...this.orders.values()].reverse();
  }

  get size(): number {
    return this.orders.size;
  }
}
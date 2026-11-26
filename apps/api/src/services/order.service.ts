import { createOrder, type PlaceOrderInput, type Order, type SharePrecision } from "../domain/order.js";
import { createSellOrder } from "../domain/sell-order.js";
import type { OrderStore } from "../store/order-store.js";
import type { AccountService } from "./account.service.js";

export class OrderService {
  constructor(
    private readonly store: OrderStore,
    private readonly sharePrecision: SharePrecision,
    private readonly accountService: AccountService,
  ) {}

  create(input: PlaceOrderInput): Order {
    let order: Order;
    let commit: () => void;
    if (input.type === "BUY") {
      order = createOrder(input, this.sharePrecision);
      commit = this.accountService.prepareBuy(order);
    } else {
      const sale = this.accountService.prepareSell(input);
      order = createSellOrder(sale.positions);
      commit = sale.commit;
    }
    const stored = this.store.add(order);
    commit();
    return stored;
  }

  get(id: string): Order | undefined {
    return this.store.get(id);
  }

  list(): Order[] {
    return this.store.list();
  }

  get count(): number {
    return this.store.size;
  }
}

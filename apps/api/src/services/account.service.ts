import type { AccountPosition, Position, TopUpInput, Wallet } from "../domain/account.js";
import type { Order, SellOrderInput, SharePrecision } from "../domain/order.js";
import { shareQuantityUnits } from "../domain/share-quantity.js";
import { HttpError } from "../errors/http-error.js";
import type { AccountStore } from "../store/account-store.js";

export class AccountService {
  private readonly scale: number;

  constructor(private readonly store: AccountStore, private readonly sharePrecision: SharePrecision) {
    this.scale = 10 ** sharePrecision;
  }

  wallet(): Wallet {
    return { balance: this.store.snapshot().balanceCents / 100, currency: "USD", paymentMode: "demo" };
  }

  positions(): Position[] {
    return this.store.snapshot().positions.map((position) => ({
      ...position,
      marketValue: Math.round(position.quantity * position.price * 100) / 100,
    }));
  }

  topUp(input: TopUpInput): Wallet {
    const state = this.store.snapshot();
    state.balanceCents = this.addCents(state.balanceCents, Math.round(input.amount * 100));
    this.store.prepare(state)();
    return this.wallet();
  }

  prepareBuy(order: Order): () => void {
    const state = this.store.snapshot();
    const amountCents = Math.round(order.amount * 100);
    if (state.balanceCents < amountCents) {
      throw new HttpError(409, "INSUFFICIENT_FUNDS", "Add funds to your wallet before placing this buy order");
    }
    state.balanceCents -= amountCents;
    const positions = new Map(state.positions.map((position) => [position.symbol, position]));
    for (const allocation of order.allocations) {
      if (allocation.shares === 0) continue;
      const current = positions.get(allocation.symbol);
      const units = this.quantityUnits(current?.quantity ?? 0) + this.quantityUnits(allocation.shares);
      if (!Number.isSafeInteger(units)) {
        throw new HttpError(409, "POSITION_LIMIT_EXCEEDED", "This buy order exceeds the supported position quantity");
      }
      positions.set(allocation.symbol, { symbol: allocation.symbol, quantity: units / this.scale, price: allocation.price });
    }
    state.positions = [...positions.values()];
    return this.store.prepare(state);
  }

  prepareSell(input: SellOrderInput): { positions: AccountPosition[]; commit: () => void } {
    const state = this.store.snapshot();
    const owned = new Map(state.positions.map((position) => [position.symbol, position]));
    const positions: AccountPosition[] = [];
    for (const selected of input.positions) {
      const position = owned.get(selected.symbol);
      if (!position) {
        throw new HttpError(409, "POSITION_NOT_FOUND", `You do not own ${selected.symbol}`);
      }
      const ownedUnits = this.quantityUnits(position.quantity);
      const sellUnits = this.quantityUnits(selected.quantity);
      if (sellUnits > ownedUnits) {
        throw new HttpError(409, "INSUFFICIENT_QUANTITY", `Sell quantity exceeds your ${selected.symbol} position`);
      }
      const proceedsCents = Math.round(selected.quantity * position.price * 100);
      state.balanceCents = this.addCents(state.balanceCents, proceedsCents);
      positions.push({ symbol: selected.symbol, quantity: selected.quantity, price: position.price });
      const remainingUnits = ownedUnits - sellUnits;
      if (remainingUnits === 0) owned.delete(selected.symbol);
      else owned.set(selected.symbol, { ...position, quantity: remainingUnits / this.scale });
    }
    state.positions = [...owned.values()];
    return { positions, commit: this.store.prepare(state) };
  }

  private addCents(balanceCents: number, amountCents: number): number {
    const total = balanceCents + amountCents;
    if (!Number.isSafeInteger(amountCents) || amountCents < 0 || !Number.isSafeInteger(total) || total < 0) {
      throw new HttpError(409, "WALLET_LIMIT_EXCEEDED", "This operation exceeds the supported wallet balance");
    }
    return total;
  }

  private quantityUnits(quantity: number): number {
    const units = shareQuantityUnits(quantity, this.sharePrecision);
    if (units === undefined) {
      throw new HttpError(409, "POSITION_LIMIT_EXCEEDED", "This order exceeds the supported position quantity");
    }
    return units;
  }
}

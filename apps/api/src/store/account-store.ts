import type { AccountState } from "../domain/account.js";

function copyState(state: AccountState): AccountState {
  return { balanceCents: state.balanceCents, positions: state.positions.map((position) => ({ ...position })) };
}

export class AccountStore {
  private state: AccountState = { balanceCents: 0, positions: [] };

  snapshot(): AccountState {
    return copyState(this.state);
  }

  // Validate and copy before order history changes. The returned commit only swaps prepared state.
  prepare(state: AccountState): () => void {
    if (!Number.isSafeInteger(state.balanceCents) || state.balanceCents < 0) {
      throw new RangeError("Wallet balance must be a nonnegative safe integer in cents");
    }
    const symbols = new Set<string>();
    for (const position of state.positions) {
      const marketValueCents = Math.round(position.quantity * position.price * 100);
      if (!/^[A-Z0-9.-]{1,12}$/.test(position.symbol) || symbols.has(position.symbol)
        || !Number.isFinite(position.quantity) || position.quantity <= 0
        || !Number.isFinite(position.price) || position.price <= 0
        || !Number.isSafeInteger(marketValueCents) || marketValueCents < 0) {
        throw new RangeError("Positions must have unique symbols, positive quantities, and finite prices and values");
      }
      symbols.add(position.symbol);
    }
    const prepared = copyState(state);
    return () => { this.state = prepared; };
  }
}

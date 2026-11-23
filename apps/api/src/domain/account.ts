export interface Wallet {
  balance: number;
  currency: "USD";
  paymentMode: "demo";
}

export interface AccountPosition {
  symbol: string;
  quantity: number;
  price: number;
}

export interface Position extends AccountPosition {
  marketValue: number;
}

export interface AccountState {
  balanceCents: number;
  positions: AccountPosition[];
}

export interface TopUpInput {
  amount: number;
  paymentMethod: "demo-card";
}

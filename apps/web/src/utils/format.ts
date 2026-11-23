export const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value));
}

export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(quantity);
}

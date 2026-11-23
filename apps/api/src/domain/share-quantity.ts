// Convert the decimal representation directly so valid fractional shares do not fail on binary multiplication error.
export function shareQuantityUnits(quantity: number, precision: number): number | undefined {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(precision) || precision < 0 || precision > 10) {
    return undefined;
  }
  const [coefficient = "", exponent = "0"] = quantity.toString().split("e");
  const [whole = "", fraction = ""] = coefficient.split(".");
  const shift = precision + Number(exponent) - fraction.length;
  if (shift < 0) return undefined;
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  if (digits.length + shift > 16) return undefined;
  const units = Number(BigInt(digits) * 10n ** BigInt(shift));
  return Number.isSafeInteger(units) ? units : undefined;
}

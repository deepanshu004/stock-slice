function readInteger(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export const config = {
  port: readInteger("PORT", 4000, 1, 65535),
  sharePrecision: readInteger("SHARE_PRECISION", 3, 0, 10),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5174,http://localhost:5175")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
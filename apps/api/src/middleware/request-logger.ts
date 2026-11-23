import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  response.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs.toFixed(2)}ms`);
  });
  next();
};

import type { RequestHandler } from "express";

export const cacheControl: RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
};

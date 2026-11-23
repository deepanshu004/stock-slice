import type { RequestHandler } from "express";
import type { AppConfig } from "../config/env.js";

export class ConfigController {
  constructor(private readonly config: AppConfig) {}

  readonly get: RequestHandler = (_request, response) => {
    response.json({ sharePrecision: this.config.sharePrecision, defaultPrice: 100, currency: "USD" });
  };
}

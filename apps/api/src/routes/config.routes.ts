import { Router } from "express";
import type { AppConfig } from "../config/env.js";
import { ConfigController } from "../controllers/config.controller.js";

export function createConfigRouter(config: AppConfig): Router {
  const router = Router();
  const controller = new ConfigController(config);

  router.get("/", controller.get);

  return router;
}

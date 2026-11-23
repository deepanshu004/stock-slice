import { Router } from "express";
import { PositionController } from "../controllers/position.controller.js";
import type { AccountService } from "../services/account.service.js";

export function createPositionRouter(accountService: AccountService): Router {
  const router = Router();
  const controller = new PositionController(accountService);
  router.get("/", controller.list);
  return router;
}

import type { RequestHandler } from "express";
import type { AccountService } from "../services/account.service.js";

export class PositionController {
  constructor(private readonly accountService: AccountService) {}

  readonly list: RequestHandler = (_request, response) => {
    const positions = this.accountService.positions();
    response.json({ data: positions, count: positions.length });
  };
}

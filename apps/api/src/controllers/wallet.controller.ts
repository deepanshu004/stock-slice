import type { RequestHandler } from "express";
import { topUpSchema } from "../schemas/wallet.schema.js";
import type { AccountService } from "../services/account.service.js";

export class WalletController {
  constructor(private readonly accountService: AccountService) {}

  readonly get: RequestHandler = (_request, response) => {
    response.json({ data: this.accountService.wallet() });
  };

  readonly topUp: RequestHandler = (request, response) => {
    const input = topUpSchema.parse(request.body);
    response.status(201).json({ data: this.accountService.topUp(input) });
  };
}

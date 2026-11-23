# Stock Slice

Stock Slice is a TypeScript portfolio-trading demo. Add funds with a simulated credit card, buy a model portfolio using the wallet balance, and sell quantities of stocks you own. The API calculates fractional shares at a configurable precision and keeps the wallet, positions, orders, and portfolios in memory for the lifetime of the process. No real cards are charged and no trades are routed to a broker.

## Requirements

- Node.js 20 or newer and npm 10 or newer
- macOS, Linux, or Windows

## Install and run

```sh
npm install
npm run dev
```

The dashboard is available at `http://localhost:5174` and the API at `http://localhost:4000`. The Vite app calls the API directly; set `VITE_API_URL` when the API is hosted elsewhere. To configure the API, copy `apps/api/.env.example` to `apps/api/.env` and adjust the values before starting it.

The wallet starts at USD 0. Choose **Add money**, enter an amount, and use the demo card to fund it. **Buy** debits the wallet and adds the purchased shares to your positions. **Sell** displays those positions with quantity inputs and minus/plus controls; a completed sale credits its proceeds back to the wallet. Balances and positions survive a page refresh and reset when the API process restarts.

## Tests and builds

```sh
npm test
npm run typecheck
npm run build
```

API tests use Vitest and Supertest; frontend tests use Vitest, jsdom, and Testing Library. `npm run build` emits the API into `apps/api/dist` and creates the static frontend bundle in `apps/web/dist`. Run a built API with `npm run start --workspace @stock-slice/api`; serve the frontend bundle with any static web server.

## API source structure

```text
apps/api/src/
├── app.ts          # Compose dependencies, middleware, and routes
├── server.ts       # Start the HTTP listener
├── config/         # Environment configuration and validation
├── routes/         # Resource paths, methods, and route middleware
├── controllers/    # Request validation and HTTP responses
├── services/       # Coordinate domain logic and persistence
├── domain/         # Domain types, allocation, and scheduling rules
├── schemas/        # Zod request schemas
├── store/          # In-memory account, order, and portfolio persistence
├── middleware/     # Logging, cache control, and rate limiting
└── handlers/       # Central error-to-response mapping
```

Keep resource routes and controllers in separate `*.routes.ts` and `*.controller.ts` files, with orchestration in `*.service.ts` files where needed. Controllers parse requests through schemas and call services; services use domain functions and stores. HTTP request/response concerns stay in controllers, middleware, and handlers, while domain logic and stores remain independent of Express.

`createApp({ config, orderStore, portfolioStore, accountStore })` accepts dependencies for testing or alternate configuration. Each call creates fresh default stores and its own rate limiters, so tests can isolate application state without accessing private store fields. `app.ts` exports the assembled application; `server.ts` owns the listener. Tests stay beside the code they exercise as `*.test.ts` files. The API's `tsconfig.build.json` excludes tests from compilation for production, while `tsconfig.json` includes them for typechecking.

In the frontend, `src/hooks/useTradingDesk.ts` owns account loading and trading actions; `src/components/` contains the order form, wallet funding dialog, and owned-stock controls. `App.tsx` assembles the dashboard, and `src/api.ts` handles HTTP requests.

## API

The complete OpenAPI 3.1 description is in [`apps/api/openapi.yaml`](apps/api/openapi.yaml). JSON requests and responses use USD amounts as decimal numbers, with request amounts limited to cents. See [`docs/api-examples.md`](docs/api-examples.md) for copyable request and response examples.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Process health and in-memory order count |
| `GET` | `/api/config` | Share precision, default price, and currency |
| `GET` | `/api/wallet` | Current demo wallet balance |
| `POST` | `/api/wallet/top-ups` | Add simulated card funds |
| `GET` | `/api/positions` | Owned symbols, quantities, reference prices, and values |
| `GET` | `/api/portfolios` | List portfolios saved since startup |
| `POST` | `/api/portfolios` | Validate and save a reusable model portfolio |
| `POST` | `/api/orders` | Place a simulated BUY or quantity-based SELL |
| `GET` | `/api/orders` | List session order history, newest first |
| `GET` | `/api/orders/{id}` | Retrieve a session order |

Fund the wallet before placing a buy:

```sh
curl -X POST http://localhost:4000/api/wallet/top-ups \
  -H 'Content-Type: application/json' \
  -d '{"amount":1000,"paymentMethod":"demo-card"}'
```

Example buy request:

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY","amount":100,"portfolio":{"name":"Core","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}}'
```

Example sale of a previously purchased quantity:

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"SELL","positions":[{"symbol":"AAPL","quantity":0.1}]}'
```

The default share precision is 3 decimal places and can be changed with `SHARE_PRECISION` (integer from 0 to 10). `CORS_ORIGIN` accepts a comma-separated origin allowlist; by default it permits Vite on ports 5174 and 5175. A partner-provided buy `marketPrice` takes priority over the fixed USD 100 price. Buy allocations must be positive and total 100%; symbols must be unique. Dollar allocations use integer cents and distribute rounding remainders by largest fractional remainder. Shares are rounded down so their estimated trade value never exceeds the allocation. Any residual is returned as `unallocatedAmount`; the wallet is debited by the full requested buy amount.

Placed demo orders complete immediately with status `COMPLETED` and `executionAt` equal to `createdAt`. Sells use the last simulated purchase price recorded for each symbol and round each symbol's proceeds to cents. The API rejects insufficient funds, unowned symbols, excess sell quantities, duplicate symbols, and quantities beyond the configured precision. Rejected orders do not change the wallet, positions, or order history. The standalone weekday market-open helper remains available in the domain; it does not delay the demo's bookkeeping.

Requests log method, path, status, and elapsed milliseconds to the API console. The API also applies Helmet security headers, a configurable CORS allowlist, a JSON body-size limit, input schemas, and per-IP rate limits for order creation and demo funding.

## Libraries

- Express 5: REST API and middleware
- Zod: runtime request validation
- Luxon: timezone-aware weekday scheduling
- Helmet, CORS, express-rate-limit: baseline HTTP security controls
- React 19 and Vite: responsive browser application
- Lucide React: interface icons
- TypeScript: strict static typing across both workspaces
- Vitest, Supertest, Testing Library, jsdom: tests
- concurrently: run both development servers together

## Storage and deployment boundary

The wallet, owned positions, orders, and portfolios are process-local and shared by this demo instance. They are lost when the API exits or restarts. Funding uses a fixed demo card and accepts no real card details. The UI's initial sample holding inputs are editable form values; balances, positions, order data, configuration, saved portfolios, and history come from API calls. See [`ANSWERS.md`](ANSWERS.md) for design assumptions, limitations, and production migration controls.

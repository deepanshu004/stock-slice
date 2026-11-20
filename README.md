# Stock Slice

Stock Slice is a TypeScript order-allocation proof of concept for model portfolios. It splits a USD BUY or SELL order across holdings, calculates fractional shares at a configurable precision, schedules the order at a weekday market open, and keeps order and portfolio history in memory for the lifetime of the process. It does not execute trades or connect to a broker.

## Requirements

- Node.js 20 or newer and npm 10 or newer
- macOS, Linux, or Windows

## Install and run

```sh
npm install
npm run dev
```

The dashboard is available at `http://localhost:5174` and the API at `http://localhost:4000`. The Vite app calls the API directly; set `VITE_API_URL` when the API is hosted elsewhere. To configure the API, copy `apps/api/.env.example` to `apps/api/.env` and adjust the values before starting it.

## Tests and builds

```sh
npm test
npm run typecheck
npm run build
```

API tests use Vitest and Supertest; frontend tests use Vitest, jsdom, and Testing Library. `npm run build` emits the API into `apps/api/dist` and creates the static frontend bundle in `apps/web/dist`. Run a built API with `npm run start --workspace @stock-slice/api`; serve the frontend bundle with any static web server.

## API

The complete OpenAPI 3.1 description is in [`apps/api/openapi.yaml`](apps/api/openapi.yaml). JSON requests and responses use USD amounts as decimal numbers, with request amounts limited to cents. See [`docs/api-examples.md`](docs/api-examples.md) for copyable request and response examples.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Process health and in-memory order count |
| `GET` | `/api/config` | Share precision, default price, and currency |
| `GET` | `/api/portfolios` | List portfolios saved since startup |
| `POST` | `/api/portfolios` | Validate and save a reusable model portfolio |
| `POST` | `/api/orders` | Calculate and store a BUY or SELL order |
| `GET` | `/api/orders` | List session order history, newest first |
| `GET` | `/api/orders/{id}` | Retrieve a session order |

Example order request:

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY","amount":100,"portfolio":{"name":"Core","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}}'
```

The default share precision is 3 decimal places and can be changed with `SHARE_PRECISION` (integer from 0 to 10). `CORS_ORIGIN` accepts a comma-separated origin allowlist; by default it permits Vite on ports 5174 and 5174. A partner-provided `marketPrice` takes priority over the fixed USD 100 price. Allocations must be positive and total 100%; symbols must be unique. For deterministic money arithmetic, allocation amounts are distributed in integer cents, with any rounding remainder assigned to the final holding. Shares are rounded down so their estimated trade value never exceeds the allocation. Any residual is returned as `unallocatedAmount`.

Orders are scheduled for 09:30 America/New_York on the next weekday market session: the same weekday if created before 09:30 ET, otherwise the next Monday-Friday. This proof of concept follows the challenge's weekday-only calendar and does not model exchange holidays, market close, or order routing. BUY and SELL use the same notional allocation calculation; no account holdings or cash balances are tracked.

Every HTTP response logs method, path, status, and elapsed milliseconds to the API console. The API also applies Helmet security headers, a configurable single-origin CORS policy, a JSON body-size limit, input schemas, and a per-IP order-creation rate limit.

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

Orders and portfolios are held in process-local `Map` stores. They are intentionally lost when the API exits or restarts; this is a challenge constraint, not durable production storage. The UI's initial sample holding inputs are editable form values; all calculated order data, configuration, saved portfolios, and history come from API calls. See [`ANSWERS.md`](ANSWERS.md) for design assumptions, limitations, and production migration controls.
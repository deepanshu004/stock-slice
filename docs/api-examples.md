# API Examples

Start the API with `npm run dev --workspace @stock-slice/api`.

## Create a reusable portfolio

```sh
curl -X POST http://localhost:4000/api/portfolios \
  -H 'Content-Type: application/json' \
  -d '{"name":"Balanced","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}'
```

## Fund the demo wallet

The wallet starts empty. Top-ups use a simulated card and never charge a real card:

```sh
curl -X POST http://localhost:4000/api/wallet/top-ups \
  -H 'Content-Type: application/json' \
  -d '{"amount":1000,"paymentMethod":"demo-card"}'
```

```json
{ "data": { "balance": 1000, "currency": "USD", "paymentMode": "demo" } }
```

## Buy a portfolio

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY","amount":100,"portfolio":{"name":"Balanced","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}}'
```

Example order response for placement on Saturday, November 21, 2026, at 12:00 UTC (the UUID and timestamps are generated per request):

```json
{
  "data": {
    "id": "generated-uuid",
    "type": "BUY",
    "status": "SCHEDULED",
    "amount": 100,
    "portfolioName": "Balanced",
    "allocations": [
      { "symbol": "AAPL", "allocationPercent": 60, "price": 100, "amount": 60, "shares": 0.6, "estimatedTradeValue": 60, "unallocatedAmount": 0 },
      { "symbol": "TSLA", "allocationPercent": 40, "price": 250, "amount": 40, "shares": 0.16, "estimatedTradeValue": 40, "unallocatedAmount": 0 }
    ],
    "executionAt": "2026-11-23T14:30:00.000Z",
    "executionTimezone": "America/New_York",
    "createdAt": "2026-11-21T12:00:00.000Z"
  }
}
```

The second allocation uses the partner price of USD 250; omitted prices use USD 100. Placing this buy immediately reduces the demo wallet to USD 900 and adds 0.6 AAPL and 0.16 TSLA shares. The order remains `SCHEDULED`, with `executionAt` set to Monday, November 23, at 09:30 EST (14:30 UTC), rather than the Saturday placement time.

Both BUY and SELL orders use the same schedule: a weekday placement before 09:30 in `America/New_York` uses that day's opening; placement at or after 09:30 uses the next weekday; weekend placement uses Monday. Daylight-saving changes are handled by the IANA timezone. The schedule skips weekends only and does not include exchange holidays. Demo account updates happen on placement; no background execution worker routes trades or automatically changes orders to `COMPLETED` when their scheduled time arrives.

## List owned stocks

```sh
curl http://localhost:4000/api/positions
```

```json
{
  "data": [
    { "symbol": "AAPL", "quantity": 0.6, "price": 100, "marketValue": 60 },
    { "symbol": "TSLA", "quantity": 0.16, "price": 250, "marketValue": 40 }
  ],
  "count": 2
}
```

## Sell an owned quantity

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"SELL","positions":[{"symbol":"AAPL","quantity":0.1}]}'
```

Placing this sale immediately credits USD 10 to the demo wallet, leaving a USD 910 balance and 0.5 AAPL shares. The returned SELL order has status `SCHEDULED` and records the next weekday opening in `executionAt`. Selling more shares than owned or buying more than the wallet balance returns HTTP 409 without changing account state. Invalid amounts, duplicate symbols, or excess quantity precision return HTTP 400.

`GET /api/wallet` returns the current balance. `GET /api/orders` returns the newest process-local orders first. `GET /api/orders/{id}` returns one order or a 404 response. `GET /api/config` reports the active share precision. All balances, positions, portfolios, and orders reset when the API restarts.

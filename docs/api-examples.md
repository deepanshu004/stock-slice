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

To test weekend scheduling on any day, include the optional `simulationDate`:

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY","simulationDate":"2026-11-21","amount":100,"portfolio":{"name":"Balanced","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}}'
```

The chosen Saturday, November 21, 2026, is interpreted as 12:00 noon in New York (17:00 UTC). The response records that effective test time and schedules Monday's opening, regardless of the actual submission date (the UUID is generated per request):

```json
{
  "data": {
    "id": "generated-uuid",
    "type": "BUY",
    "status": "SCHEDULED",
    "simulationDate": "2026-11-21",
    "amount": 100,
    "portfolioName": "Balanced",
    "allocations": [
      { "symbol": "AAPL", "allocationPercent": 60, "price": 100, "amount": 60, "shares": 0.6, "estimatedTradeValue": 60, "unallocatedAmount": 0 },
      { "symbol": "TSLA", "allocationPercent": 40, "price": 250, "amount": 40, "shares": 0.16, "estimatedTradeValue": 40, "unallocatedAmount": 0 }
    ],
    "executionAt": "2026-11-23T14:30:00.000Z",
    "executionTimezone": "America/New_York",
    "createdAt": "2026-11-21T17:00:00.000Z"
  }
}
```

The second allocation uses the partner price of USD 250; omitted prices use USD 100. Placing this buy immediately reduces the demo wallet to USD 900 and adds 0.6 AAPL and 0.16 TSLA shares. The order remains `SCHEDULED`, with `executionAt` set to Monday, November 23, at 09:30 EST (14:30 UTC), rather than the Saturday placement time.

Both BUY and SELL requests accept `simulationDate` as an optional exact `YYYY-MM-DD` calendar date. Empty strings and invalid dates such as `2026-02-30` return HTTP 400. When it is supplied, `createdAt` is noon in `America/New_York` on that date, not the actual submission time, and the returned and stored order includes `simulationDate`. Omit the property to use actual server time. In the UI, choose **Test order date (New York)** to set it, or clear the field to use the current time. Test-date orders update the same demo wallet, positions, and history as ordinary orders.

Both order types follow the same execution rules using their effective order time. A Monday through Friday date returns `COMPLETED`, with `executionAt` equal to `createdAt`; without a test date this applies at any time of day, and with a test date it applies at the chosen noon. A Saturday or Sunday date returns `SCHEDULED` for the following Monday at 09:30. The weekday is determined in `America/New_York`, even when the UTC date differs, and the IANA timezone handles daylight-saving changes. Exchange holidays are excluded; every Monday through Friday uses immediate execution. Demo account updates happen on placement for all orders. No background execution worker routes trades or automatically changes scheduled weekend orders to `COMPLETED` when Monday's opening arrives.

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

Placing this sale immediately credits USD 10 to the demo wallet, leaving a USD 910 balance and 0.5 AAPL shares. If placed Monday through Friday in New York, the returned SELL order has status `COMPLETED` and `executionAt` equal to `createdAt`; if placed on Saturday or Sunday, it has status `SCHEDULED` for Monday at 09:30 New York time. Selling more shares than owned or buying more than the wallet balance returns HTTP 409 without changing account state. Invalid amounts, duplicate symbols, or excess quantity precision return HTTP 400.

The SELL request can also include `"simulationDate":"2026-11-21"` to test the same Saturday-to-Monday schedule as the buy example. Leaving it out uses the actual server time.

`GET /api/wallet` returns the current balance. `GET /api/orders` returns the newest process-local orders first. `GET /api/orders/{id}` returns one order or a 404 response. `GET /api/config` reports the active share precision. All balances, positions, portfolios, and orders reset when the API restarts.

# API Examples

Start the API with `npm run dev --workspace @stock-slice/api`.

## Create a reusable portfolio

```sh
curl -X POST http://localhost:4000/api/portfolios \
  -H 'Content-Type: application/json' \
  -d '{"name":"Balanced","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}'
```

## Create an order

```sh
curl -X POST http://localhost:4000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY","amount":100,"portfolio":{"name":"Balanced","holdings":[{"symbol":"AAPL","allocationPercent":60},{"symbol":"TSLA","allocationPercent":40,"marketPrice":250}]}}'
```

Example order response (timestamps and UUID are generated per request):

```json
{
  "data": {
    "id": "generated-uuid",
    "type": "BUY",
    "amount": 100,
    "portfolioName": "Balanced",
    "allocations": [
      { "symbol": "AAPL", "allocationPercent": 60, "price": 100, "amount": 60, "shares": 0.6, "estimatedTradeValue": 60, "unallocatedAmount": 0 },
      { "symbol": "TSLA", "allocationPercent": 40, "price": 250, "amount": 40, "shares": 0.16, "estimatedTradeValue": 40, "unallocatedAmount": 0 }
    ],
    "executionAt": "generated-UTC-timestamp",
    "executionTimezone": "America/New_York",
    "createdAt": "generated-UTC-timestamp"
  }
}
```

The second allocation uses the partner price of USD 250; omitted prices use USD 100. `GET /api/orders` returns the newest process-local orders first. `GET /api/orders/{id}` returns one order or a 404 response. `GET /api/config` reports the active share precision.
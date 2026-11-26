# Ionixx Challenge Answers

## 1. What was your approach to tackling this project?

I first translated the prompt into an API contract and isolated the financial rules from HTTP and UI concerns. Request schemas validate portfolio weights and input bounds; the order domain splits buy amounts in integer cents, applies a partner-provided price before the fixed USD 100 fallback, and floors share quantities to the configured precision. Controllers handle HTTP requests, services coordinate order and account changes, and small in-memory stores hold the data. The React dashboard calls the API for configuration, reusable portfolios, demo wallet funding, owned stocks, order placement, and history. Focused domain, HTTP integration, and UI tests cover the financial and workflow boundaries.

## 2. What assumptions did you make?

- Portfolio weights are positive percentages and must total exactly 100% within a small floating-point tolerance.
- Order amounts are positive USD values with at most two decimal places. Prices are positive USD values.
- The fixed fallback stock price is USD 100. A valid partner price overrides it for that holding.
- Shares are fractional and are rounded down, not to-nearest, so their estimated value does not exceed their allocation. The rounding remainder is surfaced rather than redistributed into an unaffordable fraction.
- Buy allocations are rounded to cents, with split remainders distributed by largest fractional remainder so allocations sum to the requested amount exactly. The full requested amount is debited from the demo wallet, and share-rounding residuals are disclosed on the order.
- BUY and SELL orders placed Monday through Friday in `America/New_York` complete immediately at any time of day, with status `COMPLETED` and `executionAt` equal to `createdAt`. Saturday and Sunday orders have status `SCHEDULED` for the following Monday at 09:30 New York time. The IANA timezone determines the local weekday and handles daylight-saving changes. Exchange holidays are excluded; every Monday through Friday uses immediate execution.
- The optional **Test order date (New York)** UI field sends a valid `YYYY-MM-DD` as `simulationDate` for either order type. The API uses noon in New York on that date as the effective `createdAt` and scheduling clock, and stores and returns the chosen date. That `createdAt` is a test time rather than the actual submission time. Empty or invalid dates are rejected; clearing the UI field omits the property and restores the actual server time.
- Demo account balances and positions update immediately on placement for all orders. There is no background execution worker or automatic transition to `COMPLETED` for scheduled weekend orders when Monday's opening arrives.
- Test-date orders use the same demo wallet, positions, and history as ordinary orders; they are not isolated from the rest of the session.
- Buys require sufficient wallet funds. Sells accept specific owned quantities, cannot exceed the available shares, and credit proceeds at the last simulated purchase price. No trades are routed to a broker.
- Card funding is simulated with a fixed demo card; no real card details or payments are processed. The wallet begins at zero.
- Wallet, positions, orders, and saved portfolios exist only in process memory, are shared by the demo instance, and reset on restart.

## 3. What challenges did you face when creating your solution?

The main challenge was avoiding drift between order history, wallet balances, and owned quantities. Services prepare and validate an account change before committing an order, so insufficient funds, oversells, invalid quantities, and failed persistence leave the account unchanged. Dollar amounts use integer cents; buy allocation remainders use the largest-remainder method, and shares round down at the configured precision. Quantity-based sells preserve fractional shares and use API-owned prices. Both order paths share execution rules that complete weekday orders immediately and schedule weekend orders for Monday's opening, using the IANA `America/New_York` zone for local dates and daylight-saving changes.

## 4. What would change for a production deployment?

The in-memory stores would be replaced by durable, transactionally updated persistence with idempotency keys and audit history. Market prices and trading calendars would come from trusted, timestamped market-data services, with staleness checks, exchange holidays, market hours, and explicit order expiry rules. Authentication and authorization would use an identity provider, scoped API credentials, least-privilege roles, and tenant isolation. Additional controls would include TLS termination, secrets management, stricter per-tenant rate limits and quotas, request correlation IDs, schema/version governance, centralized redacted logs, metrics/traces/alerts, dependency scanning, CI security checks, backups, disaster recovery, and deployment health/readiness probes. Before routing to a broker, the service would need account-level buying-power/position checks, idempotent execution workflows, reconciliation, order-state transitions, regulatory/compliance review, operational approvals, and a paper-trading rollout. Financial outputs would need independent reconciliation and documented rounding policy.

## 5. How were LLMs used?

An LLM coding assistant was used to help translate the written challenge into an implementation plan, scaffold and implement parts of the TypeScript API and React interface, draft tests and documentation, and review edge cases such as precision rounding, request validation, and weekday scheduling. It also helped draft this answer file. Generated code was checked against the challenge and the repository, and the test suite, typechecks, and production builds were run to verify behavior. The final implementation and its assumptions remain the candidate's responsibility to understand and explain.

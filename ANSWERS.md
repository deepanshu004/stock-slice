# Ionixx Challenge Answers

## 1. What was your approach to tackling this project?

I first translated the prompt into an API contract and isolated the financial rules from HTTP and UI concerns. The order domain validates portfolio weights and input bounds, splits the amount in integer cents, applies a partner-provided price before the fixed USD 100 fallback, and floors share quantities to the configured precision. I kept persistence behind small in-memory stores, then exposed those rules through REST endpoints with structured validation errors and response-time instrumentation. The React dashboard calls those endpoints for configuration, reusable portfolios, order creation, and history. I added focused domain, HTTP integration, and UI tests around the financial and workflow boundaries.

## 2. What assumptions did you make?

- Portfolio weights are positive percentages and must total exactly 100% within a small floating-point tolerance.
- Order amounts are positive USD values with at most two decimal places. Prices are positive USD values.
- The fixed fallback stock price is USD 100. A valid partner price overrides it for that holding.
- Shares are fractional and are rounded down, not to-nearest, so their estimated value does not exceed their allocation. The rounding remainder is surfaced rather than redistributed into an unaffordable fraction.
- Allocations are rounded to cents; any split remainder is assigned to the last holding so the allocations sum to the requested amount exactly.
- An order created before 09:30 America/New_York is scheduled for that day's open; one at or after the open is scheduled for the next weekday open. Saturday and Sunday are skipped. The challenge defines weekday sessions, so exchange holidays and market close are outside this PoC.
- BUY and SELL share the same notional-allocation math. The PoC does not check positions, buying power, or execute or route trades.
- Order and saved-portfolio history exists only in process memory and resets on restart, as required.

## 3. What challenges did you face when creating your solution?

The main ambiguity was what “when to execute” means when requests can arrive at any time. I made the schedule deterministic and explicit: the next available weekday 09:30 ET open, with requests arriving after the open rolled forward. The second challenge was avoiding financial drift across multiple holdings. I used integer cents for dollar splits and assigned the final remainder to the last holding, then rounded shares down at the configured precision and reported the resulting unallocated value. A final edge was ensuring timezone conversion correctly handles daylight-saving time; scheduling uses the IANA `America/New_York` zone rather than a fixed UTC offset.

## 4. What would change for a production deployment?

The in-memory stores would be replaced by durable, transactionally updated persistence with idempotency keys and audit history. Market prices and trading calendars would come from trusted, timestamped market-data services, with staleness checks, exchange holidays, market hours, and explicit order expiry rules. Authentication and authorization would use an identity provider, scoped API credentials, least-privilege roles, and tenant isolation. Additional controls would include TLS termination, secrets management, stricter per-tenant rate limits and quotas, request correlation IDs, schema/version governance, centralized redacted logs, metrics/traces/alerts, dependency scanning, CI security checks, backups, disaster recovery, and deployment health/readiness probes. Before routing to a broker, the service would need account-level buying-power/position checks, idempotent execution workflows, reconciliation, order-state transitions, regulatory/compliance review, operational approvals, and a paper-trading rollout. Financial outputs would need independent reconciliation and documented rounding policy.

## 5. How were LLMs used?

An LLM coding assistant was used to help translate the written challenge into an implementation plan, scaffold and implement parts of the TypeScript API and React interface, draft tests and documentation, and review edge cases such as precision rounding, request validation, and weekday scheduling. It also helped draft this answer file. Generated code was checked against the challenge and the repository, and the test suite, typechecks, and production builds were run to verify behavior. The final implementation and its assumptions remain the candidate's responsibility to understand and explain.
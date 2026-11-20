# Workspace Guidance

- Use Node.js and TypeScript; keep API and web code in their existing npm workspaces.
- Keep portfolio/order persistence process-local. Do not add a database or external trade execution.
- Keep order calculation rules in `apps/api/src/domain/order.ts`, validated by domain tests.
- Validate HTTP contract changes with Supertest and UI behavior changes with Testing Library.
- Run `npm test`, `npm run typecheck`, and `npm run build` before completing significant changes.
- Keep README, OpenAPI, and ANSWERS documentation aligned with API behavior and assumptions.
# Changes: Auth rate-limiting and integration tests

## Summary of changes

- Added rate limiting middleware applied to auth routes:
  - `src/middleware/rateLimit.middleware.ts` — new file exporting `authRateLimiter` (express-rate-limit).
  - `src/routes/auth.routes.ts` — register/login routes now use `authRateLimiter`.
- Added integration tests (Vitest + supertest) for core auth flows:
  - `test/integration/auth.routes.test.ts` — tests for register, duplicate-register (409), login, and authenticated `GET /api/auth/me`.
- Updated `package.json`:
  - Added `express-rate-limit`, `vitest`, `supertest`, and `@types/supertest` entries.
  - Added `test` script: `vitest`.

## How the code works

- Rate limiter
  - `authRateLimiter` is an Express middleware created with `express-rate-limit`.
  - It enforces a sliding window (15 minutes) and a max of 20 requests per IP, returning HTTP 429 when exceeded.
  - The middleware is applied to `POST /api/auth/register` and `POST /api/auth/login` so abusive or brute-force attempts are throttled before hitting service/database logic.

- Integration tests
  - Tests spin up the same Express app via `createApp()` and make HTTP requests with `supertest`.
  - `AuthService` and the `authenticate` middleware are mocked so tests run deterministically without a database or external JWT secrets.
  - Covered flows: successful register (201), register conflict (409), successful login (200), and authenticated `GET /api/auth/me` (200).

## Why this works / rationale

- Security and resiliency: placing rate-limiting at the route layer blocks excessive requests early, reducing load and protecting accounts from credential stuffing.
- Express middleware composition keeps concerns separated: rate limiting, authentication, validation, and business logic remain modular and testable.
- Mocking `AuthService` and `authenticate` in tests lets integration-style tests verify routing, middleware ordering, error handling, and response shapes without depending on the database, network, or secret material.
- Using `vitest` + `supertest` provides a fast feedback loop suitable for CI and local development.

## Implementations performed

- Implemented `src/middleware/rateLimit.middleware.ts` with configuration:
  - `windowMs: 15 * 60 * 1000`
  - `max: 20`
  - Standard headers enabled and a JSON 429 handler.
- Updated `src/routes/auth.routes.ts` to import and apply `authRateLimiter` on `register` and `login`.
- Added `test/integration/auth.routes.test.ts` that:
  - Mocks `AuthService.register` / `AuthService.login` to return resolved values or throw `HttpError` for conflict.
  - Mocks `authenticate` to inject a fake `req.user` for the `me` route.
  - Uses `supertest` to assert status codes and response shapes.
- Updated `package.json` to include runtime and dev dependencies and a `test` script.

## Files to review

- `src/middleware/rateLimit.middleware.ts`
- `src/routes/auth.routes.ts`
- `test/integration/auth.routes.test.ts`
- `package.json`

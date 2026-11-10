# 0001 — Health endpoint

## What

Add `GET /health` so the load balancer and the router can tell the service is up.

## Behaviour

- `GET /health` answers 200 with `{"status":"ok"}` while the app can reach its database.
- When the database is unreachable it answers 503 with `{"status":"degraded"}`.

## Scope

In:
- The endpoint and its test.

Out:
- Metrics and dashboards.

## Touchpoints

- src/server/routes.ts — where routes are registered

## Open questions

- none

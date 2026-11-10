# 0004 — Rate-limit the public API

## What

Protect the public API from bursts by limiting each API key to a fixed number of requests per minute.

## Behaviour

- Each API key may make at most 600 requests per rolling minute.
- Request 601 within the minute gets 429 with a `Retry-After` header.

## Scope

In:
- The limiter and its 429 response.

Out:
- Per-endpoint limits.

## Touchpoints

- src/server/middleware/ — existing middleware

## Open questions

- none

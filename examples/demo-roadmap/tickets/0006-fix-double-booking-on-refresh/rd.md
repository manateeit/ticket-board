# 0006 — Fix double booking on refresh

Type: bug

## What

Refreshing the confirmation page books the same slot a second time. It must book once.

## Behaviour

- Refreshing or resubmitting the booking form never creates a second booking.
- The confirmation page shows the one booking.

## Scope

In:
- what Behaviour lists

Out:
- anything else

## Touchpoints

- src/booking/confirm.tsx — the confirmation page

## Docs

- README.md — no change: the demo app has no user docs yet

## Open questions

- none

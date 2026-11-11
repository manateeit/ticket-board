# 0003 — Book a free slot

Type: feature
Plan: P2.1
Design: D3@1

## What

Clients pick a service, a staff member and a free slot and book it, and get a confirmation email.

## Behaviour

- Only free slots can be picked.
- A booking is confirmed by email within a minute.
- Two clients can never book the same slot.

## Scope

In:
- what Behaviour lists

Out:
- anything else

## Touchpoints

- src/booking/slots.ts — free slots and the booking lock

## Docs

- README.md — no change: the demo app has no user docs yet

## Open questions

- none

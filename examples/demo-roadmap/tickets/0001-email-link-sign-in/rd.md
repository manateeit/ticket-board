# 0001 — Email link sign-in

Type: feature
Plan: P1.1
Design: D1@1

## What

Owners and clients sign in with a one-time link sent by email, so nobody needs a password.

## Behaviour

- Entering an email sends a sign-in link that works once, for 15 minutes.
- An expired link shows "This link has expired" and offers a new one.

## Scope

In:
- what Behaviour lists

Out:
- anything else

## Touchpoints

- src/auth/link.ts — issuing and checking links

## Docs

- README.md — no change: the demo app has no user docs yet

## Open questions

- none

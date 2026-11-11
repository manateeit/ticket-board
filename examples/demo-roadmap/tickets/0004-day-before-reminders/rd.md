# 0004 — Day-before reminders

Type: feature
Plan: P2.2
Design: D4@1

## What

Every booking gets one reminder email the day before, to cut no-shows.

## Behaviour

- A reminder goes out 24 hours before each booking.
- A cancelled booking gets no reminder.

## Scope

In:
- what Behaviour lists

Out:
- anything else

## Touchpoints

- src/reminders/job.ts — the hourly reminder job

## Docs

- README.md — no change: the demo app has no user docs yet

## Open questions

- none

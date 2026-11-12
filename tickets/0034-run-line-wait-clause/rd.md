# 0034 — Run line places the wait-for-blockers clause itself

Type: bug

## What

`runTicket` (`hooks/views.tsx:114`) strips the final `.` from `runLine`'s text and appends " — but only once X is done.", assuming the run sentence comes last. With a router, `runLine` ends with the router tail (`hooks/core/query.ts:157,162`), so the wait condition attaches to the in-check rule instead of to "Run ticket N", and a session can start the ticket before its blockers are done.

## Behaviour

- `runLine` takes the ticket numbers to wait for and puts the wait clause right after the run sentence, before any router tail.
- With a router and an open blocker, the Run line reads `Run ticket 0005 — but only once 0003 is done. …router tail…`.
- Without blockers, Run lines are byte-identical to today, with and without a router, default and non-default board.
- No caller edits `runLine`'s output text.

## Scope

IN: report L8. OUT: changing the router tail wording; other leaks.

## Touchpoints

- `hooks/core/query.ts` (`runLine` ~L154, `routerTail` ~L162)
- `hooks/views.tsx` (`runTicket` ~L112-117)
- other `runLine` callers: `hooks/desk.tsx`, `hooks/plan.tsx`
- Source: `tickets/audits/leaks-2026-11-11-2.md` L8

## Docs

- README.md — where the Run line with blockers is shown: show the router form.

## Open questions

- none

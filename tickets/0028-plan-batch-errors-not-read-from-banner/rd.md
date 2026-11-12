# 0028 — Plan batch errors not read from the banner

Type: bug

## What

`createPlanTickets` (`hooks/ai.ts:286`) decides whether the batch failed from `S.message?.tone === 'error'`, the pane's banner state, which it never clears first. A stale error banner from an earlier action makes a fully successful batch skip its "Created N draft tickets … queued" summary and leaves the old error showing.

## Behaviour

- The batch knows its own failures (from `startJob`/`failPlan` results or its own count), not from banner state.
- Successful batch with an old error banner showing: the summary replaces the banner.
- A batch where some tickets fail: the error is shown and the summary says how many were created.
- Banner wording for success and failure is unchanged.

## Scope

IN: report L6. OUT: other uses of `say()`; other leaks.

## Touchpoints

- `hooks/ai.ts` (`createPlanTickets` ~L230-300, `startJob`, `failPlan`, `pumpPlanQueue`); `hooks/views.tsx:72` (`go()` clears the banner)
- Source: `tickets/audits/leaks-2026-11-11.md` L6

## Docs

- README.md — no change: wording unchanged, only the stale-banner case is fixed.

## Open questions

- none

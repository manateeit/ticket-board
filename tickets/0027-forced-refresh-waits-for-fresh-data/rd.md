# 0027 — Forced refresh waits for fresh data

Type: bug

## What

`refresh($, force)` (`hooks/store.ts:370`) returns at once when another refresh is in flight (`if (S.isRefreshing) return false` runs before `force` is checked). Callers await it and read `S.snap` as if fresh; none check the result. When a writer agent finishes, `turn.complete` (`hooks/register.tsx:240`) can read the placeholder rd.md/eval.md and write wrong notes ("missing Docs", wrong question count) into BOARD.md.

## Behaviour

- After `await refresh($, true)` resolves, `S.snap` reflects files as they were after the call started, even if a refresh was already running.
- Concurrent non-forced refreshes may still be coalesced (no extra disk reads for the 3 s poll).
- A writer finishing right after its last Write gets notes and toasts computed from the written files.
- No caller has to check a return value to know the snapshot is fresh.

## Scope

IN: report L5 (`refresh` and its awaiting callers). OUT: changing the poll interval; other leaks.

## Touchpoints

- `hooks/store.ts` (`refresh` ~L370-432, `editRow` ~L629, `createSkeleton` ~L716/780)
- `hooks/register.tsx` (~L88-90 poll, ~L195 bg refresh, ~L238-251 turn.complete); `hooks/ai.ts` ~L239, 423
- Source: `tickets/audits/leaks-2026-11-11.md` L5

## Docs

- README.md — no change: internal timing fix, no visible setting or text changes.

## Open questions

- none

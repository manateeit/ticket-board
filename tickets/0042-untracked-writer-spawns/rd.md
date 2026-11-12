# 0042 — Untracked writer spawns count and show

Type: chore

## What

When `$.agent.spawn` returns no agent id and no listed writer is found, `startJob` (`hooks/ai.ts:161`) warns and returns true but records nothing in `S.jobs`. `pumpPlanQueue` (`ai.ts:198`) counts slots with `runningJobs()` (`ai.ts:578`), so untracked spawns use no slot and a batch can exceed `MAX_JOBS`; their rows stay "AI queued" for good.

## Behaviour

- An untracked spawn still takes one of the 3 writer slots until the person refreshes or it is matched.
- Its row shows that the writer started without an id (not "AI queued" forever), with the existing "refresh when it is done" advice.
- The batch summary counts it.
- Tracked spawns behave exactly as today.

## Scope

IN: report L12. OUT: changing the host spawn API; other leaks.

## Touchpoints

- `hooks/ai.ts` (`startJob` ~L136-165, `pumpPlanQueue` ~L190-200, `runningJobs` ~L578, `createPlanTickets`)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L12

## Docs

- README.md — no change unless the writer limit is described there; then say untracked writers count.

## Open questions

- none

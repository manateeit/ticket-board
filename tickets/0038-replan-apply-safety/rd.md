# 0038 — Replan Apply only applies what was ticked, for the design it was made for

Type: bug

## What

Replan Apply checks only that PLAN.md has not changed. Whether the proposal still matches the current design version is checked only in the banner (`isCurrent`, `hooks/plan.tsx:1182`), and `applyReplan` (`hooks/ai.ts:529`) stamps the current design version rather than the proposal's, so applying after a redesign clears the "plan is behind" signal for a version never planned. Ticks are item positions (`S.replanTicks`, `hooks/store.ts:133`) with no proposal identity, so if the planner rewrites the same-day proposal while review is open, Apply uses old positions on new items. Decision (human, 2026-11-12): refuse a stale proposal.

## Behaviour

- Apply refuses when the proposal's design version is missing or differs from the current design version, with a message to make a new proposal; nothing is written.
- When Apply runs, it stamps the proposal's own design version.
- Ticks belong to one proposal (its path and content hash); when the proposal file changes, ticks are cleared and the review shows the new items unticked.
- Applying a current proposal with unchanged ticks behaves exactly as today.

## Scope

IN: report L4, L5. OUT: the replan proposal format; other leaks.

## Touchpoints

- `hooks/ai.ts` (`applyReplan` ~L520-535, `finishReplan`, `startReplan` ~L380)
- `hooks/plan.tsx` (`proposalFacts` ~L1182, review ~L1225)
- `hooks/store.ts` (`replanTicks` ~L133)
- `hooks/core/roadmap.ts` (`applyProposal` ~L1222, `ReplanItem.index` ~L1058)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L4, L5

## Docs

- README.md — Replan review: say Apply refuses a proposal made for an older design and that ticks clear when the proposal changes.

## Open questions

- none (resolved 2026-11-12; human: refuse a stale proposal)

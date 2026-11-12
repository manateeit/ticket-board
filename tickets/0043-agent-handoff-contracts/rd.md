# 0043 — Agent handoff contracts match the pipeline

Type: chore

## What

The router, checker, merger and watchdog contracts in `.claude/agents/` leave gaps the pipeline fills by hand. The checker edits eval.md but no contract says who commits it, while the merger needs a clean tree (`checker.md:23`, `merger.md:32-34`). The merger's "pre-existing failure" baseline is a hard-coded `35/35` from 2026-11-10 (`merger.md:41`); the suite now has 358. The watchdog judges time-in-status from timestamps nobody records (`watchdog.md:15`). Decision (human, 2026-11-12): the merger commits the checker's results.

## Behaviour

- merger.md: before rebasing, the merger commits the checker's eval.md edits on the branch (message `Ticket NNNN: checker results`, with the session's attribution lines); checker.md says the checker leaves them uncommitted.
- merger.md measures main's validate/test result at merge time instead of quoting a number; no hard-coded count remains.
- router.md records the dispatch time when it marks a ticket in-progress and in-check (a defined Notes prefix or the Owner cell, e.g. `dispatched 2026-11-12 14:05`); watchdog.md reads that.
- No hook code changes.

## Scope

IN: report L16, L18, L19. OUT: Notes badge prefixes (0032); other leaks.

## Touchpoints

- `.claude/agents/checker.md` ~L23, `merger.md` ~L30-42, `router.md` (steps 2-4), `watchdog.md` ~L14-22
- `templates/BOARD.md:23` if the dispatch time goes in Notes
- Source: `tickets/audits/leaks-2026-11-11-2.md` L16, L18, L19

## Docs

- README.md — where the router/checker/merger flow is described: who commits checker results.
- templates/BOARD.md — the dispatch-time convention if it uses Notes.

## Open questions

- none

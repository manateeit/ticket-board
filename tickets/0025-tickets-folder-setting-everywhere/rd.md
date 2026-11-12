# 0025 — Tickets folder setting works everywhere

Type: bug

## What

The `ticketsDir` plugin setting makes the board location configurable and the pane honours it via `dir()`/`boardPath()` (`hooks/store.ts:210`). Everything else hard-codes `tickets/`: `ROUTER_TAIL` in every Run line (`hooks/core/query.ts:153`), the router, worker, skills, planner and the BOARD template. With a non-default value the pane and the router work on different boards. Decision (human, 2026-11-11): make the setting work everywhere, not drop it.

## Behaviour

- `runLine` takes the resolved board path; every Run line names `<ticketsDir>/BOARD.md`.
- Every agent brief the pane writes (writer, planner, adopt, replan) names the real board path and ticket folder.
- Skills, planner, router and worker say "the board path you were given (default `tickets/BOARD.md`)" instead of the literal path.
- With the default setting, Run lines and briefs read exactly as today.
- `resolveRoot` still finds the main checkout with a non-default folder.

## Scope

IN: report L2. OUT: migrating an existing board between folders; other leaks.

## Touchpoints

- `hooks/core/query.ts` (`ROUTER_TAIL`, `runLine` ~L150), callers `hooks/desk.tsx:687`, `hooks/views.tsx:102,390`, `hooks/plan.tsx:147`
- `hooks/ai.ts` briefs (~L23, 52), `hooks/register.tsx:22`, `hooks/store.ts` `resolveRoot`
- `skills/ticket|planning|design|brainstorm/SKILL.md`, `agents/planner.md`, `.claude/agents/router.md`, `worker.md`, `templates/BOARD.md`
- Source: `tickets/audits/leaks-2026-11-11.md` L2

## Docs

- README.md — the `ticketsDir` setting: say Run lines and agents follow it.

## Open questions

- none (resolved 2026-11-11; make it work everywhere)

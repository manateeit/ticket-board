# 0036 — New ticket rows report dropped columns

Type: bug

## What

0023 made `setCells` report columns the board lacks, but `addRow` (`hooks/core/board.ts:237`) still writes `''` for any missing column and returns plain text. `createSkeleton` (`hooks/store.ts:815`) passes the new-ticket form's mode and Blocked by straight through (`hooks/views.tsx:903`), so on a board without those columns the dependencies are lost while the pane says "Created", and the router can run the ticket before its blockers are done.

## Behaviour

- `addRow` reports which given values it could not write, like `setCells`.
- The new-ticket form hides or marks Mode / Blocked by when the board lacks the column; if a value is still dropped, the pane says what was not saved instead of a plain "Created".
- Plan batches that set Blocked by on a board without the column say which tickets lost their dependencies.
- Boards with every column create rows exactly as today.

## Scope

IN: report L2. OUT: other columns' formats; other leaks.

## Touchpoints

- `hooks/core/board.ts` (`addRow` ~L219-245)
- `hooks/store.ts` (`createSkeleton` ~L815)
- `hooks/views.tsx` (`createTicket` ~L903-911), `hooks/ai.ts` (`createPlanTickets`)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L2

## Docs

- README.md — new-ticket form: say Mode / Blocked by need their column.

## Open questions

- none

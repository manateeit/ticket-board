# 0023 — Board cell edits never silently dropped

Type: bug

## What

`setCells`/`editRow` look like they can write any column, but `parseBoard` only requires `#` and Status, and `setCells` skips a missing column with `if (idx === undefined) continue` and says nothing (`hooks/core/board.ts:175`). The pane then says "Mode → solo" or "Dependencies saved" when nothing was written, and a status move with a note loses the note. The Blocked by cell format is also rebuilt by hand in the UI (`/\d{1,4}/g` + `padStart(4)`, `—` for empty), which allows only 4 digits while rows allow 5.

## Behaviour

- Writing a column the board does not have is reported: the edit returns or throws which cells it could not write, and the pane shows an error toast instead of a success message.
- Mode, Blocked by and Notes controls are hidden or disabled on a board that lacks that column, with a short reason.
- A status move with a note on a board without Notes moves the status and says the note was not saved.
- The board module owns the Blocked by encoding: callers pass a list of ticket numbers; the module pads, joins and writes `—` for empty. Readers get lists, never the `—` sentinel.
- Blocked by accepts the same number width as rows (up to 5 digits); `10000` stays one blocker.
- Boards with every column behave exactly as today (same file bytes for the same edit).

## Scope

IN: report L1 and L9 (`setCells`, Blocked by encoding and its UI callers). OUT: other leaks, other columns' formats, refactors beyond these callers.

## Touchpoints

- `hooks/core/board.ts` (`setCells` ~L175, `parseBlockedBy` ~L87, row regex ~L116, `addRow` ~L203)
- `hooks/store.ts` `editRow`; `hooks/views.tsx` ~L478, 569, 606, 700-710, 881; `hooks/desk.tsx` ~L288, 1142, 1197-1209, 1246
- `hooks/register.tsx:251`, `hooks/ai.ts:103` (notes writes)
- Source: `tickets/audits/leaks-2026-11-11.md` L1, L9

## Docs

- README.md — where Change mode / Blocked by is described: note that controls need the column on the board.

## Open questions

- none

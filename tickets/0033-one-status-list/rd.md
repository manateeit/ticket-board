# 0033 — One status list for glass and roadmap

Type: bug

## What

Two modules keep their own idea of which words are ticket statuses instead of using `STATUSES` in `hooks/core/board.ts`. Glass `markdown()` treats inline code as a status when `STATUS_HEX[word] !== undefined` (`hooks/glass.tsx:235`), which is true for `unlisted` and every `Object.prototype` key: an inline `` `toString` `` or `` `constructor` `` makes `tint()` throw and breaks the drawing. `hooks/core/roadmap.ts:554,559` hard-codes the six statuses, so a new status would be ignored in build states and progress.

## Behaviour

- Inline code in any document is drawn as a status pill only when the word is in `STATUSES`; `toString`, `constructor`, `valueOf`, `hasOwnProperty` and `unlisted` render as plain code and never throw.
- Status colour lookups use own keys only (no prototype hits) everywhere `STATUS_HEX` is read.
- `buildState` and the ready-or-later set in roadmap.ts are derived from `STATUSES`; adding a status to `STATUSES` is a type error in roadmap.ts until it is placed (or it is handled by an explicit default).
- Existing status pills, build states and progress look exactly as today.

## Scope

IN: report L10, L14. OUT: palette changes (0031); other leaks.

## Touchpoints

- `hooks/glass.tsx` (~L60-70 `STATUS_HEX`, ~L147 `tint`, ~L235 inline code, ~L456)
- `hooks/core/roadmap.ts` (~L554-559)
- `hooks/core/board.ts:4` (`STATUSES`)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L10, L14

## Docs

- README.md — no change: no visible change except documents no longer crash.

## Open questions

- none

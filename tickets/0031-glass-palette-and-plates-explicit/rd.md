# 0031 — Glass palette and plates made explicit

Type: chore

## What

Two theme rules in `hooks/glass.tsx` leak into view code. `plated()` (~L162) skips any Box with a `width` (treated as a table cell) or a `plate-` key and plates only Boxes whose direct children are controls, so views add wrapper Boxes to work around it. `setScheme` (~L96) changes `G`, `HUE` and `STATUS_HEX` in place, so colour maps need `get hex()` getters and a module-level `glass` flag; a plain `{ bug: HUE.rose }` keeps dark colours on light glass.

## Behaviour

- Whether a group gets a plate is decided by an explicit marker (component or prop), not by `width`; adding `width` to a Box never removes plates.
- Views read colours from the current palette at draw time without getters or module flags; a plain colour map follows the scheme.
- Every existing screen looks the same in all four glass/app combinations (dark/dark, dark/light, light/dark, light/light).

## Scope

IN: report L10, L11. OUT: new colours or design changes; other leaks.

## Touchpoints

- `hooks/glass.tsx` (`setScheme` ~L96, `plated` ~L162), `hooks/desk.tsx` (~L60-64, 168-176, 395-408, 551), `hooks/plan.tsx:379`, `hooks/views.tsx` (~L268, 1261), `hooks/register.tsx`
- Source: `tickets/audits/leaks-2026-11-11.md` L10, L11

## Docs

- README.md — no change: no visible change. Note the theme rules in the code comments of glass.tsx.

## Open questions

- none

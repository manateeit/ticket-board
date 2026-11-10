# 0018 — Light colors hide buttons, tabs and text

Type: bug

## What

Reported 2026-11-10 (emergency, with a screenshot) on 0.4.19 in the Claude desktop app with the pane set to **☀ Colors: light**. Most of the pane is unreadable: the Plan / Design tabs beside Board, the filter chips after "All 17" / "All types", the title-bar buttons beside + New ticket, the project header's README and Colors buttons, and the board rows' ID and title text all render near-white on the pale glass background, so the person thought the tabs had been removed. Primary buttons, status pills, tiles and the "Merged" result chips are readable. The color schemes date from 0.4.9 (`hooks/glass.tsx` SURFACES / HUES, `setScheme`); native secondary Buttons use the app's own colors, which do not suit the light glass surface.

## Behaviour

- In every scheme (`auto`, `dark`, `light`) and with the Claude app itself in light or dark mode, every Button (primary, secondary, dimmed), tab, filter chip and text on the board, ticket, Plan, Design, questions, new-ticket, README and Start views is readable: text against its actual background has at least 4.5:1 contrast (3:1 for large or bold text and for intentionally dimmed controls).
- Dimmed means visibly dimmed, not invisible.
- The board rows' ID and title text is readable in every scheme.
- Fonts: the same sizes and weights as now, unless a size is too small to read; check captions and footnotes in all three schemes.
- No other behaviour changes. The scheme choice and the Colors button stay.

## Scope

- IN: colors in `hooks/glass.tsx` (surfaces, hues, wash), and any hard-coded colors or variant choices in `hooks/desk.tsx`, `hooks/plan.tsx`, `hooks/views.tsx` that produce low contrast; a contrast test.
- OUT: new themes, layout changes, terminal colors unless they are also unreadable.

## Touchpoints

- `hooks/glass.tsx` — SURFACES, HUES, `setScheme`, `wash`, `tint`.
- `hooks/desk.tsx` — ProjectBar, title bar, filter chips, board rows, SCHEME_LABEL.
- `hooks/plan.tsx` — Tabs and Plan/Design views.
- `tests/pane.test.tsx` — contrast test.

## Docs

- README.md — Settings / Colors: say what each scheme does; Troubleshooting row "Buttons or tabs look blank: press Colors to switch to app colors" if any scheme still depends on the app's mode.

## Open questions

- none

# 0022 — Large plans and boards shown in pages

Type: bug

## What

Reported 2026-11-11 from another project (ticket-board-gui: PLAN.md with 8 phases and 49 builds): the Plan tab's drawing is about 149,800 characters, over the host's 100,000-character limit, so since 0.5.1 (ticket 0020) it shows the "too large for the pane" notice instead of the plan. The board has the same ceiling: each row is about 2.8K characters, so about 26 visible tickets reach the limit (0020 checker). The pane must draw large plans and boards within the limit.

## Behaviour

- **Plan view, list**: draws one phase at a time when the whole plan would not fit: a phase switcher (P1 … Pn, with each phase's % and state) and the selected phase's builds. Default: the current phase. The choice is remembered per project. Small plans that fit keep showing everything as today.
- **Plan view, timeline**: stays within the limit (e.g. the same phase selection, or a compact SVG); it never shows the "too large" notice for a plan of 8 phases × 49 builds.
- **Design view**: the same for a design with many sections (section list stays; detail is one section at a time already — check the list fits for ~40 sections).
- **Board**: pages of rows (e.g. 20 per page) with Previous/Next and "Rows a–b of n" when the filtered list would not fit; filters and sort apply before paging; changing a filter goes back to page 1.
- Every view built from a 49-build, 8-phase plan and a 120-ticket board draws under the 0020 guard on desktop in every Colors × app mode, and on the terminal.
- No behaviour change for small projects.

## Scope

IN: plan phase paging (list and timeline), design list check, board paging, tests with large fixtures. OUT: changing the 0020 guard itself.

## Touchpoints

- `hooks/plan.tsx` — Plan list/timeline, Design list; `hooks/desk.tsx` / `hooks/views.tsx` — board rows; `hooks/store.ts` — page/phase state (per project); `tests/pane.test.tsx` — large fixtures (8 phases × 49 builds, 120 tickets).

## Docs

- README.md — Plan view (phase switcher for large plans), Board (paging), Troubleshooting row for "too large for the pane".

## Open questions

- none

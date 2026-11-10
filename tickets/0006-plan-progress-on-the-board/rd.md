# 0006 — Plan progress on the board

Type: feature

## What

Milestone M5 of PLAN-design-plan.md. The board stops measuring "done" only by tickets and shows real plan progress, using the roadmap data that ticket 0003 computes in `hooks/core/roadmap.ts`. The header tile, a Roadmap summary card, a Phase column with a phase filter, and plan/design chips on the ticket page all read that data. A project with no plan looks and works as it does today.

## Behaviour

- **Header tile.** The last KPI tile ("Done", `kpi-done`) becomes **Plan %** when a plan is bound: value = plan %, sub-line = `P2 of 4 · D 5/9` (current phase of phase count, design sections built of numbered non-dropped). With no design the sub-line shows the phase only. With no plan it stays "Done" = ticket % (`N of M`), exactly as now.
- **Roadmap card.** When a plan is bound, a card titled "Roadmap" sits above the "Board notes · BOARD.md" card. It has:
  - a phase rail drawn as one static, non-interactive SVG (a segment per phase: fill = phase %, check mark at 100%, no scroll capture), with a link button per phase underneath that sets the phase filter;
  - a "Now" line: current phase name, "N of M builds built", and "next up P2.4 (no ticket)" (first unblocked unbuilt build; omitted when the plan is complete);
  - warnings, each a short line: "Plan is behind design v3", "D7 has no build", open design questions, builds with no ticket, stale tickets, and "N off-plan" (tickets with no `Plan:` line). Warning lines come from the 0003 `checks` output; none is shown when there are none.
  - When no plan is bound the card is not drawn.
- **Phase column and filter.** The ticket table gets a **Phase** column showing the ticket's phase id (`P2`, from its `Plan:` line, `—` when off-plan), sortable. A phase filter (same style as the Mode filter: Any, then each phase, then Off-plan) narrows the table; it is saved per project with the other filters and is cleared by "Clear filters". With no plan the column and filter are hidden. Column widths still total 100%.
- **Ticket page, Properties.** Gains **Plan item** (e.g. `P2.2 · One Accept per intent`, or "Off-plan") and **Design** chips (`D4`, `D3@1`). A chip for a section whose current Rev is newer than the ticket's `@N` is marked stale. A stale ticket shows the notice "Written against D3 rev 1, now rev 2". A `Plan:` id missing from the plan shows "P9.9 — not in the plan". Hidden when no plan is bound.
- **Terminal.** The terminal board shows the compact line `Plan 46% · P2 60% · design v3 (plan behind)` in place of the "Done" figure, and the first warning, when a plan is bound. The ticket view lists the plan item and design chips as text.
- A plan or design that fails to parse never breaks the board: the pane falls back to today's view and shows one warning line.

## Scope

IN: the above, desktop and terminal; reading the plan through 0003's functions; pane tests on a roadmap fixture.
OUT: the Plan and Design views, hill/timeline SVG, and any click-through to them (0007); Replan, Create tickets and the stale "Review" action (0008); the Start screen (0004); changing roadmap.ts maths (0003); writing `Plan:`/`Design:` lines from the pane (not in this ticket; Properties only displays them).

## Touchpoints

- `hooks/desk.tsx` — `deskBoard` (KPI row at the `kpi-done` Kpi, filters row, `COLS`/`tableRow`, Board notes card), `deskTicket` (Properties card, `props-card`).
- `hooks/views.tsx` — terminal `boardView`/`ticketView`, `setFilters`.
- `hooks/core/query.ts` — `Filters`, `DEFAULT_FILTERS`, `matches`, `sortItems`, `Item` (add phase).
- `hooks/store.ts` — `Snapshot`, `items()`, load of design/plan files for the snapshot; remembered filters.
- `hooks/core/roadmap.ts` (from 0003), `hooks/core/ticket.ts` (reads `Plan:`/`Design:`, from 0003).
- `hooks/glass.tsx` — SVG helpers (`barSvg`) for the rail.
- `tests/pane.test.tsx`, `tests/core.test.ts`, `examples/demo-board/` (unchanged here).

## Docs

- `README.md` — "The pane, view by view": rewrite the Board bullet's five numbers (Done % becomes Plan % with fallback), add the Roadmap card and the Phase column/filter; "### Board" (Show/Sort/Mode list: add Phase); "### Ticket" (Plan item, Design chips, stale notice); "Development" layout and test paragraph if a new test file or core module is added.
- `docs/STANDARD.md` — no change here (owned by 0001); link to it from the README Roadmap text if it exists by then.
- CHANGELOG, CLAUDE.md/AGENTS.md — none exist in this repo; no change.

## Open questions

- Until 0007 lands, what do the rail segments and the "Open plan ›", "Replan" and stale "Review" buttons do? [only rail segments set the phase filter and the other buttons are not drawn until 0007/0008 (proposed); draw them disabled; draw them now and have them show a toast "coming soon"]
- Does Plan % count ticket progress only for builds that have a ticket, or also not-started builds in the denominator (the §4 formula says all counted builds)? [use §4 as written, so a plan with few tickets reads low (proposed); show ticket % beside it]

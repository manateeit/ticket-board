# Eval — 0006 — Plan progress on the board

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and the suite passes
   - Run: `claude plugin validate .` then `claude plugin test .` from the repo root (tsc is not installed; do not use it)
   - Pass: both exit 0; no previously passing test in `tests/core.test.ts` or `tests/pane.test.tsx` is removed or skipped
   - Result:
   - Evidence:

2. Plan % tile and fallback (desktop and terminal)
   - Run: the new pane test(s) on the roadmap fixture (a plan with 4 phases, a design at v3, tickets in several statuses) and on the existing no-plan board
   - Pass: with the fixture the last tile reads "Plan" with the computed % and a `P<n> of <m> · D x/y` sub-line (values match `progress()` from roadmap.ts for the fixture); with the existing no-plan board the tile still reads "Done" with ticket % and `N of M`; terminal shows `Plan NN% · Pn NN% · design vN (plan behind)` for the fixture
   - Result:
   - Evidence:

3. Roadmap card
   - Run: pane test on the fixture, desktop surface
   - Pass: a "Roadmap" card appears above "Board notes · BOARD.md"; it contains the rail SVG (not interactive), the current phase, "N of M builds built", a "next up" build, the lines "Plan is behind design v3", "D7 has no build" and "N off-plan" with the fixture's real numbers; on the no-plan board the card is absent; a plan file that fails to parse leaves the board drawn with one warning line
   - Result:
   - Evidence:

4. Phase column and filter
   - Run: pane test: press the phase filter for P2, then Off-plan, then Clear filters; click the Phase column header
   - Pass: the table shows only tickets whose `Plan:` is in P2, then only tickets with no `Plan:` line; Clear filters restores all rows; the Phase header sorts by phase; with no plan the column and filter are not shown; the column widths sum to 100%
   - Result:
   - Evidence:

5. Ticket page Properties
   - Run: pane test: open a ticket with `Plan: P2.2` and `Design: D1@2, D3@1` (D3 now Rev 2), an off-plan ticket, and a ticket pointing at a missing build
   - Pass: Properties shows the Plan item and the Design chips; D3 is marked stale and the notice "Written against D3 rev 1, now rev 2" appears; the off-plan ticket shows "Off-plan"; the missing build shows "not in the plan"; the no-plan board shows none of these
   - Result:
   - Evidence:

6. Core unit tests for new query logic
   - Run: `claude plugin test .`, looking at the `tests/core.test.ts` cases for the phase filter and sort
   - Pass: cases cover the phase filter (a phase, off-plan, any), the phase sort and the default filters; all pass
   - Result:
   - Evidence:

7. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README's pane section, Board and Ticket sections describe Plan %, the Roadmap card, the Phase column/filter, and the Plan item/Design chips as built; Done % wording is gone where the tile changed; the Development layout matches any new files
   - Result:
   - Evidence:

## Not checked by automation

- How the rail SVG and Roadmap card look in the real desktop app (colours, spacing, narrow pane widths).
- That a real project's plan (for example one adopted in 0009) reads sensibly in the card.

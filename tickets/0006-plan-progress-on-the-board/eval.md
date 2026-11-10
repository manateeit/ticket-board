# Eval — 0006 — Plan progress on the board

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and the suite passes
   - Run: `claude plugin validate .` then `claude plugin test .` from the repo root (tsc is not installed; do not use it)
   - Pass: both exit 0; no previously passing test in `tests/core.test.ts` or `tests/pane.test.tsx` is removed or skipped
   - Result: PASS
   - Evidence: validate: 'Validation passed', exit 0. plugin test: 101 pass, 0 fail across 3 files. Diff to tests removes no test cases; no skip/only. 0004 Start screen tests and 0013 duplicate-agent test still present and passing.

2. Plan % tile and fallback (desktop and terminal)
   - Run: the new pane test(s) on the roadmap fixture (a plan with 4 phases, a design at v3, tickets in several statuses) and on the existing no-plan board
   - Pass: with the fixture the last tile reads "Plan" with the computed % and a `P<n> of <m> · D x/y` sub-line (values match `progress()` from roadmap.ts for the fixture); with the existing no-plan board the tile still reads "Done" with ticket % and `N of M`; terminal shows `Plan NN% · Pn NN% · design vN (plan behind)` for the fixture
   - Result: PASS
   - Evidence: Pane tests 'plan bound: Plan % from progress(), not ticket Done %' (terminal+desktop) and 'no plan: the tile stays Done...' pass. Code: kpi-done reads 'Plan' with planSummary().planPct from roadmap progress() (Plan % over all counted builds), sub-line 'P2 of 4 · D x/y · tickets N%' (ticket % beside it per Resolved answer); no plan keeps Done / N of M. Terminal line 'Plan NN% · Pn NN% · design vN (plan behind) · tickets N%'. Reuses hooks/core/roadmap.ts (roadmap(), progress, checks, allBuilds, ticketRef); no re-implemented maths.

3. Roadmap card
   - Run: pane test on the fixture, desktop surface
   - Pass: a "Roadmap" card appears above "Board notes · BOARD.md"; it contains the rail SVG (not interactive), the current phase, "N of M builds built", a "next up" build, the lines "Plan is behind design v3", "D7 has no build" and "N off-plan" with the fixture's real numbers; on the no-plan board the card is absent; a plan file that fails to parse leaves the board drawn with one warning line
   - Result: PASS
   - Evidence: Tests pass: Roadmap card test asserts ROADMAP before BOARD NOTES, static rail SVG (no script/animate/interactive), check mark, 'Now: P2 · Booking · N of M builds built · next up P2.3 (no ticket)', 'Plan is behind design v3', 'D7 has no build', '1 off-plan', open questions, stale. 'Open plan'/'Replan'/'Review' not drawn (asserted). Unparseable plan test: one 'showing tickets only' warning, board and Done tile drawn, no card. No-plan board: card absent. Sanity on this repo's own board (main checkout, now with 0004/0005 done): Plan 33%, P3 of 4, D 4/8, next P3.1, warning '4 off-plan' - consistent with the board's current state (0005 now merged, so a step beyond the briefed 24%/P2/D3/P2.2); numbers come straight from roadmap.ts.

4. Phase column and filter
   - Run: pane test: press the phase filter for P2, then Off-plan, then Clear filters; click the Phase column header
   - Pass: the table shows only tickets whose `Plan:` is in P2, then only tickets with no `Plan:` line; Clear filters restores all rows; the Phase header sorts by phase; with no plan the column and filter are not shown; the column widths sum to 100%
   - Result: PASS
   - Evidence: Test 'phase column and filter: P2, Off-plan, Clear filters, sort by phase (desktop)', 'phase filter in the terminal', and 'board columns total 100% with and without the Phase column' pass. Code: boardCols gives Title 27%+Phase 6% with plan (total 100), 33% without; column and Select only when plan bound; CLEARED includes phase; filter persisted via Filters; rail link toggles filter.

5. Ticket page Properties
   - Run: pane test: open a ticket with `Plan: P2.2` and `Design: D1@2, D3@1` (D3 now Rev 2), an off-plan ticket, and a ticket pointing at a missing build
   - Pass: Properties shows the Plan item and the Design chips; D3 is marked stale and the notice "Written against D3 rev 1, now rev 2" appears; the off-plan ticket shows "Off-plan"; the missing build shows "not in the plan"; the no-plan board shows none of these
   - Result: PASS
   - Evidence: Test 'ticket Properties: Plan item, Design chips, stale notice, off-plan, missing build (desktop)' and terminal text test pass; no-plan tests show none. Code: ticketPlan gives 'P2.2 · name', 'Off-plan', 'P9.9 — not in the plan', chips D1@2/D3@1 with stale mark, notice 'Written against D3 rev 1, now rev 2'.

6. Core unit tests for new query logic
   - Run: `claude plugin test .`, looking at the `tests/core.test.ts` cases for the phase filter and sort
   - Pass: cases cover the phase filter (a phase, off-plan, any), the phase sort and the default filters; all pass
   - Result: PASS
   - Evidence: core.test.ts 'phase filter and sort' passes: any/P2/off-plan/unknown phase, default filters (phase 'any'), old saved filters without phase, no-plan ignores filter, numeric phase sort (P2 before P10, off-plan last), desc, comparePhase.

7. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README's pane section, Board and Ticket sections describe Plan %, the Roadmap card, the Phase column/filter, and the Plan item/Design chips as built; Done % wording is gone where the tile changed; the Development layout matches any new files
   - Result: PASS
   - Evidence: README diff: Board bullet now Plan % (with Done fallback) and phase filter, Roadmap card paragraph, Phase column, Ticket Properties (Plan item, Design chips, stale notice), '### Board' Show/Sort/Mode/Phase and plan line, '### Ticket' plan item/chips, remembered filters, Development test paragraph updated (no new files). Done % wording removed where tile changed (kept as no-plan fallback). docs/STANDARD.md linked from Roadmap text. Extra README line outside the Docs list (remembered Phase choice) is accurate; not a contradiction.

## Not checked by automation

- How the rail SVG and Roadmap card look in the real desktop app (colours, spacing, narrow pane widths).
- That a real project's plan (for example one adopted in 0009) reads sensibly in the card.

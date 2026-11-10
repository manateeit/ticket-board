# Eval — 0015 — Redesign notes and stale tickets

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 203 pass, 0 fail across 3 files (194 before). No test skipped or deleted; one assertion edited (see check 3).

2. Stale detection
   - Run: core test with a ticket saying `Design: D3@1` and a design whose D3 is `Rev: 2`; and one saying `D3@2`
   - Pass: the first is flagged stale and counted in the alerts; the second is not
   - Result: PASS
   - Evidence: Core tests cover D3@1 vs Rev 2 flagged (linkTickets/staleOf) and counted in the stale-tickets alert; D3@2 not flagged. Pane test shows alert '⚠ 2 stale tickets: 0001, 0003'; 0002 (D3@2) has no chip.

3. Stale chip and Review
   - Run: pane test (both surfaces) on that fixture: board row, ticket page, press Review
   - Pass: the chip reads "Written against D3 rev 1, now rev 2 — Review"; Review opens the ticket page; no job is started and nothing is written
   - Result: PASS
   - Evidence: Pane tests on terminal and desktop: chip 'Written against D3 rev 1, now rev 2 — Review' on board row (key stale-0001-D3) and ticket page (review-D3); Review opens the ticket page, pressing again stays; asserts no agent spawned, no prompt filled, no writes, file map unchanged. The edited old assertion (`not.toContain('Review')` -> `toContain('... — Review')`) was a placeholder for this ticket's Review action and is now stricter (full chip text), a correct update, not a weakening.

4. Done tickets untouched; bad input
   - Run: test with a stale `done` ticket, and tickets with a malformed `Design:` line or an unknown section
   - Pass: the done ticket's files and board row are byte-identical before and after; malformed input gives no flag and no error
   - Result: PASS
   - Evidence: Pane test: stale done ticket 0001 files and BOARD.md byte-identical (whole fs map and exact rd.md/BOARD.md compared); 0004 malformed Design line and 0005 unknown section give no chip and no error. parseDesignRefs dedupes ids so chip keys are unique.

5. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README describes the stale chip, Review and the alert; STANDARD.md's change-note format matches the code
   - Result: PASS
   - Evidence: README stale chip/Review/alert text and STANDARD.md sections 4 and 8 updated. skills/design/SKILL.md and templates/change.md write '- Changed D<n> (Rev <a> → <b>): …', '- Added D<n> · Title', '- Dropped D<n> · Title' under '## Changes' with design-version/date front matter; parseChangeNote's regex matches all of them (and ->), so real notes parse.

## Not checked by automation

- A real redesign through the design skill producing a change note the pane reads correctly.

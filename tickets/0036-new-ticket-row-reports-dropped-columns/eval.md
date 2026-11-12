# Eval — 0036 — New ticket rows report dropped columns

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` exit 0: 366 pass, 0 fail, 0 skipped (68s), including the 0022 large-plan render tests (no timeout this run). Diff touches only addRow/createSkeleton/new-ticket form/createPlanTickets, so it cannot affect those render tests. Tests only added/edited (2 call sites adapted to `.text`), none deleted. Diff clean, no stray edits; all callers handle `{text, skipped}`: store.ts createSkeleton, tests; createSkeleton callers: views.tsx createTicket and ai.ts createPlanTickets use `skipped`, ai.ts createFollowUps (mode solo, blockedBy []) loses nothing reportable.

2. addRow reports skipped values (fails before the fix)
   - Run: core test: board without Mode and Blocked by; addRow with mode and blockedBy
   - Pass: both reported as skipped; row written without them
   - Result: PASS
   - Evidence: Core test 'addRow reports values the board has no column for and writes the row without them (0036)' passes on 6b689de; with hooks/ from 0100bc8 it fails (along with the two adapted addRow tests, 3 core fails). Restored hooks afterwards; git status clean.

3. New-ticket form does not claim success
   - Run: pane test (terminal and desktop) on a board without Blocked by: create a ticket with a dependency
   - Pass: the pane says the dependency was not saved, or the field is not offered
   - Result: PASS
   - Evidence: Pane tests (terminal and desktop) 'a board without Blocked by does not offer it...' and 'a dependency the board cannot hold is reported, not Created' plus the plan-batch test pass on 6b689de; all 5 new pane tests fail with hooks/ from 0100bc8 (8 fails total). Code: form shows 'Blocked by: BOARD.md has no Blocked by column' instead of the field; createTicket says 'Created N · Blocked by X not saved: ...' (warning). Host rules checked: new functions (droppedNote, lostDepsNote) are plain declarations, no `h` local, no explicit undefined props, keys unique (conditional branches).

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md (New ticket section, Creating a ticket step 2, plan batch step 2) describes the offer-only-with-column behaviour, the not-saved message and the batch summary naming tickets. rd.md Docs lists README.md only.

## Not checked by automation

- none

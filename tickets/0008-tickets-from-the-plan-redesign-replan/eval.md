# Eval — 0008 — Tickets from the plan, redesign and replan

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed)
   - Pass: both exit 0; the new tests below are included in the run
   - Result:
   - Evidence:

2. Batch create from builds
   - Run: unit/pane test on a fixture plan with 5 builds (one already has a ticket, one `Needs` another) using a fake agent spawner
   - Pass: 4 skeleton folders and 4 `draft` rows exist; the existing one is skipped; Blocked by holds ticket numbers mapped from `Needs`; PLAN.md `Ticket` cells filled; never more than 3 jobs live at once and the 4th starts when one ends
   - Result:
   - Evidence:

3. Ticket content from the plan
   - Run: inspect the brief sent to the spawner and the finished fixture ticket files
   - Pass: the brief contains the covered sections' `Done when` lines; rd.md has `Plan:` and `Design:` lines, `## Docs` naming README.md; eval.md has one check per `Done when` line plus "Docs and README updated"; a ticket missing `## Docs` or that check is reported in Notes
   - Result:
   - Evidence:

4. Stale detection
   - Run: core test with a ticket saying `Design: D3@1` and a design whose D3 is `Rev: 2`
   - Pass: ticket is flagged stale and counted in the alerts; D3@2 is not flagged
   - Result:
   - Evidence:

5. Replan apply (the milestone test)
   - Run: test with a proposal of Add, Change, Drop and Follow-up items (a done build among them), tick a subset, press Apply selected
   - Pass: PLAN.md has the Add row, the Change edit, the Drop as `Status: dropped` (row kept) and `design-version` updated; new draft tickets exist for Add and Follow-up; unticked items are unchanged; files and board row of every `done` ticket are byte-identical to before; no ticket becomes `ready`
   - Result:
   - Evidence:

6. Apply safety
   - Run: test where PLAN.md changes after the proposal; and one applying with nothing ticked
   - Pass: first writes nothing and shows "plan changed; regenerate the proposal"; second is a no-op
   - Result:
   - Evidence:

7. Docs follow-up
   - Run: test with a design change that touches a behaviour README describes
   - Pass: the proposal and the change note contain one "Update README/docs" Follow-up item
   - Result:
   - Evidence:

8. End-to-end in the pane
   - Run: open the pane on a copy of a fixture project (PLAN.md plus design v3 with a change note); press Create tickets for a phase; open the replan banner; tick two items; Apply
   - Pass: draft rows appear on the board, the review screen groups Add / Change / Drop / Follow-up with reasons, and the Plan view shows the new ticket numbers
   - Result:
   - Evidence:

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each describes creating tickets from the plan, stale tickets and replan review as built; README.md is current, including the file list in Development
   - Result:
   - Evidence:

## Not checked by automation

- Quality of the tickets and proposals the real AI agents write, and the look of the review screen in the desktop app.

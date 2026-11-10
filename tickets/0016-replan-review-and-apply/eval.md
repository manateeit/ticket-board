# Eval — 0016 — Replan review and apply

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Replan apply (the milestone test)
   - Run: test with a proposal of Add, Change, Drop and Follow-up items (a done build among them), tick a subset, press Apply selected
   - Pass: PLAN.md has the Add row, the Change edit, the Drop as `Status: dropped` (row kept) and `design-version` updated; new draft tickets exist for Add and Follow-up; unticked items are unchanged; files and board row of every `done` ticket are byte-identical to before; no ticket becomes `ready`
   - Result:
   - Evidence:

3. Apply safety
   - Run: test where PLAN.md changes after the proposal; one applying with nothing ticked; one with an unreadable proposal
   - Pass: first writes nothing and shows "plan changed; regenerate the proposal"; second is a no-op; third shows the file path
   - Result:
   - Evidence:

4. Docs follow-up
   - Run: test with a design change that touches a behaviour README describes
   - Pass: the proposal and the change note contain one "Update README/docs" Follow-up item
   - Result:
   - Evidence:

5. End-to-end in the pane
   - Run: pane test (both surfaces) on a fixture project (PLAN.md plus design v3 with a change note and a replan proposal): open the banner, tick two items, Apply
   - Pass: the review screen groups Add / Change / Drop / Follow-up with reasons and nothing ticked by default; after Apply, draft rows appear on the board and the Plan view shows the changes
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each describes the replan banner, review and apply as built; proposal format matches STANDARD.md and the planner agent
   - Result:
   - Evidence:

## Not checked by automation

- Quality of real planner proposals, and the look of the review screen in the desktop app.

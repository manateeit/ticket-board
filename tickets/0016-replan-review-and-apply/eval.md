# Eval — 0016 — Replan review and apply

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed'; `claude plugin test .`: 238 pass, 0 fail (213 on base + 25 new; none skipped or deleted; one 0007 assertion changed, see report). Sandbox network-deny notices only.

2. Replan apply (the milestone test)
   - Run: test with a proposal of Add, Change, Drop and Follow-up items (a done build among them), tick a subset, press Apply selected
   - Pass: PLAN.md has the Add row, the Change edit, the Drop as `Status: dropped` (row kept) and `design-version` updated; new draft tickets exist for Add and Follow-up; unticked items are unchanged; files and board row of every `done` ticket are byte-identical to before; no ticket becomes `ready`
   - Result: PASS
   - Evidence: Pane tests (desktop and terminal surfaces) 'replan apply: Add row, Change edit, Drop as dropped, design-version, draft tickets; done tickets untouched' plus core test 'replan apply (milestone)' pass in the run: PLAN.md row/Change/Status dropped/design-version asserted, unticked unchanged, done-ticket files and board rows byte-identical (pane.test.tsx ~2618), no ticket ready.

3. Apply safety
   - Run: test where PLAN.md changes after the proposal; one applying with nothing ticked; one with an unreadable proposal
   - Pass: first writes nothing and shows "plan changed; regenerate the proposal"; second is a no-op; third shows the file path
   - Result: PASS
   - Evidence: Tests 'replan safety: nothing ticked is a no-op; a changed PLAN.md stops Apply and writes nothing' (no writes, file map identical, no spawns, message 'plan changed; regenerate the proposal'), and 'unreadable proposal shows its file path' (and no-heading variant), both surfaces, all pass.

4. Docs follow-up
   - Run: test with a design change that touches a behaviour README describes
   - Pass: the proposal and the change note contain one "Update README/docs" Follow-up item
   - Result: PASS
   - Evidence: Core test 'docs follow-up: one Update README/docs item in the proposal and one line in the change note' and pane test 'replan banner starts the planner; the proposal and the change note get one docs follow-up' pass.

5. End-to-end in the pane
   - Run: pane test (both surfaces) on a fixture project (PLAN.md plus design v3 with a change note and a replan proposal): open the banner, tick two items, Apply
   - Pass: the review screen groups Add / Change / Drop / Follow-up with reasons and nothing ticked by default; after Apply, draft rows appear on the board and the Plan view shows the changes
   - Result: PASS
   - Evidence: Pane tests 'replan end to end: review groups with reasons, nothing ticked; tick two, Apply; board and Plan show it' pass on both surfaces (draft row on board, Plan shows dropped/new build, '3 replan items to review'). Run via the repo's pane test harness; no live desktop run.

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each describes the replan banner, review and apply as built; proposal format matches STANDARD.md and the planner agent
   - Result: PASS
   - Evidence: README.md (new Replanning section, Roadmap card, review screen, how-it-edits), docs/STANDARD.md section 8, agents/planner.md and skills/planning/SKILL.md all describe the banner, review and apply as built; format and the 8-hex FNV-1a plan-hash match the code and planner agent.

## Not checked by automation

- Quality of real planner proposals, and the look of the review screen in the desktop app.

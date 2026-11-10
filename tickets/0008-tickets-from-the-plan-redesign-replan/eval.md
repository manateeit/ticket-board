# Eval — 0008 — Tickets from the plan

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed)
   - Pass: both exit 0; the new tests below are included in the run; no test skipped or deleted
   - Result:
   - Evidence:

2. Batch create from builds
   - Run: unit/pane test on a fixture plan with 5 builds (one already has a ticket, one `Needs` another) using a fake agent spawner
   - Pass: 4 skeleton folders and 4 `draft` rows exist; the existing one is skipped and the toast says so; Blocked by holds ticket numbers mapped from `Needs`; PLAN.md `Ticket` cells filled; never more than 3 jobs live at once and the 4th starts when one ends
   - Result:
   - Evidence:

3. Ticket content from the plan
   - Run: inspect the brief sent to the spawner and the finished fixture ticket files
   - Pass: the brief contains the covered sections' `Done when` lines and the phase Goal and Exit; rd.md has `Plan:` and `Design:` lines (with current Revs), `## Docs` naming README.md; eval.md has one check per `Done when` line plus "Docs and README updated"; a ticket missing `## Docs` or that check is reported in Notes and the toast
   - Result:
   - Evidence:

4. Unselected needed build and failed job
   - Run: test creating one build whose `Needs` build is not selected; and a test where a writer job fails
   - Pass: the first row's Blocked by omits the unselected build and its Notes record the missing dependency; the failed build shows its reason and can be created again; nothing becomes `ready`
   - Result:
   - Evidence:

5. End-to-end in the pane
   - Run: pane test (both surfaces) on a fixture project with PLAN.md: open Plan, press Create tickets for a phase
   - Pass: queued state shows on builds beyond the first 3; draft rows appear on the board; the Plan view shows the new ticket numbers
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each describes creating tickets from the plan as built; README.md is current, including the file list in Development
   - Result:
   - Evidence:

## Not checked by automation

- Quality of the tickets the real AI writer produces from a build, and the look of the queued state in the desktop app.

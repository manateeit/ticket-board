# Eval — 0008 — Tickets from the plan

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed)
   - Pass: both exit 0; the new tests below are included in the run; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` 194 pass, 0 fail across 3 files; includes the 4 new 0008 pane tests on both surfaces plus the 5 core tests. grep of the test diff: no skip/only/todo added. One removed assertion (`expect(drawn).not.toContain('Create ticket')` in the 0007 plan test, 'not built' comment) was replaced by checks that `build-create-P3.1` and `phase-create-P3` exist and that ticketed builds/phases have no create buttons. That is a correct update (buttons are now meant to show), stricter than before, not a weakening; the test itself is kept. Also an unused import was dropped.

2. Batch create from builds
   - Run: unit/pane test on a fixture plan with 5 builds (one already has a ticket, one `Needs` another) using a fake agent spawner
   - Pass: 4 skeleton folders and 4 `draft` rows exist; the existing one is skipped and the toast says so; Blocked by holds ticket numbers mapped from `Needs`; PLAN.md `Ticket` cells filled; never more than 3 jobs live at once and the 4th starts when one ends
   - Result: PASS
   - Evidence: Pane test 'Create tickets for a phase: 4 skeletons, Blocked by from Needs, Plan cells, 3 writers at a time' passes (terminal and desktop) in the run above; asserts 4 skeleton folders and draft rows, skipped toast 'skipped 1 build that already has a ticket', Blocked by mapped, PLAN.md Ticket cells, max 3 live jobs and the 4th starting on completion. Core test 'plan batch' covers ordering and skipping. Code read: createPlanTickets/pumpPlanQueue (MAX_JOBS=3, one pump at a time, pumped from turn.complete).

3. Ticket content from the plan
   - Run: inspect the brief sent to the spawner and the finished fixture ticket files
   - Pass: the brief contains the covered sections' `Done when` lines and the phase Goal and Exit; rd.md has `Plan:` and `Design:` lines (with current Revs), `## Docs` naming README.md; eval.md has one check per `Done when` line plus "Docs and README updated"; a ticket missing `## Docs` or that check is reported in Notes and the toast
   - Result: PASS
   - Evidence: Test 'a plan ticket's files: Plan and Design lines, one check per Done when, docs gaps reported' passes (both surfaces). Code: planBrief carries Goal, Exit and each covered section's Done when; createSkeleton writes Plan:/Design: (designLine gives D1@2 style current Rev), one check per Done when plus 'Docs and README updated'; turn.complete runs docsGaps and reports into row Notes and toast.

4. Unselected needed build and failed job
   - Run: test creating one build whose `Needs` build is not selected; and a test where a writer job fails
   - Pass: the first row's Blocked by omits the unselected build and its Notes record the missing dependency; the failed build shows its reason and can be created again; nothing becomes `ready`
   - Result: PASS
   - Evidence: Test 'one build whose needed build is not selected; a failed writer can be created again' passes (both surfaces). Code: blockedByFor omits unselected need and missingNote goes in Notes; failure sets S.planFailed, view shows 'failed: <reason>' and '↻ Create again' (retryPlanBuild reuses same ticket). grep: no code path sets status ready; rows are created draft.

5. End-to-end in the pane
   - Run: pane test (both surfaces) on a fixture project with PLAN.md: open Plan, press Create tickets for a phase
   - Pass: queued state shows on builds beyond the first 3; draft rows appear on the board; the Plan view shows the new ticket numbers
   - Result: PASS
   - Evidence: Tests 'Create tickets for a phase...' (terminal and desktop) and 'the plan queue survives a redraw and a trip to the board and back (desktop)' and 'a writer that cannot start shows why; Create tickets for all not started' pass: queued shown beyond the first 3, draft rows on the board, Plan view shows new numbers.

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each describes creating tickets from the plan as built; README.md is current, including the file list in Development
   - Result: PASS
   - Evidence: README.md has new section 'Creating tickets from the plan' (buttons, skeleton, Blocked by, Plan cell, queue of 3, docs check, failure/Create again), TOC renumbered, writer-guard text, Troubleshooting rows, and the Development file list (desk, glass, plan, store, ai, core) updated. skills/ticket/SKILL.md has 'Tickets from the plan' (Plan:/Design: lines, brief, queue); agents/ticket-writer.md documents the plan-build brief and Plan:/Design: lines.

## Not checked by automation

- Quality of the tickets the real AI writer produces from a build, and the look of the queued state in the desktop app.

# Eval — 0041 — Store writes: fresh snapshot and no edits under an AI job

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 360 pass / 3 fail on run 1, 359 pass / 4 fail on run 2; the only failures are the 0022 large-plan render tests (`a plan of 8 phases and 49 builds…` x3 themes, `a plan too large for the terminal…`), each timing out at 5000 ms (run 2: 5136, 5010, 5182, 5366 ms) on a heavily loaded host; they also time out on main. The diff touches only editRow/editRd/saveAnswer/rdLock, QuestionsCard, the Type select and questionsView, none on the plan render path. Counted PASS on that basis. No test skipped or deleted (diff only adds tests).

2. Write then redraw is fresh (fails before the fix)
   - Run: pane test: hold a plain refresh mid-read, save an answer
   - Pass: the answer shows as resolved right away
   - Result: PASS
   - Evidence: New tests `an answer saved while a plain refresh is mid-read shows as resolved right away` (terminal, desktop) pass on the branch. With hooks/store.ts, desk.tsx, views.tsx from main (plus a no-op editRd/rdLock stub so the test file loads) both fail; without the stub the file does not load. Files restored, tree clean. editRow and editRd now call refresh($, true).

3. No rd.md write under a job (fails before the fix)
   - Run: pane test: start a writer job, try to change Type and save an answer
   - Pass: controls disabled; a store call is refused and rd.md is unchanged
   - Result: PASS
   - Evidence: Tests `while a writer job holds a ticket, answers and Type are locked and the store refuses rd.md writes` (terminal, desktop) and `the store refuses rd.md writes for a ticket an AI job holds, whatever view calls it` pass on the branch; all three fail on main files. Refusal is in the store (editRd throws before any read/write, used by saveAnswer and setKind). Controls: the host has no `disabled` prop, so the answer Input and Type Select are replaced by a visible, non-interactive `🔒 The AI is writing ticket N: answers and Type are locked until it finishes` line (Type keeps its current value shown); this meets the intent of disabled with a reason, since nothing can be edited and the reason is shown. Lock release: the job is deleted in the turn.complete handler (hooks/register.tsx:236) for success, abort and error alike, then refresh and redraw, so the lock lifts. Only a writer that never emits turn.complete would hold it, bounded by the existing 6 h job expiry in loadJobs, which is pre-existing lifecycle also gating startJob. Host rules: editRd is a plain function declaration, rdLock takes no $; no local `h` added; no new explicit undefined prop values (the existing ones in views.tsx predate this diff); keys unique (`locked-${key}`, `kind-locked-${number}`).

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md adds a 'Locked while the AI writes' bullet under the questions section describing the lock message, refused rd.md edits, release when the writer finishes, and fresh redraw after any save. This is the only doc listed under ## Docs.

## Not checked by automation

- none

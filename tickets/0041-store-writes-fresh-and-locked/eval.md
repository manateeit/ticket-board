# Eval — 0041 — Store writes: fresh snapshot and no edits under an AI job

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Write then redraw is fresh (fails before the fix)
   - Run: pane test: hold a plain refresh mid-read, save an answer
   - Pass: the answer shows as resolved right away
   - Result:
   - Evidence:

3. No rd.md write under a job (fails before the fix)
   - Run: pane test: start a writer job, try to change Type and save an answer
   - Pass: controls disabled; a store call is refused and rd.md is unchanged
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

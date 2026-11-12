# Eval — 0036 — New ticket rows report dropped columns

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. addRow reports skipped values (fails before the fix)
   - Run: core test: board without Mode and Blocked by; addRow with mode and blockedBy
   - Pass: both reported as skipped; row written without them
   - Result:
   - Evidence:

3. New-ticket form does not claim success
   - Run: pane test (terminal and desktop) on a board without Blocked by: create a ticket with a dependency
   - Pass: the pane says the dependency was not saved, or the field is not offered
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

# Eval — 0044 — Every eval.md has Result and Evidence fields

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Skeleton has all fields (fails before the fix)
   - Run: pane test: create a ticket from a plan build; read eval.md
   - Pass: every check, docs check included, has Run, Pass, Result and Evidence lines
   - Result:
   - Evidence:

3. Briefs ask for the fields
   - Run: `grep -n "Result" hooks/ai.ts agents/ticket-writer.md`
   - Pass: both name Result and Evidence
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

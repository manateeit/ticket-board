# Eval — 0034 — Run line places the wait-for-blockers clause itself

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Wait clause follows the run sentence with a router (fails before the fix)
   - Run: core test: `runLine(['0005'], true, board, ['0003'])`; pane test pressing Run on a ready ticket with an open blocker in a project with a router
   - Pass: the clause comes before the router tail; the tail is unchanged
   - Result:
   - Evidence:

3. No blockers: unchanged text
   - Run: core test comparing against the 0.5.3 strings for router/plain × default/non-default board
   - Pass: byte-identical
   - Result:
   - Evidence:

4. No caller edits the text
   - Run: `grep -nF 'replace(/\.$/' hooks/views.tsx hooks/desk.tsx hooks/plan.tsx`
   - Pass: no matches on a runLine result
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

# Eval — 0040 — Questions section hidden only when core finds it

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Singular heading is visible (fails before the fix)
   - Run: pane test (desktop): rd.md with `## Open question` and one bullet
   - Pass: the questions are visible (as a card or as the section) and the ready check explains itself
   - Result:
   - Evidence:

3. No separate regex
   - Run: `grep -n "open questions?" hooks/desk.tsx`
   - Pass: no matches
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

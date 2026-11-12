# Eval — 0033 — One status list for glass and roadmap

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Prototype words do not crash (fails before the fix)
   - Run: pane test: a README / rd.md with inline `toString`, `constructor` and `unlisted`, desktop glass view
   - Pass: drawing succeeds; the words render as plain code, no status pill
   - Result:
   - Evidence:

3. Real statuses still render as pills
   - Run: pane test with inline `ready` and `in-check`
   - Pass: status pills shown as today
   - Result:
   - Evidence:

4. roadmap uses STATUSES
   - Run: `grep -n "'in-progress', *'in-check'" hooks/core/roadmap.ts` and a core test of buildState for every status in STATUSES
   - Pass: no hard-coded list; every status maps to a build state as today
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

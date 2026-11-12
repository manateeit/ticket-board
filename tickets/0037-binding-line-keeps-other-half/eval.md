# Eval — 0037 — Binding line keeps the half it is not given

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Existing half is kept (fails before the fix)
   - Run: core test: board with `Design: docs/arch.md · Plan: docs/roadmap.md`, setBindingLine with only a plan
   - Pass: line keeps `Design: docs/arch.md`
   - Result:
   - Evidence:

3. Adopt end to end
   - Run: pane test: board bound to custom paths, adopt a plan-only proposal
   - Pass: Design tab still shows docs/arch.md; Plan tab shows the new plan
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

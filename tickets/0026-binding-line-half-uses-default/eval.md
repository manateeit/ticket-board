# Eval — 0026 — A half binding line keeps the other default

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Design-only line binds the default plan (fails before the fix)
   - Run: core test: BOARD with `Design: design/DESIGN.md` only, both default files present
   - Pass: planPath is design/PLAN.md

3. Plan-only line binds the default design; missing default stays unbound
   - Run: core tests for both cases
   - Pass: designPath default when the file exists; undefined when it does not

4. End to end
   - Run: pane test: adopt fixture with design only, then add design/PLAN.md and refresh
   - Pass: Plan tab shows the plan; creating a ticket from a build succeeds

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

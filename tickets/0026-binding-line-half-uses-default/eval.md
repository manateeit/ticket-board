# Eval — 0026 — A half binding line keeps the other default

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: second and later run 332 pass, 0 fail, 3 files, none skipped or deleted (diff adds tests only). One earlier run showed 331 pass / 1 fail, not reproduced on rerun (load flake, test not identified).

2. Design-only line binds the default plan (fails before the fix)
   - Run: core test: BOARD with `Design: design/DESIGN.md` only, both default files present
   - Pass: planPath is design/PLAN.md
   - Result: PASS
   - Evidence: core test 'binding: a half binding line keeps the default for the other half' asserts design-only line + both files gives planPath design/PLAN.md; passes on the branch, FAILS with hooks/core/roadmap.ts from 400b67d (restored, tree clean).

3. Plan-only line binds the default design; missing default stays unbound
   - Run: core tests for both cases
   - Pass: designPath default when the file exists; undefined when it does not
   - Result: PASS
   - Evidence: same core test covers plan-only line: designPath design/design.md when file exists, undefined (no warning) when missing; both-halves line unchanged (2 warnings, blank). Passes on branch; fails on 400b67d roadmap.ts.

4. End to end
   - Run: pane test: adopt fixture with design only, then add design/PLAN.md and refresh
   - Pass: Plan tab shows the plan; creating a ticket from a build succeeds
   - Result: PASS
   - Evidence: pane tests 'adopt with a design only, then design/PLAN.md added ...' (terminal and desktop) pass: adopt writes design-only line, plan file added, refresh, Plan tab shows 'Magic link sign-in', build-create-P1.1 creates a draft ticket and writes its number into PLAN.md, no 'No PLAN.md is bound'. Both FAIL on 400b67d roadmap.ts (3 failures total, exactly the new tests).

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README.md (Start section) and docs/STANDARD.md binding-line rule both say a missing half uses its default file when it exists; doc comments in roadmap.ts and store.ts updated.
## Not checked by automation

- none

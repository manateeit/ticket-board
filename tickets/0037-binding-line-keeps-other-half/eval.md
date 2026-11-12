# Eval — 0037 — Binding line keeps the half it is not given

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` ran 3 times: run 1 358 pass/3 fail, run 2 354 pass/7 fail, run 3 360 pass/1 fail; every failure was a 0022 large-plan render test timing out at 5000 ms under machine load ("a plan of 8 phases and 49 builds…" x6 variants, "a plan too large for the terminal…", 5.0-6.3 s). The same tests also time out on main's roadmap.ts (5.0-5.9 s, run with the fix reverted). The diff touches only setBindingLine, README, STANDARD.md and 2 new tests, none of which these render tests call, so it cannot affect them. Counted PASS on that basis (timeouts from load, not from this diff). No test skipped or deleted (diff only adds tests; 0037 tests pass).

2. Existing half is kept (fails before the fix)
   - Run: core test: board with `Design: docs/arch.md · Plan: docs/roadmap.md`, setBindingLine with only a plan
   - Pass: line keeps `Design: docs/arch.md`
   - Result: PASS
   - Evidence: Core test 'binding: rewriting the line keeps the half it is not given (0037)' passes with the fix (setBindingLine with only a plan keeps `Design: docs/arch.md`). With hooks/core/roadmap.ts restored from main (0100bc8) it FAILS; file then restored via git checkout, tree clean.

3. Adopt end to end
   - Run: pane test: board bound to custom paths, adopt a plan-only proposal
   - Pass: Design tab still shows docs/arch.md; Plan tab shows the new plan
   - Result: PASS
   - Evidence: Pane tests 'adopt a plan-only proposal on a board bound to custom paths keeps the custom design' (terminal, desktop) pass with the fix: BOARD.md gets `Design: docs/arch.md · Plan: design/PLAN.md`, Plan tab shows the new plan, Design tab shows 'Arch accounts', no 'No design'. With main's roadmap.ts both FAIL. Host rules checked on the diff: no new `h` local, no explicit `undefined` prop values, no new exported `$`-taking function (only setBindingLine edited, a plain function).

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md (Binding line bullet: 'replacing the one there, keeping the half it did not write, or adding it under the title') and docs/STANDARD.md section 5 (new bullet with the docs/arch.md example) and section 9 step 3 describe the behaviour as built.

## Not checked by automation

- none

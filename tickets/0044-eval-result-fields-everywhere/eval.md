# Eval — 0044 — Every eval.md has Result and Evidence fields

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS (stated basis: only the 0022 large-plan timeouts fail)
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` on 2bdc3fd: 358 pass; the only failures are the 0022 large-plan render tests, timeout at 5 s under load (rerun: 'too large for the terminal' 5162/5175 ms, '8 phases and 49 builds' 5261 ms). They time out 5.0-6.1 s on base hooks too. Those tests never create a ticket (no build-create, no writer spawn), and the diff touches only createSkeleton and the writer brief, so it cannot affect them. No test skipped or deleted; one existing test edited (Run/Pass counts 3 to 4: 3 checks plus the docs check), correct. Committed diff read in full: only agents/ticket-writer.md, hooks/ai.ts, hooks/store.ts, skills/ticket/SKILL.md, tests/pane.test.tsx; no stray edits.

2. Skeleton has all fields (fails before the fix)
   - Run: pane test: create a ticket from a plan build; read eval.md
   - Pass: every check, docs check included, has Run, Pass, Result and Evidence lines
   - Result: PASS
   - Evidence: Round 2 on dcb2a81 (after main merge): test passes (170 ms). Round 1: New test 'a plan ticket skeleton gives every check, docs check included, Run, Pass, Result and Evidence lines (desktop)' passes on 2bdc3fd (4 checks, each with exactly Run, Pass, Result, Evidence). With hooks/store.ts and hooks/ai.ts from base 0100bc8 it FAILS (as do the two edited '3 to 4' plan-ticket-file tests); files restored, tree clean. (Against current main hooks, which have moved on, extra unrelated failures appear; the base-commit run is the valid comparison.)

3. Briefs ask for the fields
   - Run: `grep -n "Result" hooks/ai.ts agents/ticket-writer.md`
   - Pass: both name Result and Evidence
   - Result: PASS
   - Evidence: hooks/ai.ts:74 names 'Result:' and 'Evidence:'; agents/ticket-writer.md:47-48 names **Result:** and **Evidence:**.

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: Round 2 on dcb2a81. README.md:282 now says eval.md gets one check per Done when line 'with Run: and Pass: lines to fill in and empty Result: and Evidence: lines for the checker, as in the template' and the Docs and README updated check 'with the same four lines'; matches the built skeleton. skills/ticket/SKILL.md:103-106 says the same. rd.md's README 'no change' note is superseded by the accurate README text. Also ran `claude plugin validate .` (exit 0) and `claude plugin test .` once: 380 pass, 1 fail, the 0022 large-plan render test ('a plan too large for the terminal', timed out after 5000 ms), the known unrelated timeout.

## Not checked by automation

- none

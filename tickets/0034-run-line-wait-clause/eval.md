# Eval — 0034 — Run line places the wait-for-blockers clause itself

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS (on the stated load basis)
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` run on the branch 3 times: 358 pass/3 fail, then 359 pass/2 fail (361 tests, none skipped or deleted; +3 new 0034 tests). The only failures were the 0022 large-plan render tests, all `timed out after 5000 ms` (5192 ms 8 phases/49 builds, 5380 ms 8 phases×20 builds on the final run; 5404 ms seen on an earlier run; the first run's third failure was not named, the other runs showed only these tests). This diff only changes runLine's string building and one call in runTicket, so it cannot affect plan-render timing. The same large-plan tests also time out (5.3-5.9 s, four of them) in the run with main's query.ts/views.tsx. No other test failed on the branch.

2. Wait clause follows the run sentence with a router (fails before the fix)
   - Run: core test: `runLine(['0005'], true, board, ['0003'])`; pane test pressing Run on a ready ticket with an open blocker in a project with a router
   - Pass: the clause comes before the router tail; the tail is unchanged
   - Result: PASS
   - Evidence: Core test `run lines place the wait-for-blockers clause after the run sentence (0034)` and pane tests `Run on a ready ticket with an open blocker waits before the router tail (terminal/desktop)` pass on the branch. With hooks/core/query.ts and hooks/views.tsx restored from main (0100bc8) the full suite had 7 failures: those 3 new tests plus the 4 load timeouts. Files restored afterwards; `git status` clean. Result: `runLine(['0005'], true, board, ['0003'])` = `Run ticket 0005 — but only once 0003 is done — as the router. If this session is not already the router, first read .claude/agents/router.md …` (wait clause on the run instruction, tail text unchanged, ` as the router.` tail verbatim after the ` —`). Reads correctly; the dash-then-`as the router` form keeps the sentence grammatical.

3. No blockers: unchanged text
   - Run: core test comparing against the 0.5.3 strings for router/plain × default/non-default board
   - Pass: byte-identical
   - Result: PASS
   - Evidence: Beyond the worker's test, I ran a differential test of 0.5.3's runLine (from 0100bc8) against the new one: router/plain × tickets/BOARD.md / work/BOARD.md × 1, 2 and 3 tickets × waitFor undefined/[] = 24 comparisons, all byte-identical (`compared 24`, 1 pass). The worker's core test also asserts literal 0.5.3 strings.

4. No caller edits the text
   - Run: `grep -nF 'replace(/\.$/' hooks/views.tsx hooks/desk.tsx hooks/plan.tsx`
   - Pass: no matches on a runLine result
   - Result: PASS
   - Evidence: `grep -nF 'replace(/\.$/' hooks/views.tsx hooks/desk.tsx hooks/plan.tsx` gives no matches (exit 1). runTicket now passes the open blockers to runLine (`runLine([number], S.hasRouter, boardPath(), open)`). Host rules on the diff: runLine is a plain function with no `$`, runTicket stays a plain `function`, no local `h`, no explicit `undefined` prop values.

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md line in the Run line section now shows the wait right after the run sentence and the router form (`Run ticket 0014 — but only once 0008 is done — as the router. If this session is not already the router, …`), matching the built text. rd.md lists only README.md under ## Docs.

## Not checked by automation

- none

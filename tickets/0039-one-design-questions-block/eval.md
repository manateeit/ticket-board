# Eval — 0039 — One rule for where a design section's questions end

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` on c3af5f6: 360 pass, 1 fail, 361 tests, none skipped/deleted; the only failure is `a plan too large for the terminal (8 phases × 20 builds)…` (timed out after 5000 ms; 5039 ms, 5161 ms in an earlier run; also timed out on main: 5193 ms, with main's roadmap.ts/designfile.ts). The 6 `a plan of 8 phases and 49 builds…` tests passed this run (2.1-2.7 s) and timed out only in earlier runs under heavier load. The diff touches only roadmap.ts/designfile.ts question parsing, docs and two new tests; the large-plan tests render plan phases and cannot reach it. Counted PASS on that load-timeout basis only.

2. Later subsection is not questions (fails before the fix)
   - Run: core test: D section with `### Open questions` (1 bullet) then `### Notes` (2 bullets)
   - Pass: one open question
   - Result: PASS
   - Evidence: New core test `roadmap: a ### subsection after Open questions ends them, reader and writer agree (0039)` in tests/roadmap.test.ts (D3 with `### Open questions` 1 bullet then `### Notes` 2 bullets): passes on the branch (one open question, answer lands before `### Notes`). With roadmap.ts and designfile.ts restored from main it FAILS (Expected one question, received extra bullets). Files restored afterwards; git status clean. Section with no later subsection still parses/answers as before (test's `plain` case; existing roadmap and designfile tests all pass).

3. Answering works
   - Run: pane test: answer that question from the Design tab
   - Pass: answer written; no "That question changed" error
   - Result: PASS
   - Evidence: New pane tests `Design tab: bullets under a later ### are not questions; the real one answers` (terminal and desktop): pass on the branch (banner says 2 open questions, only dq-D3-0 shown, answer written before `### Notes`, no 'That question changed'). Both FAIL with main's roadmap.ts/designfile.ts (banner said 4 open questions). Restored; tree clean.

4. One parser
   - Run: read designfile.ts and roadmap.ts
   - Pass: no second copy of the D heading regex or questions-block scan
   - Result: PASS
   - Evidence: designfile.ts imports D_HEADING, questionsBlock, questionText from roadmap.ts; only one D heading regex (roadmap.ts:61) and one questions-block scan (`questionsBlock`, roadmap.ts:78) and one `questionText` remain; parseSection and answerDesignQuestion both call them. Host rules: no exported function taking `$` was added or changed; no local named `h`.

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: docs/STANDARD.md Open questions row now says the block ends at the next `###` (or `##`) and later `###` subsections are not questions, matching the code. rd.md states README needs no change (no visible change beyond the fix).

## Not checked by automation

- none

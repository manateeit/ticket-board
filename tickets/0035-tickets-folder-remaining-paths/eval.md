# Eval — 0035 — Tickets folder setting: remaining paths

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` run 3 times under load ~120: 370 pass, 1 fail in runs 1 and 3, only the 0022 large-plan render tests failing with `timed out after 5000 ms` (run 2: the 8-phase/49-build variants; run 3: only 'a plan too large for the terminal', 5082 ms, while the 49-build variants passed at 2.9-4.2 s). The same large-plan test also fails on base hooks (5350 ms) so it is load-related; the diff only adds withBoard on button presses and a Set lookup in hasCode, nothing on the render path. No test skipped or deleted (diff only adds tests). Counted PASS on that basis.

2. Prompts carry the board path (fails before the fix)
   - Run: pane tests with ticketsDir `work`: Write it in chat, ticket Brainstorm, Start-screen design/plan prompts
   - Pass: each filled prompt names `work/BOARD.md`; with the default each equals today's text
   - Result: PASS
   - Evidence: New pane tests (terminal and desktop) pass: with ticketsDir `work`, Brainstorm/Redesign/Write it in chat/Start-screen design, brainstorm, from-code, from-brief and plan prompts all end `(board: work/BOARD.md)`; default test asserts `/ticket-board:ticket Export button does nothing` unchanged. withBoard returns the command unchanged for the default board, so all default prompts are byte-identical. With hooks/ restored from main (0100bc8) the core file did not load (withBoard missing) and all 9 new pane tests failed; hooks restored, tree clean. Skills: planning/SKILL.md says a trailing `(board: <path>)` is not an argument and must be removed first, refusal only for anything else, so `/ticket-board:planning (board: …)` is not refused; brainstorm, design and ticket SKILL.md carry the same rule.

3. Nested tickets folder is not code
   - Run: core test: hasCode(['planning','README.md'], 'planning/tickets') and a bound `spec/DESIGN.md`
   - Pass: false
   - Result: PASS
   - Evidence: core test 'hasCode ignores the top folder of a nested tickets folder and of the bound design and plan' passes (planning/tickets -> false; spec/DESIGN.md bound -> false; negatives true), plus pane test for an empty `planning/tickets` project showing Start without code. Both failed on main hooks. Removing `tickets` from NOT_CODE is safe: the default ticketsDir `tickets` is in the own set via topOf, so a default project with `tickets/` still counts as no code (core test asserts hasCode(['tickets','README.md'],'work') is true only when the setting differs). store.ts passes [designPath, planPath].

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md Tickets folder row now says the pane-filled slash commands follow the setting with a trailing `(board: <folder>/BOARD.md)`, unchanged with the default, and describes the hasCode skip; this is the only doc listed under ## Docs in rd.md. Skills' docs consistent. Host rules: no new exported `$` functions, no local `h`, no explicit `undefined` prop values in the diff.

## Not checked by automation

- none

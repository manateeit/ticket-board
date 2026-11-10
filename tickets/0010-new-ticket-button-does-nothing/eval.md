# Eval — 0010 — New ticket button does nothing

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` from the repo root
   - Pass: both exit 0; no test skipped or deleted compared with before the change
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 112 pass, 0 fail across 3 files (main had 101; +11 new, none skipped or deleted; git diff vs 4fb7f16 only adds lines to tests/pane.test.tsx).

2. Pane test: pressing + New ticket opens the form (both surfaces)
   - Run: read `tests/pane.test.tsx`, then run `claude plugin test .`. The test boots the pane with `boot()` for `terminal` and `desktop`, waits for a board row (`Dark mode`), calls `ui.press({ key: 'new' })`, and asserts the drawn output
   - Pass: after the press, `ui.find` locates the New ticket form (a Text matching `New ticket` plus the Description input `new-idea` and a Create button such as `create-ai`), and the drawn output no longer contains the board rows (e.g. `Health endpoint`). The test exists for each surface and passes
   - Result: PASS
   - Evidence: Read tests/pane.test.tsx L883-: `+ New ticket opens the form; Back returns to the board` loops over terminal and desktop, boot(), finds 'Dark mode for settings page', ui.press({key:'new'}), ui.find Text /New ticket/, key new-idea, key create-ai, asserts drawn lacks 'Health endpoint' and the board row. Both surface tests pass. (Uses the 'Dark mode' row for the before check and also asserts Health endpoint absent after.)

3. Pane test: the form works and Back returns
   - Run: in the same suite, after opening the form press `ui.press({ key: 'back' })`; also press `create-plain` after `ui.input({ key: 'new-idea', text: 'Export button does nothing', kind: 'submit' })`
   - Pass: Back shows the board rows again; Create skeleton writes a new `tickets/0004-…/rd.md` into the fake fs and the pane shows that ticket. Both surfaces pass
   - Result: PASS
   - Evidence: Same loop: press back then finds board row and drawn lacks create-ai. Create test: ui.input new-idea submit, falls back to press create-plain if the submit did not already create (terminal's submit starts Create+AI; desktop only saves draft), asserts fs has tickets/0004-export-button-does-nothing/rd.md, BOARD.md contains 0004, pane finds 'Export button does nothing'. Both surfaces pass. The conditional create-plain is a small softening but create-plain is exercised on desktop and the skeleton assertion is not weakened.

4. Test fails without the fix
   - Run: in a scratch copy or with `git stash` of only the `hooks/` changes, run `claude plugin test .`
   - Pass: the new New-ticket test fails on the unfixed code (or the worker's notes in `rd.md`/commit explain why it cannot, e.g. cause was surface-specific), and passes with the fix
   - Result: PASS
   - Evidence: Not reproducible on 0.4.14 and rd.md '## Findings' explains why (report from 0.4.12, most likely 0013 duplicate-key drawing fix in 0.4.13; harness does not model a host that stops drawing). Independently verified: reverted the 0013 dedupe in hooks/store.ts loadAgents (scratch edit, restored after): 111 pass, 1 fail, the only failure being the existing 0013 test 'agents panel with resumed (duplicate-id) agents draws with unique keys'; all 11 new 0010 tests still pass. So the claim is accurate and the Pass clause 'notes explain why it cannot' applies. Caveat: bug is unreproduced, not proven fixed.

5. Other entry points still open the form
   - Run: pane test (or existing coverage) for `/board new <idea>` and, on an empty board, `+ Create the first ticket` (`new-empty`)
   - Pass: each lands on the form; `/board new foo` shows `foo` in the Description
   - Result: PASS
   - Evidence: Tests: `/board new <idea>` on both surfaces asserts new-idea found and drawn contains "value":"foo" and board row gone; `an empty desktop board: + Create the first ticket opens the form` presses new-empty and finds create-ai and 'What happens next'. All pass. Extra tests cover duplicate-agents and roadmap boards.

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each listed doc describes the behaviour as built (New ticket button and `n` key sections still accurate; Troubleshooting row added if the cause is user-visible); README.md is current, or rd.md says why it needs no change
   - Result: PASS
   - Evidence: rd.md Docs lists README.md; README unchanged (git diff shows only tests and rd.md), rd.md Findings states why (behaviour/keys/labels as documented; cause fixed in 0013 and not user-fixable). Version bump not required with no hooks change. Lines for button/n key in README remain accurate per rd.md.

## Not checked by automation

- A person presses **+ New ticket** in the real desktop app and in the terminal, with a mouse and with `n`, and sees the form open (tests use the in-memory pane, not the real app).

# Eval — 0010 — New ticket button does nothing

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` from the repo root
   - Pass: both exit 0; no test skipped or deleted compared with before the change
   - Result:
   - Evidence:

2. Pane test: pressing + New ticket opens the form (both surfaces)
   - Run: read `tests/pane.test.tsx`, then run `claude plugin test .`. The test boots the pane with `boot()` for `terminal` and `desktop`, waits for a board row (`Dark mode`), calls `ui.press({ key: 'new' })`, and asserts the drawn output
   - Pass: after the press, `ui.find` locates the New ticket form (a Text matching `New ticket` plus the Description input `new-idea` and a Create button such as `create-ai`), and the drawn output no longer contains the board rows (e.g. `Health endpoint`). The test exists for each surface and passes
   - Result:
   - Evidence:

3. Pane test: the form works and Back returns
   - Run: in the same suite, after opening the form press `ui.press({ key: 'back' })`; also press `create-plain` after `ui.input({ key: 'new-idea', text: 'Export button does nothing', kind: 'submit' })`
   - Pass: Back shows the board rows again; Create skeleton writes a new `tickets/0004-…/rd.md` into the fake fs and the pane shows that ticket. Both surfaces pass
   - Result:
   - Evidence:

4. Test fails without the fix
   - Run: in a scratch copy or with `git stash` of only the `hooks/` changes, run `claude plugin test .`
   - Pass: the new New-ticket test fails on the unfixed code (or the worker's notes in `rd.md`/commit explain why it cannot, e.g. cause was surface-specific), and passes with the fix
   - Result:
   - Evidence:

5. Other entry points still open the form
   - Run: pane test (or existing coverage) for `/board new <idea>` and, on an empty board, `+ Create the first ticket` (`new-empty`)
   - Pass: each lands on the form; `/board new foo` shows `foo` in the Description
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each listed doc describes the behaviour as built (New ticket button and `n` key sections still accurate; Troubleshooting row added if the cause is user-visible); README.md is current, or rd.md says why it needs no change
   - Result:
   - Evidence:

## Not checked by automation

- A person presses **+ New ticket** in the real desktop app and in the terminal, with a mouse and with `n`, and sees the form open (tests use the in-memory pane, not the real app).

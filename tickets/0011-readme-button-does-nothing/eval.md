# Eval — 0011 — README button does nothing

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates
   - Run: `claude plugin validate .` from the repo root
   - Pass: exit 0, no errors
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed' (checker run on f711a59); no errors.

2. Full test suite passes
   - Run: `claude plugin test .`
   - Pass: exit 0; unit tests and pane tests on both surfaces pass, with no test deleted or skipped to get there
   - Result: PASS
   - Evidence: `claude plugin test .`: 139 pass, 0 fail across 3 files. The branch's diff against main (3cb255d) removes no test, and no skip was added (only two non-test lines in tests/pane.test.tsx changed: the BootOptions type and the fs.list handler, for the new `gate` option).

3. Pane test presses the README button and asserts the result (both surfaces)
   - Run: read `tests/pane.test.tsx`, then `claude plugin test .`. There must be a test for each of `terminal` and `desktop`, in a project that has README.md, that presses the README button, waits for the README text, presses again (desktop: the **‹ Board** button; terminal: back) and waits for the board.
   - Pass: the test presses the button the way the host delivers it (for example by the `o` hotkey as well as by key, and a test that proves one press does not toggle twice), asserts the README text (e.g. "The storefront") appears and the board text ("Dark mode") is gone, and fails when the fix is reverted (the checker may stash the source change in `hooks/` to confirm)
   - Result: PASS
   - Evidence: tests/pane.test.tsx 'README (0011)' block, run on terminal and desktop, with README.md in the project: opens the README from board, ticket, questions and new-ticket view, asserts exactly one Button on hotkey `o` (key 'readme', label README, then '‹ Board'), asserts 'The storefront' appears and 'Dark mode' is gone, presses again and asserts the board returns, then repeats via the back button; a separate test shows one press stays switched after a redraw; another opens README while a refresh is held in flight. Revert check: `git checkout 3cb255d -- hooks` gives 134 pass, 5 fail (terminal: board, ticket, questions, new, no-README); hooks restored afterwards (worktree clean). Note: terminal back goes by the `readme` Button (`o` hotkey) and by `back`; presses are by key through the harness, as for all pane tests.

4. No-README case
   - Run: pane test on both surfaces without README.md
   - Pass: button reads **README (none)** on desktop; pressing opens a "No README" card (desktop) or "no README.md yet" (terminal)
   - Result: PASS
   - Evidence: Test 'no README.md: README (none) opens a No README card' passes on both surfaces: desktop asserts label 'README (none)' and the 'No README' card; terminal asserts 'no README.md yet'; second press returns to the board.

5. End-to-end in the real pane
   - Run: `claude --plugin-dir .` in a project with a README.md, run `/board`, click **README** in the project header, then click **‹ Board**; repeat with the `o` key; do this in the terminal and, if available, the Claude desktop app
   - Pass: each press switches the view once, visibly, with no need to press twice
   - Result: NOT RUN — needs a person
   - Evidence: A real `claude --plugin-dir .` session with clicks in the terminal or the desktop app cannot be driven by automation here (no interactive session or real mouse; the sandbox also denies api.anthropic.com). Not marked PASS. A person must run `/board` in a project with README.md, click README then ‹ Board, repeat with `o`, in the terminal and the desktop app, and confirm each press switches once. The pane harness tests above cover the draw path only.

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md "The pane, view by view" describes the project header and README view, and the keys table lists `o`; both match the built behaviour; no other doc is stale
   - Result: PASS
   - Evidence: README.md has new section 'Project header and README' (linked from the contents list) describing desktop PROJECT card, terminal project line with README button on board, Start, ticket, questions and new form, README view, ‹ Board, `o`, back, Ask Claude, README (none) / No README; keys table lists `o` and keeps `r` and `a` rows; Troubleshooting row added. Matches hooks/views.tsx (project line on all views, ‹ Board label). rd.md Docs lists only README.md. 0012 survived the merge: hooks/desk.tsx is identical to main (no diff), README Agents text (lines 98, 102, 147, 315) is present, and the branch's test diff touches no Agents tests.

## Not checked by automation

- The click in the real Claude desktop app, if the checker has no desktop access: a person confirms the button responds to a real mouse click.

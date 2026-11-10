# Eval — 0011 — README button does nothing

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates
   - Run: `claude plugin validate .` from the repo root
   - Pass: exit 0, no errors
   - Result:
   - Evidence:

2. Full test suite passes
   - Run: `claude plugin test .`
   - Pass: exit 0; unit tests and pane tests on both surfaces pass, with no test deleted or skipped to get there
   - Result:
   - Evidence:

3. Pane test presses the README button and asserts the result (both surfaces)
   - Run: read `tests/pane.test.tsx`, then `claude plugin test .`. There must be a test for each of `terminal` and `desktop`, in a project that has README.md, that presses the README button, waits for the README text, presses again (desktop: the **‹ Board** button; terminal: back) and waits for the board.
   - Pass: the test presses the button the way the host delivers it (for example by the `o` hotkey as well as by key, and a test that proves one press does not toggle twice), asserts the README text (e.g. "The storefront") appears and the board text ("Dark mode") is gone, and fails when the fix is reverted (the checker may stash the source change in `hooks/` to confirm)
   - Result:
   - Evidence:

4. No-README case
   - Run: pane test on both surfaces without README.md
   - Pass: button reads **README (none)** on desktop; pressing opens a "No README" card (desktop) or "no README.md yet" (terminal)
   - Result:
   - Evidence:

5. End-to-end in the real pane
   - Run: `claude --plugin-dir .` in a project with a README.md, run `/board`, click **README** in the project header, then click **‹ Board**; repeat with the `o` key; do this in the terminal and, if available, the Claude desktop app
   - Pass: each press switches the view once, visibly, with no need to press twice
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md "The pane, view by view" describes the project header and README view, and the keys table lists `o`; both match the built behaviour; no other doc is stale
   - Result:
   - Evidence:

## Not checked by automation

- The click in the real Claude desktop app, if the checker has no desktop access: a person confirms the button responds to a real mouse click.

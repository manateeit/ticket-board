# Eval — 0012 — Agents button does nothing

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates
   - Run: `claude plugin validate .` in the repository root
   - Pass: exit 0, no errors
   - Result:
   - Evidence:

2. Tests pass
   - Run: `claude plugin test .`
   - Pass: exit 0; unit and pane tests (terminal and desktop) all green
   - Result:
   - Evidence:

3. Pane test presses Agents and asserts the panel
   - Run: read `tests/pane.test.tsx`; the "agents button" test must press `ui.press({ key: 'agents' })` on both `terminal` and `desktop` surfaces from the board view, then `ui.find` the panel text (`AGENTS · 1 RUNNING` on desktop) and assert `worker-0002` appears; pressing again (or `agents-hide`) removes the panel. Then run `claude plugin test .`
   - Pass: the test exists for both surfaces, is new or extended by this ticket, and passes; it fails when the fix is reverted (worker states how it checked this in the commit message)
   - Result:
   - Evidence:

4. Regression test for the real cause
   - Run: read the new test(s) added for the root cause (for a layout cause: assert on `ui.drawn()` that the title-bar button row cannot be squeezed by the text beside it; for a state or worktree cause: boot with `/repo/.git` as a worktree pointer file and assert the Agents panel still opens)
   - Pass: a test exercises the found cause, not only the key press, and passes
   - Result:
   - Evidence:

5. Shared cause with 0010 and 0011 checked
   - Run: with the fix, run the existing "desktop header ... opens the README" test and a pane test pressing `new`; read the worker's note in rd.md on whether 0010 / 0011 share the cause
   - Pass: both buttons work after the fix if the cause is shared, or the note says plainly they are separate
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md (Agents paragraph L95, buttons and keys sections)
   - Pass: each describes the Agents button as built (label, key `a`, panel placement); README.md is current, or rd.md says why it needs no change; plugin.json version bumped if the convention applies
   - Result:
   - Evidence:

## Not checked by automation

- A real mouse click on **Agents** in the Claude desktop app lands and opens the panel (pane tests press by key and cannot see hit-testing or overlap). A human clicks it at a narrow and a wide pane width, also in a linked worktree session.

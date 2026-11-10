# Eval — 0013 — Pane does not draw when a resumed agent is listed twice

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin checks
   - Run: `claude plugin validate .` and `claude plugin test .` in the fix branch's worktree
   - Pass: validate passes; all tests pass, including the new regression test
   - Result: PASS
   - Evidence: validate: 'Validation passed'; plugin test: 37 pass, 0 fail, including 'agents panel with resumed (duplicate-id) agents draws with unique keys'.

2. Regression test proves the bug
   - Run: read the new test in tests/pane.test.tsx; revert only the `loadAgents` change (temporarily, in the worktree, not committed) and run `claude plugin test .`, then restore it
   - Pass: the test stubs `agent.list` with a duplicated id, opens the board and the Agents panel, and asserts unique keys; it FAILS without the fix (duplicate-key error) and PASSES with it
   - Result: PASS
   - Evidence: Test stubs agent.list with duplicate ids ('dup', 'g3'), opens board, presses agents panel and a row, collects drawn keys and asserts no duplicates. With hooks/store.ts reverted to 090086a: 36 pass, 1 fail (that test). With fix restored: git checkout done, git status clean, 37 pass.

3. Latest entry wins
   - Run: read the fix in hooks/store.ts `loadAgents`
   - Pass: one entry per id is kept, and it is the last one in the list (latest state); the redraw signature uses the deduped list
   - Result: PASS
   - Evidence: loadAgents filters listed by listed.findLastIndex(b => b.id === a.id) === i: keeps the last entry per id. sig is computed from next (the deduped list) and S.agents = next.

4. Scope
   - Run: `git diff --stat 090086a..HEAD` in the worktree
   - Pass: only hooks/store.ts and tests/pane.test.tsx changed
   - Result: PASS
   - Evidence: git diff --stat 090086a..HEAD: hooks/store.ts (4 lines) and tests/pane.test.tsx (36 lines) only; 2 files changed.

5. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md needs no change for this fix, as rd.md says
   - Result: PASS
   - Evidence: rd.md says README no change; the diff touches no user-facing behaviour or options; README is not stale.

## Not checked by automation

- The pane draws again in the real desktop app once the fix is installed (needs a release, or a new session as a stopgap).

# Eval — 0027 — Forced refresh waits for fresh data

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: validate: passed, exit 0. test: 356 pass, 0 fail; no test removed (diff only adds tests).

2. Forced refresh during a running refresh (fails before the fix)
   - Run: store test: start a slow refresh, change a ticket file, then `await refresh($, true)`
   - Pass: S.snap holds the changed file content
   - Result: PASS
   - Evidence: Pane test 'a forced refresh while a plain one runs...' (press refresh while gated plain refresh runs, rd.md changed meanwhile) shows 2 OPEN QUESTIONS. With main's hooks/store.ts it FAILS (restored afterwards). It drives the real refresh() through the pane's forced refresh key, so it does exercise the stated behaviour; a direct store import would bypass the fake fs.

3. Writer finish uses written files
   - Run: pane test: writer job writes rd.md/eval.md, a bg refresh is in flight, then turn.complete
   - Pass: the BOARD.md note and toast use the written files (no "missing Docs", correct question count)
   - Result: PASS
   - Evidence: Pane test 'a writer that finishes while a refresh runs...' gives note 'AI draft done · 2 open questions', no 'missing', same in toast. With main's store.ts it FAILS (restored afterwards).

4. Poll still coalesces
   - Run: store test: two non-forced refreshes at once
   - Pass: one disk pass
   - Result: PASS
   - Evidence: Pane test 'two plain refreshes at once read the disk once': one folder listing pass counted via fake fs calls. Passes (as expected on main too, so it guards the coalescing). Code: plain call returns the running promise.

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: rd.md Docs says README no change; README has no description of refresh internals; nothing stale. Code review: rejected read clears refreshRun via finally, queued forced run uses catch so it still runs; resetSession clears refreshRun and refreshNext; refresh is a plain function declaration; no local named h; no isRefreshing left.
## Not checked by automation

- none

# Eval — 0027 — Forced refresh waits for fresh data

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Forced refresh during a running refresh (fails before the fix)
   - Run: store test: start a slow refresh, change a ticket file, then `await refresh($, true)`
   - Pass: S.snap holds the changed file content

3. Writer finish uses written files
   - Run: pane test: writer job writes rd.md/eval.md, a bg refresh is in flight, then turn.complete
   - Pass: the BOARD.md note and toast use the written files (no "missing Docs", correct question count)

4. Poll still coalesces
   - Run: store test: two non-forced refreshes at once
   - Pass: one disk pass

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

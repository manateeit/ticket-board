# Eval — 0042 — Untracked writer spawns count and show

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Limit holds without ids (fails before the fix)
   - Run: pane test: spawn returns no agentId; create tickets for 5 builds
   - Pass: at most 3 writers start; the rest stay queued
   - Result:
   - Evidence:

3. Row shows untracked state
   - Run: same test
   - Pass: rows do not show "AI queued" for started writers; summary counts them
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

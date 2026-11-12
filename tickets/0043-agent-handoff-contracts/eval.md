# Eval — 0043 — Agent handoff contracts match the pipeline

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Commit owner is stated once
   - Run: read checker.md and merger.md
   - Pass: merger commits checker results before rebasing; checker leaves them uncommitted; no contradiction
   - Result:
   - Evidence:

3. No stale baseline
   - Run: `grep -n "35/35" .claude/agents/merger.md`
   - Pass: no matches; merger.md says to measure main at merge time
   - Result:
   - Evidence:

4. Dispatch time is recorded and read
   - Run: read router.md, watchdog.md (and templates/BOARD.md)
   - Pass: router writes a dispatch time in a defined place; watchdog reads the same place
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- A live router run that shows the merger committing checker results and the board showing dispatch times.

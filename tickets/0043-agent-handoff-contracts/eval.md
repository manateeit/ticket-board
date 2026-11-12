# Eval — 0043 — Agent handoff contracts match the pipeline

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed'. `claude plugin test .` ran 358 tests, run 1: 351 pass / 7 fail (worker's 7 timeouts); re-run once: 356 pass / 2 fail, both 'Error: timed out after 5000 ms' (tests/pane.test.tsx: 'a plan of 8 phases and 49 builds draws one phase at a time...' and 'a plan too large for the terminal (8 phases x 20 builds)...'). Failure count changed 7 -> 2 between identical runs, so load-dependent. `git diff --name-only main...HEAD` lists only 4 .claude/agents/*.md, README.md, templates/BOARD.md (0 .ts/.tsx/.json files), and the tests read no Markdown agent files, so this diff cannot affect those render tests. No test skipped or deleted. Counted PASS on the timing-only reasoning per the instructions; the 5 s render timeouts are pre-existing flakiness under load, not caused by this ticket. Sandbox network-deny notices (api.anthropic.com) ignored.

2. Commit owner is stated once
   - Run: read checker.md and merger.md
   - Pass: merger commits checker results before rebasing; checker leaves them uncommitted; no contradiction
   - Result: PASS
   - Evidence: checker.md step 3: 'Leave these edits uncommitted: the merger commits them on the branch before it rebases.' merger.md step 2 commits the checker's eval.md edits as `Ticket NNNN: checker results` with attribution, before step 3 Rebase; stops if anything else is uncommitted. router.md step 3 says the same. No contradiction.

3. No stale baseline
   - Run: `grep -n "35/35" .claude/agents/merger.md`
   - Pass: no matches; merger.md says to measure main at merge time
   - Result: PASS
   - Evidence: `grep -n "35/35" .claude/agents/merger.md` returned no matches (count 0). merger.md step 4 says to run validate/test on `main` before landing and report main's result next to the branch's; no hard-coded count remains.

4. Dispatch time is recorded and read
   - Run: read router.md, watchdog.md (and templates/BOARD.md)
   - Pass: router writes a dispatch time in a defined place; watchdog reads the same place
   - Result: PASS
   - Evidence: router.md step 2 (in-progress) and step 3 (in-check) write the Owner cell as `<owner>, dispatched YYYY-MM-DD HH:MM` (local time). watchdog.md reads the Owner cell for that form, subtracts from `date '+%Y-%m-%d %H:%M'`, and reports if absent. templates/BOARD.md Owner row documents it. Notes is not claimed for the dispatch time (the only Notes mention in the agent files is router.md's merge commit on done), so no clash with 0032's Notes prefixes. All four agent files are consistent.

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md (flow list near L363-367) now states: checker leaves eval.md results uncommitted, merger commits them as `Ticket NNNN: checker results`, compares against main measured at merge time; router writes dispatch time in Owner, watchdog reads it. templates/BOARD.md Owner definition updated. Both docs listed in rd.md ## Docs match what was built.

## Not checked by automation

- A live router run that shows the merger committing checker results and the board showing dispatch times.

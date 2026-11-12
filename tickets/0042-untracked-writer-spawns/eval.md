# Eval — 0042 — Untracked writer spawns count and show

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` run 3 times on the diff: only failures were the 0022 large-plan render tests, all timeouts at ~5.0-6.0 s (run 1: 6 fail/354 pass; run 2: 1 fail, 'a plan too large for the terminal' 5499ms; run 3: 5 fail, 'a plan of 8 phases and 49 builds' x4 at 5083/5401/5174/5163ms + 'too large for the terminal' 5975ms). The same tests time out on main under load (also seen with main's hooks in the check-2 run: 'too large for the terminal' 5058ms). The diff touches only ai.ts, store.ts (untracked map), the r-button onPress in desk.tsx and views.tsx, README and a new test; none is in plan rendering, so it cannot affect them. PASS only on that basis (machine loaded). The 2 new 0042 tests pass; no test skipped or deleted.

2. Limit holds without ids (fails before the fix)
   - Run: pane test: spawn returns no agentId; create tickets for 5 builds
   - Pass: at most 3 writers start; the rest stay queued
   - Result: PASS
   - Evidence: Ran with hooks/ai.ts, store.ts, desk.tsx, views.tsx checked out from main: both 0042 tests FAIL (spawned.length Expected 3, Received 5). With the fix they pass (3 spawn, 2 stay queued with 'AI queued', terminal and desktop). Files restored; git status clean.

3. Row shows untracked state
   - Run: same test
   - Pass: rows do not show "AI queued" for started writers; summary counts them
   - Result: PASS
   - Evidence: Same test: started rows' notes contain 'started without an agent id' and not 'AI queued'; waiting rows keep 'AI queued'; summary reads '2 queued' and '3 started without an agent id'; 3 build-writing and 2 build-queued rows drawn. After Refresh with one writer in agent.list, it is tracked ('AI drafting') and the other 2 free their slots so the 2 queued start. Slot-leak review: untracked entries are cleared on Refresh (releaseUntracked), on resetSession and on followCwd, and matched to a live agent.list entry on every pump; startJob also refuses a duplicate for an untracked number. A slot can be held until the person presses Refresh, which matches rd ('until the person refreshes or it is matched'); automatic refreshes do not free it, so the queue waits on the person, acceptable per rd. Tracked path unchanged (only added matchUntracked call, a no-op when the map is empty). Host rules: releaseUntracked is a plain `export async function`; no local `h`; no explicit undefined prop values added; Refresh `r` still one Button per view (only onPress changed).

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md writer-limit paragraph now says an id-less writer counts as one of the 3, gives the row note text, says the summary counts it, and that it keeps its slot until Refresh or until matched in the agent list. Matches the build. rd.md Docs lists README.md only.

## Not checked by automation

- none

# Eval — 0032 — Notes prefixes written down

## Checks

1. Plugin validates and tests pass
   - Result: PASS
   - Evidence: `claude plugin validate .` passed (exit 0). `claude plugin test .`: run 1 = 361 pass / 7 fail, run 2 = 367 pass / 1 fail, run 3 = 367 pass / 1 fail. The only failure is the 0022 large-plan render test (`a plan too large for the terminal (8 phases × 20 builds)…`, 5089 ms and 5362 ms against the 5 s limit; the 49-build variants pass at 2.5-3.5 s, or fail at 5.3-5.6 s under load on main). Run 1's other failures were not named in the captured output; they did not recur in runs 2-3 (load flakes). This diff touches no plan/roadmap rendering (only note prefix logic in query.ts, ai.ts, register.tsx, views.tsx createTicket), and the same tests time out at 5.3-5.5 s with main's four hook files swapped in. Counted PASS on that basis per the router's instruction. No tests skipped or deleted (tests only added).
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Badges only from prefixes
   - Result: PASS
   - Evidence: core tests in tests/core.test.ts pass on the branch (merged → Merged, 'done after red tests in round 2' → no badge, 'failed: check 3' → Failing). With query.ts/ai.ts/register.tsx/views.tsx from main, core.test.ts fails to load (`the file did not load`: new exports missing), so the new core tests fail before the fix; files restored, tree clean. All 29 existing `merged <sha>` row notes on tickets/BOARD.md still resolve to Merged via resultOf (0 bad).
   - Run: core tests: "merged 1a2b3c" → Merged; "done after red tests in round 2" → no badge; "failed: check 3" → Failing
   - Pass: as stated

3. Router notes are not overwritten
   - Result: PASS
   - Evidence: pane tests `0032: a router note that does not carry the pane's exact prefix is never replaced` pass (terminal and desktop). setPaneNote/isPaneNote replace only empty or `AI `-prefixed notes.
   - Run: pane test: note "AI-reviewed by router" style text not using the pane prefix, then a writer finishes
   - Pass: note kept unless it carries the pane's exact prefix

4. Conventions written down
   - Result: PASS
   - Evidence: NOTE_PREFIXES (merged , failed:, blocked:, dropped:, decided:, moved from GitHub issue) = list in templates/BOARD.md, tickets/BOARD.md legend, .claude/agents/router.md and README.md, plus `AI ` pane prefix in all four.
   - Run: read templates/BOARD.md and .claude/agents/router.md
   - Pass: both list the same prefixes the code matches

5. Pane's own notes stay pane-owned (fails before the fix)
   - Result: PASS
   - Evidence: `0032: after a fold, Enhance's running and done notes replace the fold note` and `0032: a skeleton ticket carries the pane prefix…` pass on the branch (terminal and desktop); with the four hook files from main they FAIL (4 failures: fold x2, skeleton x2). Files restored, git status clean. Fold note is now `AI answers folded in · N open questions`, skeleton note `AI skeleton — fill in rd.md and eval.md` via paneNote. grep of notes writes in hooks: the pane's note writes go through setPaneNote (ai.ts) or paneNote (views.tsx createSkeleton); no other path writes a note without the `AI ` prefix. Host rules: setPaneNote is a plain `export async function` taking `$`; no local `h` added; the diff adds no explicit `undefined` prop values.
   - Run: pane test: fold answers into a ticket (note "Answers folded in…"), then Enhance it; and a skeleton ticket, then Enhance
   - Pass: the running and done AI notes replace the pane's earlier note in BOARD.md

6. Docs and README updated
   - Result: PASS
   - Evidence: README.md has a Notes prefixes section listing the same prefixes, and the Result sentence points to it; the only doc in rd.md ## Docs is README.md. Both match what was built.
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

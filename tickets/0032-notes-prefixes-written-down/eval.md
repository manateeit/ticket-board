# Eval — 0032 — Notes prefixes written down

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Badges only from prefixes
   - Run: core tests: "merged 1a2b3c" → Merged; "done after red tests in round 2" → no badge; "failed: check 3" → Failing
   - Pass: as stated

3. Router notes are not overwritten
   - Run: pane test: note "AI-reviewed by router" style text not using the pane prefix, then a writer finishes
   - Pass: note kept unless it carries the pane's exact prefix

4. Conventions written down
   - Run: read templates/BOARD.md and .claude/agents/router.md
   - Pass: both list the same prefixes the code matches

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

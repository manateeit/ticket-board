# Eval — 0025 — Tickets folder setting works everywhere

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Run line follows the setting (fails before the fix)
   - Run: pane/core test with ticketsDir `work`: build the Run line for a ticket
   - Pass: it names `work/BOARD.md` and not `tickets/BOARD.md`; with the default it equals today's text

3. Briefs follow the setting
   - Run: pane test with ticketsDir `work`: start a writer, a planner replan and an adopt; inspect the spawn prompts
   - Pass: each names `work/` paths only

4. No literal board path left in agent text
   - Run: `grep -rn "tickets/BOARD.md" skills agents .claude/agents templates hooks`
   - Pass: every remaining match is phrased as the default, not as the only path

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- A live router run in a project with a non-default ticketsDir.

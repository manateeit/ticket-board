# Eval — 0035 — Tickets folder setting: remaining paths

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Prompts carry the board path (fails before the fix)
   - Run: pane tests with ticketsDir `work`: Write it in chat, ticket Brainstorm, Start-screen design/plan prompts
   - Pass: each filled prompt names `work/BOARD.md`; with the default each equals today's text
   - Result:
   - Evidence:

3. Nested tickets folder is not code
   - Run: core test: hasCode(['planning','README.md'], 'planning/tickets') and a bound `spec/DESIGN.md`
   - Pass: false
   - Result:
   - Evidence:

4. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

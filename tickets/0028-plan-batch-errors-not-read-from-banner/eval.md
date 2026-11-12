# Eval — 0028 — Plan batch errors not read from the banner

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Stale error banner does not block the summary (fails before the fix)
   - Run: pane test: set an error banner, then create tickets for 2 builds successfully
   - Pass: "Created 2 draft tickets" summary shown; old error gone

3. Partial failure still reported
   - Run: pane test: one of two builds fails to start
   - Pass: an error is shown and the count of created tickets is correct

4. No banner read for control flow
   - Run: `grep -n "message?.tone" hooks/ai.ts`
   - Pass: no matches used to decide batch results

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

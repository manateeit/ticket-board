# Eval — 0028 — Plan batch errors not read from the banner

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed' (exit 0). `claude plugin test .`: 333 pass, 0 fail across 3 files; the commit only adds tests (no skip/delete).

2. Stale error banner does not block the summary (fails before the fix)
   - Run: pane test: set an error banner, then create tickets for 2 builds successfully
   - Pass: "Created 2 draft tickets" summary shown; old error gone
   - Result: PASS
   - Evidence: new test 'an old error banner does not hide the batch summary' (terminal + desktop) passes: the error banner is set, the batch then shows 'Created 2 draft tickets from P1' and the old error is gone. With hooks/ai.ts restored from 400b67d both variants FAIL (331 pass, 2 fail); the file was restored afterwards and the tree is clean.

3. Partial failure still reported
   - Run: pane test: one of two builds fails to start
   - Pass: an error is shown and the count of created tickets is correct
   - Result: PASS
   - Evidence: test 'one of two builds fails to start' (both surfaces) passes: shows 'Created 2 draft tickets', '1 failed to start' and 'failed: no agents left today', with 2 draft rows.

4. No banner read for control flow
   - Run: `grep -n "message?.tone" hooks/ai.ts`
   - Pass: no matches used to decide batch results
   - Result: PASS
   - Evidence: `grep -n "message?.tone" hooks/ai.ts` returns no matches.

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: rd.md says README needs no change (wording unchanged); README's plan-creation section (L273-286) still matches the unchanged banner wording.
## Not checked by automation

- none

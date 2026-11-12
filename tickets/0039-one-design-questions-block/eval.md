# Eval — 0039 — One rule for where a design section's questions end

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Later subsection is not questions (fails before the fix)
   - Run: core test: D section with `### Open questions` (1 bullet) then `### Notes` (2 bullets)
   - Pass: one open question
   - Result:
   - Evidence:

3. Answering works
   - Run: pane test: answer that question from the Design tab
   - Pass: answer written; no "That question changed" error
   - Result:
   - Evidence:

4. One parser
   - Run: read designfile.ts and roadmap.ts
   - Pass: no second copy of the D heading regex or questions-block scan
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

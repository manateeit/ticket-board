# Eval — 0000 — <Title>

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. <Check name>
   - Run: `<command, URL, or steps>`
   - Pass: <objective pass condition>
   - Result: <PASS/FAIL — checker fills in>
   - Evidence: <output summary / screenshot path — checker fills in>

2. End-to-end behaviour check
   - Run: <exercise the new behaviour the way a user would; browser for UI>
   - Pass: <what the user would see>
   - Result:
   - Evidence:

3. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each listed doc describes the new behaviour as built (commands, options,
     screenshots or examples still work); README.md is current, or rd.md says why
     it needs no change
   - Result:
   - Evidence:

## Not checked by automation

- <Anything a human still has to eyeball, or "none">

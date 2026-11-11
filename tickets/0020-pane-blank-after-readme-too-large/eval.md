# Eval — 0020 — Pane goes blank: README view too large for the host

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. README in parts under the limit
   - Run: pane test with a README of this repo's size (≥60 KB) on desktop in several schemes
   - Pass: every part's serialized drawing is under 100,000 characters; every section is reachable via Next; Previous works; no line lost; code blocks not split
   - Result:
   - Evidence:

3. Size guard
   - Run: pane test with an oversized view (e.g. a huge ticket rd.md) on desktop and terminal
   - Pass: a notice under the limit with a working way back; never an over-limit tree
   - Result:
   - Evidence:

4. Defensive store loading
   - Run: boot with bad saved filters and bad jobs
   - Pass: the board draws with defaults; without the fix it does not
   - Result:
   - Evidence:

5. Tests fail without the fix
   - Run: restore hooks/ from f16300b, run the new tests, restore
   - Pass: the new tests fail before and pass after
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read README.md
   - Pass: README view parts and the troubleshooting row described as built
   - Result:
   - Evidence:

## Not checked by automation

- The real desktop host's unmount on an over-limit tree (inferred from the host types and the desktop log); a person opens README with `o` and pages through it, and the board stays drawn.

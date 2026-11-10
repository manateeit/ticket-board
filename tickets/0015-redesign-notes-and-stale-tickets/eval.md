# Eval — 0015 — Redesign notes and stale tickets

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Stale detection
   - Run: core test with a ticket saying `Design: D3@1` and a design whose D3 is `Rev: 2`; and one saying `D3@2`
   - Pass: the first is flagged stale and counted in the alerts; the second is not
   - Result:
   - Evidence:

3. Stale chip and Review
   - Run: pane test (both surfaces) on that fixture: board row, ticket page, press Review
   - Pass: the chip reads "Written against D3 rev 1, now rev 2 — Review"; Review opens the ticket page; no job is started and nothing is written
   - Result:
   - Evidence:

4. Done tickets untouched; bad input
   - Run: test with a stale `done` ticket, and tickets with a malformed `Design:` line or an unknown section
   - Pass: the done ticket's files and board row are byte-identical before and after; malformed input gives no flag and no error
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README describes the stale chip, Review and the alert; STANDARD.md's change-note format matches the code
   - Result:
   - Evidence:

## Not checked by automation

- A real redesign through the design skill producing a change note the pane reads correctly.

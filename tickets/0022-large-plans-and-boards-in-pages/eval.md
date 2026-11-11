# Eval — 0022 — Large plans and boards shown in pages

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Large plan draws
   - Run: pane tests with an 8-phase, 49-build plan: Plan list and timeline, desktop (every Colors × app mode) and terminal
   - Pass: no "too large" notice; serialized drawing under 95,000 characters; every phase reachable through the switcher; the current phase is shown first; choice remembered
   - Result:
   - Evidence:

3. Large board draws
   - Run: pane tests with 120 tickets, done shown and hidden, with a filter and a sort
   - Pass: no "too large" notice; under the limit; every row reachable via paging; filters/sort apply before paging; changing a filter returns to page 1
   - Result:
   - Evidence:

4. Small projects unchanged
   - Run: existing tests and a small-plan / small-board drawing compared with main
   - Pass: no switcher or pager on small projects; drawings unchanged
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md
   - Pass: phase switcher, board paging and the troubleshooting row described as built
   - Result:
   - Evidence:

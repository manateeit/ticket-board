# Eval — 0038 — Replan Apply only applies what was ticked, for the design it was made for

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Stale design version is refused (fails before the fix)
   - Run: pane test: open review on a v2 proposal, bump DESIGN.md to v3, press Apply
   - Pass: refusal message; PLAN.md unchanged
   - Result:
   - Evidence:

3. Proposal version is stamped
   - Run: pane/core test: apply a current proposal
   - Pass: PLAN.md design-version equals the proposal's
   - Result:
   - Evidence:

4. Ticks clear when the proposal changes (fails before the fix)
   - Run: pane test: tick items 1 and 3, rewrite the same-day proposal file with different items, refresh
   - Pass: no items ticked; Apply needs new ticks
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result:
   - Evidence:

## Not checked by automation

- none

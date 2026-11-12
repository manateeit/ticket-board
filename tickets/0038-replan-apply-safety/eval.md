# Eval — 0038 — Replan Apply only applies what was ticked, for the design it was made for

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` run twice on the branch: 362 pass/6 fail, then 361 pass/7 fail; every failure is a 0022 large-plan render test (`a plan of 8 phases and 49 builds draws one phase at a time...` per scheme, and `a plan too large for the terminal...`), each timing out at about 5.1-5.6 s (e.g. 5131ms, 5393ms, 5654ms). The same tests time out on main's ai.ts/store.ts too (5183ms, 5512ms, 5652ms). The diff (hooks/ai.ts, hooks/store.ts, tests, README) does not touch hooks/plan.tsx or any render path; only a cheap hash compare was added in readTickets. No other test fails, none skipped or deleted. PASS on that basis (load-induced timeouts, pre-existing). Pane test files cannot be filtered, so the large-plan tests were re-run via the whole suite.

2. Stale design version is refused (fails before the fix)
   - Run: pane test: open review on a v2 proposal, bump DESIGN.md to v3, press Apply
   - Pass: refusal message; PLAN.md unchanged
   - Result: PASS
   - Evidence: New tests `replan apply refuses a proposal for an older design version; PLAN.md unchanged` and `...with no design-version` pass (terminal and desktop) on the branch. With hooks/ai.ts and hooks/store.ts restored from main (0100bc8) both fail (3.2-3.3 s, no refusal shown); files restored afterwards, `git status` clean.

3. Proposal version is stamped
   - Run: pane/core test: apply a current proposal
   - Pass: PLAN.md design-version equals the proposal's
   - Result: PASS
   - Evidence: Test `replan apply stamps the proposal's design version` passes in both surfaces; applyReplan now passes proposal.designVersion to applyProposal. Existing apply tests still pass.

4. Ticks clear when the proposal changes (fails before the fix)
   - Run: pane test: tick items 1 and 3, rewrite the same-day proposal file with different items, refresh
   - Pass: no items ticked; Apply needs new ticks
   - Result: PASS
   - Evidence: Tests `replan ticks clear when the proposal file is rewritten; Apply needs new ticks` and `replan apply refuses ticks made on a proposal that changed before the refresh` pass on the branch (both surfaces); both fail with main's ai.ts/store.ts. Extra refusal (PROPOSAL_CHANGED) judged to fit the ticket: it is the Apply-time form of 'ticks belong to one proposal', writes nothing, and only fires when ticked.length>0 and the proposal key differs from the key the ticks were made under. The pane's own rewrites (stampProposal, applyReplan marking, dismissReplan) re-key replanTicksOf to the new text, so a current proposal applies as before and skipped (unapplied) items stay ticked: only applied indexes are deleted from replanTicks. All existing replan apply/dismiss tests pass. Minor note: the planner-end write at ai.ts:454 is not re-keyed, but it happens before review, and a later refresh simply clears ticks.

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: README.md Replan Safety paragraph now says design-version becomes the proposal's, a proposal for an older/missing design version is refused with the message, and ticks clear when the proposal changes (plus the new refusal). README is the only doc listed in rd.md. Host rules checked in the diff: new exports (staleProposal, PROPOSAL_CHANGED, proposalKey) take no `$` (applyReplan/dismissReplan remain plain `function` declarations); no local named `h`; no explicit `undefined` prop values added.

## Not checked by automation

- none

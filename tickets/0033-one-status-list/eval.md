# Eval — 0033 — One status list for glass and roadmap

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` exit 0 on a quiet rerun: 411 pass, 0 fail, none skipped or deleted. Two earlier runs (one on the branch, one during the revert experiment) each showed a single failure, 'a plan too large for the terminal (8 phases x 20 builds)', with 'timed out after 5000 ms' while machine load average was 14-34 (other agents running). It passed on the quiet rerun and is unrelated to this ticket (plan paging), so treated as a load flake. Worth a look as a timing-sensitive test, not a ticket failure.

2. Prototype words do not crash (fails before the fix)
   - Run: pane test: a README / rd.md with inline `toString`, `constructor` and `unlisted`, desktop glass view
   - Pass: drawing succeeds; the words render as plain code, no status pill
   - Result: PASS
   - Evidence: New pane test 'ticket page: inline prototype words and unlisted render as plain code, statuses as pills (0033, desktop)' in tests/pane.test.tsx passes: toString, constructor, valueOf, hasOwnProperty, unlisted each drawn as mono Text, no throw. With hooks/glass.tsx, desk.tsx, views.tsx, core/roadmap.ts restored from 9f6862e the same test FAILS (AssertionError, expected > 0, received 0: the drawing breaks). Files restored to the branch tip afterwards; git status clean.

3. Real statuses still render as pills
   - Run: pane test with inline `ready` and `in-check`
   - Pass: status pills shown as today
   - Result: PASS
   - Evidence: Same pane test asserts inline `ready` and `in-check` are drawn with weight semibold and not mono (pill), passing. glass.tsx markdown() keeps tint(hex, G.chip) pill styling unchanged; other STATUS_HEX readers (hexOf, heroSvg, barSvg, board cards) only swap to statusHexOf with the same fallback, so pill colours are unchanged.

4. roadmap uses STATUSES
   - Run: `grep -n "'in-progress', *'in-check'" hooks/core/roadmap.ts` and a core test of buildState for every status in STATUSES
   - Pass: no hard-coded list; every status maps to a build state as today
   - Result: PASS
   - Evidence: grep "'in-progress', *'in-check'" hooks/core/roadmap.ts: no match. roadmap.ts now has STATUS_BUILD: Record<Status, {state, rank, isReadyOrLater}> and READY_OR_LATER built from STATUSES. Read the types: Status = (typeof STATUSES)[number], so a Record<Status,...> literal missing a new status fails with 'property is missing' (and an unknown key fails excess-property check); STATUS_BUILD[s] is only indexed by Status after the isStatus guard. (tsc not runnable here, no network for npx; verified by reading.) Core test 'roadmap: every status in STATUSES maps to its build state; unknown words are ignored (0033)' passes: all six map as before (draft shaping, ready queued, in-progress/in-check building, done built, blocked stuck), precedence kept, toString/constructor/unlisted ignored. All non-literal STATUS_HEX reads: grep of hooks/ shows the only one is inside statusHexOf (guarded by Object.hasOwn); desk hexOf, views board cards, glass heroSvg/barSvg and markdown all go through statusHexOf; every other read is a literal key. Host rules: statusHexOf is a const taking no $; no function taking $ was added or changed to arrow; no local named h; no explicit undefined prop values (undefined appears only as a return/ternary value).

5. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no change
   - Result: PASS
   - Evidence: rd.md Docs: README.md no change (only documents no longer crash). Read README: nothing describes status-word handling, so it is not stale. No other docs listed.

## Not checked by automation

- none

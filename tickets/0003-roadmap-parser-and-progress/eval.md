# Eval — 0003 — Roadmap parser and progress computation

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin tests pass
   - Run: `claude plugin test .` from `/Users/thalixdeveloper/development/ticket-board`
   - Pass: exit 0; the new roadmap tests are listed and pass; existing core and pane tests still pass
   - Result: PASS
   - Evidence: claude plugin test . exit 0: 53 pass, 0 fail across 3 files; 16 roadmap tests listed and passing, core and pane tests still pass.

2. Plugin validates
   - Run: `claude plugin validate .`
   - Pass: exit 0, no errors (tsc is not installed; do not require it)
   - Result: PASS
   - Evidence: claude plugin validate . -> Validation passed (only sandbox network notices).

3. Blank project
   - Run: read the blank-project test; empty board, no design, no plan
   - Pass: parse functions, `progress`, `coverage` and `checks` return empty/zero results, Plan % is 0 with nothing counted, no check fires, nothing throws
   - Result: PASS
   - Evidence: Read 'blank project' test: bindFromBoard blank, parseDesign/parsePlan empty, progress planPct 0 countedWeight 0, coverage/hill/checks empty, roadmap(undefined,undefined,[]) no checks; passes.

4. Full fixture: states, weights, percentages
   - Run: read the full-fixture test
   - Pass: asserts every build state (not started, shaping, queued, building, built, stuck), a `deferred` and a `dropped` build excluded from totals, S/M/L/unsized weights 1/3/8/3, an exact Plan % and phase %, the current phase, and next up
   - Result: PASS
   - Evidence: Read full-fixture tests: states not-started/shaping/queued/building/built/stuck plus deferred and dropped excluded; weights S1/M3/L8/unsized3 (P2 = 19); planPct 19, phase pct 100/5/0, currentPhase P2, nextUp P2.1; stuck/mixed/all-done cases. Code (buildState, progress) matches rd.

5. Full fixture: coverage, stale, hill, checks
   - Run: read the same test file
   - Pass: asserts unplanned/planned/building/built sections, `D3@1` against `Rev: 2` giving stale, Design %, hill position uphill / over the top / downhill, and each of the eight checks firing once on a crafted case and not firing on a clean one
   - Result: PASS
   - Evidence: Read tests: coverage unplanned/planned/building/built plus D3@1 vs Rev 2 stale, designPct 33, hill uphill 33 / top 50 / downhill 100 and 75; 'each check fires once' test covers all eight checks plus plan-mismatch, and a clean case gives none.

6. Factory plan shape
   - Run: read the test that holds a copy of `/Users/thalixdeveloper/development/thalix-sdlc-factory/design/factory/plan.md` shape (F-ids, no phases, no Covers/Ticket columns, a non-build self-hosting row)
   - Pass: parses to one implicit phase with all builds, `Needs` read correctly, non-build row not counted, no exception
   - Result: PASS
   - Evidence: Read factory-shape test: one implicit phase, F1..F15, Needs read (F4 needs F2,F3; dash = none), self-hosting row kept as marker and not counted (weight 68), no warnings, no throw.

7. Ticket lines and board binding
   - Run: read the tests for `Plan:` / `Design:` and `bindFromBoard`
   - Pass: `Plan: P1.3`, `Design: D1@2, D3@1`, a bare `D1`, and a missing line are read correctly; the BOARD.md `Design: … · Plan: …` line, lower-case file names, the default `design/` lookup and the blank case all resolve
   - Result: PASS
   - Evidence: Read tests: Plan: P1.3, Design: D1@2, D3@1, bare D1 (no rev), missing line -> undefined; bindFromBoard: binding line, backticks, lower-case file names, default design/ lookup, blank, throwing reader. Also ran bindFromBoard+roadmap on this repo's real design/DESIGN.md, PLAN.md, tickets/BOARD.md: bound, 8 sections, 4 phases/9 builds parsed, no warnings, sensible states/percentages.

8. Purity
   - Run: search `hooks/core/roadmap.ts` for `node:fs`, `fetch`, `process.`, imports from `../store` or `../ai`
   - Pass: none found; only `bindFromBoard` receives a reader callback
   - Result: PASS
   - Evidence: grep of hooks/core/roadmap.ts for node:fs, fetch, process., ../store, ../ai: none. Imports only ./board and ./ticket; only bindFromBoard takes readFile.

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README Development layout and test paragraph describe `hooks/core/roadmap.ts` and its tests; no generated graft file was hand-edited; rd.md's note on PLAN-design-plan.md is honoured
   - Result: PASS
   - Evidence: README Development layout line and test paragraph describe roadmap.ts and tests/roadmap.test.ts; no graft files in the diff; PLAN-design-plan.md has an 'As built' note for the deliberate differences (cell counts as on-plan, ninth check plan-mismatch), honouring rd.md.

## Not checked by automation

- Whether the hill-position rule (uphill, over the top, downhill) reads sensibly on a real project; a person judges it once 0007 draws it.

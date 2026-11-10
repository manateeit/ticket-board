# Eval — 0003 — Roadmap parser and progress computation

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin tests pass
   - Run: `claude plugin test .` from `/Users/thalixdeveloper/development/ticket-board`
   - Pass: exit 0; the new roadmap tests are listed and pass; existing core and pane tests still pass
   - Result:
   - Evidence:

2. Plugin validates
   - Run: `claude plugin validate .`
   - Pass: exit 0, no errors (tsc is not installed; do not require it)
   - Result:
   - Evidence:

3. Blank project
   - Run: read the blank-project test; empty board, no design, no plan
   - Pass: parse functions, `progress`, `coverage` and `checks` return empty/zero results, Plan % is 0 with nothing counted, no check fires, nothing throws
   - Result:
   - Evidence:

4. Full fixture: states, weights, percentages
   - Run: read the full-fixture test
   - Pass: asserts every build state (not started, shaping, queued, building, built, stuck), a `deferred` and a `dropped` build excluded from totals, S/M/L/unsized weights 1/3/8/3, an exact Plan % and phase %, the current phase, and next up
   - Result:
   - Evidence:

5. Full fixture: coverage, stale, hill, checks
   - Run: read the same test file
   - Pass: asserts unplanned/planned/building/built sections, `D3@1` against `Rev: 2` giving stale, Design %, hill position uphill / over the top / downhill, and each of the eight checks firing once on a crafted case and not firing on a clean one
   - Result:
   - Evidence:

6. Factory plan shape
   - Run: read the test that holds a copy of `/Users/thalixdeveloper/development/thalix-sdlc-factory/design/factory/plan.md` shape (F-ids, no phases, no Covers/Ticket columns, a non-build self-hosting row)
   - Pass: parses to one implicit phase with all builds, `Needs` read correctly, non-build row not counted, no exception
   - Result:
   - Evidence:

7. Ticket lines and board binding
   - Run: read the tests for `Plan:` / `Design:` and `bindFromBoard`
   - Pass: `Plan: P1.3`, `Design: D1@2, D3@1`, a bare `D1`, and a missing line are read correctly; the BOARD.md `Design: … · Plan: …` line, lower-case file names, the default `design/` lookup and the blank case all resolve
   - Result:
   - Evidence:

8. Purity
   - Run: search `hooks/core/roadmap.ts` for `node:fs`, `fetch`, `process.`, imports from `../store` or `../ai`
   - Pass: none found; only `bindFromBoard` receives a reader callback
   - Result:
   - Evidence:

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README Development layout and test paragraph describe `hooks/core/roadmap.ts` and its tests; no generated graft file was hand-edited; rd.md's note on PLAN-design-plan.md is honoured
   - Result:
   - Evidence:

## Not checked by automation

- Whether the hill-position rule (uphill, over the top, downhill) reads sensibly on a real project; a person judges it once 0007 draws it.

# Eval — 0009 — Adopt existing docs, demo roadmap and 0.5.0 release

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not use it)
   - Pass: both exit 0; no failing test in core or pane suites (terminal and desktop)
   - Result:
   - Evidence:

2. Version is 0.5.0
   - Run: read `.claude-plugin/plugin.json`; grep the repo (excluding `tickets/` and `graft/`) for `0.4.12`
   - Pass: `"version": "0.5.0"`; no leftover `0.4.12`
   - Result:
   - Evidence:

3. Demo roadmap parses and is populated
   - Run: the new test in `tests/core.test.ts` that parses `examples/demo-roadmap`; then read the folder
   - Pass: test passes; DESIGN.md, PLAN.md (3+ phases, Covers and Ticket cells), `design/changes/` note and `tickets/BOARD.md` with the binding line exist; progress shows a Plan % between 0 and 100, a current phase, and at least two alerts (stale ticket, build with no ticket); one off-plan ticket is counted
   - Result:
   - Evidence:

4. Demo roadmap opens in the pane
   - Run: pane test (or `cp -R examples/demo-roadmap /tmp/demo-roadmap && cd /tmp/demo-roadmap && claude --plugin-dir <repo>`, then `/board`)
   - Pass: board shows the Plan % tile and the Roadmap card with phase rail and alerts; Plan and Design views open from it; no parse error is shown
   - Result:
   - Evidence:

5. Adopt flow end to end
   - Run: pane test on an in-memory project with no design, no plan, one existing notes file: press "I already have docs…", enter the path, let the stubbed agent return a proposal, review, untick one item, press Apply selected
   - Pass: before Apply, DESIGN.md, PLAN.md and BOARD.md are unchanged; after Apply, DESIGN.md (`status: draft`, `version: 1`), PLAN.md and the binding line exist and the unticked item is absent; the source file is byte-identical; `design/changes/<date>-adopt.md` exists; the coverage checks run and the Start stepper advances
   - Result:
   - Evidence:

6. Adopt flow error cases
   - Run: pane tests: empty input, path outside the project, missing path, and a project that already has DESIGN.md
   - Pass: each shows an error or a "pick another name or cancel" prompt; no agent starts for the first three; the existing DESIGN.md is never overwritten
   - Result:
   - Evidence:

7. Terminal layout of the adopt flow
   - Run: terminal-surface pane test of the same flow as check 5
   - Pass: numbered list and plain-text review work and Apply writes the same files
   - Result:
   - Evidence:

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README has Start screen, Design/Plan view, adopt and demo-roadmap sections, an updated Contents list, Quick start, keys table and Development layout; docs/STANDARD.md covers adopted documents; every command and path in them exists
   - Result:
   - Evidence:

## Not checked by automation

- Quality of the AI's conversion on real, messy documents (a person should adopt one real project and read the proposal).
- Whether the demo roadmap looks right visually in the desktop app.
- Publishing: whether the GitHub push happens depends on the open question in rd.md; the checker does not push.

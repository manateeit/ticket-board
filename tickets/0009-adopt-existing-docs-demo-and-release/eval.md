# Eval — 0009 — Adopt existing docs, demo roadmap and 0.5.0 release

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not use it)
   - Pass: both exit 0; no failing test in core or pane suites (terminal and desktop)
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` exit 0: 291 pass, 0 fail, 3 files (core, roadmap, pane in terminal and desktop). Only sandbox network-deny notices, not failures.

2. Version is 0.5.0
   - Run: read `.claude-plugin/plugin.json`; grep the repo (excluding `tickets/` and `graft/`) for `0.4.12`
   - Pass: `"version": "0.5.0"`; no leftover `0.4.12`
   - Result: PASS
   - Evidence: plugin.json has `"version": "0.5.0"`; grep -rn for `0.4.12` outside tickets/ and graft/ finds nothing.

3. Demo roadmap parses and is populated
   - Run: the new test in `tests/core.test.ts` that parses `examples/demo-roadmap`; then read the folder
   - Pass: test passes; DESIGN.md, PLAN.md (3+ phases, Covers and Ticket cells), `design/changes/` note and `tickets/BOARD.md` with the binding line exist; progress shows a Plan % between 0 and 100, a current phase, and at least two alerts (stale ticket, build with no ticket); one off-plan ticket is counted
   - Result: PASS
   - Evidence: Core tests 'demo roadmap: everything parses with no warnings beyond the intended alerts' and 'Plan % between 0 and 100...' pass. Folder read: 17 files; DESIGN.md (D1-D6, D3 stale at rev 2, D5 dropped), PLAN.md (P1-P3, S/M/L, Covers and Ticket cells), design/changes/2026-11-02-design-v2.md, tickets/BOARD.md with `Design: design/DESIGN.md · Plan: design/PLAN.md`, 6 tickets in 5 statuses. Test asserts current phase P2, alerts exactly stale-tickets (0003), build-no-ticket (P3.2), off-plan (0006), 0 parse warnings. Byte-compare of tests/demo-roadmap.ts against examples/demo-roadmap: 17 files, 0 diffs.

4. Demo roadmap opens in the pane
   - Run: pane test (or `cp -R examples/demo-roadmap /tmp/demo-roadmap && cd /tmp/demo-roadmap && claude --plugin-dir <repo>`, then `/board`)
   - Pass: board shows the Plan % tile and the Roadmap card with phase rail and alerts; Plan and Design views open from it; no parse error is shown
   - Result: PASS
   - Evidence: Pane tests 'demo roadmap opens with a Plan % tile, the Roadmap card, a current phase and its alerts' pass on terminal and desktop: Plan % tile, ROADMAP card, phase rail, 'Now: P2', stale/no-ticket/off-plan alerts, no parse-error strings; tab-plan and tab-design open Plan (phase-toggle-P3) and Design (sec-D6).

5. Adopt flow end to end
   - Run: pane test on an in-memory project with no design, no plan, one existing notes file: press "I already have docs…", enter the path, let the stubbed agent return a proposal, review, untick one item, press Apply selected
   - Pass: before Apply, DESIGN.md, PLAN.md and BOARD.md are unchanged; after Apply, DESIGN.md (`status: draft`, `version: 1`), PLAN.md and the binding line exist and the unticked item is absent; the source file is byte-identical; `design/changes/<date>-adopt.md` exists; the coverage checks run and the Start stepper advances
   - Result: PASS
   - Evidence: Pane test 'adopt end to end' passes on desktop: 1 agent spawned; before Apply no DESIGN.md, PLAN.md or BOARD.md and zero writes; untick D2 -> Apply selected (7); DESIGN.md has status: draft and version: 1, no D2; PLAN.md, binding line, proposal in design/changes/<date>-adopt.md (marked applied:); source NOTES_PATH byte-identical and never written; checks line shown; Back to Start shows stepper at Tickets. Write guard also tested: Write to DESIGN.md, PLAN.md, BOARD.md, source file and notes denied for the adopt agent.

6. Adopt flow error cases
   - Run: pane tests: empty input, path outside the project, missing path, and a project that already has DESIGN.md
   - Pass: each shows an error or a "pick another name or cancel" prompt; no agent starts for the first three; the existing DESIGN.md is never overwritten
   - Result: PASS
   - Evidence: Pane test 'adopt errors' passes on both surfaces: empty input, /etc/passwd and ../elsewhere/notes.md (outside the project), missing notes/nope.md each show an error, w.spawned empty, writes empty. 'adopt never overwrites' test: existing DESIGN.md gets 'already exists: pick another name or cancel', stays byte-identical through Cancel and through Apply with another name (DESIGN-salon.md). Code review of applyAdopt: both DESIGN and PLAN targets are checked with fs.exists before any write.

7. Terminal layout of the adopt flow
   - Run: terminal-surface pane test of the same flow as check 5
   - Pass: numbered list and plain-text review work and Apply writes the same files
   - Result: PASS
   - Evidence: The same three adopt pane tests pass on the terminal surface: numbered review ('2. [x] D2 · Salon page'), '[x]/[ ]' markers, Apply writes the same files (DESIGN.md, PLAN.md, proposal, BOARD.md binding line).

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README has Start screen, Design/Plan view, adopt and demo-roadmap sections, an updated Contents list, Quick start, keys table and Development layout; docs/STANDARD.md covers adopted documents; every command and path in them exists
   - Result: PASS
   - Evidence: README has Start screen, Plan and Design views, Roadmap, 'Adopting existing docs' (line 313) sections, Contents list item 9, Quick start demo-roadmap line (91), keys table `h` (416), How it edits your files (452), Troubleshooting rows, Development layout with hooks/adopt.tsx and examples/demo-roadmap/. docs/STANDARD.md section 9 'Adopting existing documents'. agents/planner.md has adopt mode. Paths in the Development layout exist (checked). Version strings updated (0.5.0; 'A version before 0.4.13').

## Not checked by automation

- Quality of the AI's conversion on real, messy documents (a person should adopt one real project and read the proposal).
- Whether the demo roadmap looks right visually in the desktop app.
- Publishing: whether the GitHub push happens depends on the open question in rd.md; the checker does not push.

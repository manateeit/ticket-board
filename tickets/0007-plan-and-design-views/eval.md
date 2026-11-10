# Eval — 0007 — Plan and Design views

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not use it)
   - Pass: both exit 0, no failing tests
   - Result: PASS
   - Evidence: claude plugin validate . exit 0, 'Validation passed', no warnings. claude plugin test . : 179 pass, 0 fail (main: 151). Sandbox network-deny notices only.

2. Navigation Board → Plan → ticket → Design and back
   - Run: new test in `tests/pane.test.tsx`, desktop and terminal surfaces, on a fixture with a plan and design
   - Pass: tabs switch views; a ticket pill opens the ticket page; its Design chip opens the section; Back returns each step to Board
   - Result: PASS
   - Evidence: Tests 'Plan and Design: tabs, ticket pill, Design chip and Back each step' pass on terminal and desktop: tab switch, pill-P1.2-0007 opens ticket, chip-D3 opens section, Back labels '‹ 0007' -> '‹ Plan' -> '‹ Board', returns to Board.

3. Plan list content
   - Run: pane test reads the Plan view of the fixture
   - Pass: phases show %, builds show Size / Needs / Covers / Ticket state; not started builds show Create ticket (when 0008 exists); counts match the 0003 `progress` output
   - Result: PASS
   - Evidence: Test 'Plan list: phases with %, builds with Size / Needs / Covers / Ticket / State' passes (both surfaces): % compared against roadmap().progress, columns, ticket pills with status, state words. 'Create ticket' correctly absent (0008 unbuilt, HAS_CREATE_TICKETS=false), as the check allows.

4. Timeline
   - Run: pane test toggles Timeline
   - Pass: SVG has a lane per phase, an arrow per `Needs` pair, one hill dot per phase; the toggle is remembered after reopening
   - Result: PASS
   - Evidence: Tests 'Plan timeline: lanes, Needs arrows, hill dots, remembered' and 'remembered across sessions' pass: desktop SVG has 3 lane, 6 dep (data-need per pair), 3 hill-dot, no animate/script/onclick, no isInteractive; terminal lane text and arrows; store key plan-mode:/repo = timeline survives Board round trip and new session.

5. Run ready tickets of a phase and a build
   - Run: pane test presses Run on a phase with 2 ready tickets (one blocked, one draft), then on a build
   - Pass: the prompt fill equals `runLine([ready numbers], S.hasRouter)` exactly (same text as the board's Run ready, including the router tail); blocked and draft tickets are excluded; nothing is sent; with none ready the button is disabled
   - Result: PASS
   - Evidence: Test 'Run for a phase and a build...' passes on both surfaces: phase P2 fill === runLine(['0002','0003'], true) equal to board Run ready text incl. router tail; build run === runLine(['0003'],true); 0004 (waits on 0005) and 0005 (draft) excluded; blocked/empty Run dim, pressing fills nothing; filled.length unchanged (never sent); writes == []. Plain variant without router also passes.

6. Brainstorm on the ticket page
   - Run: pane test presses Brainstorm on ticket 0007's page
   - Pass: prompt fill is `/brainstorm 0007`; design section and phase buttons fill `/brainstorm D3` and `/brainstorm P2`
   - Result: PASS
   - Evidence: Test 'Brainstorm: ticket page, design section and phase fill the prompt' passes both surfaces: '/brainstorm 0007', '/brainstorm D3', '/design D3', '/brainstorm P2'; no writes.

7. Design view, questions, approve gate
   - Run: pane test on a draft design with 2 open questions
   - Pass: sections show coverage states; answering a question writes a `**Resolved …**` line to DESIGN.md; Approve design is disabled until both are answered, then sets `status: approved` and touches no other file; history lists `design/changes/` entries
   - Result: PASS
   - Evidence: Test 'Design view: coverage, inline answers, approve gate, history' passes both surfaces: coverage states and Design % match roadmap(); Approve dim with 2 open, press does nothing; answers write '- [x] ... **Resolved <date> (human): ...**'; after both, Approve sets status: approved and fills /planning; unique write paths == ['/repo/design/DESIGN.md']; history newest first; no changes/ folder = no History.

8. Empty and broken states
   - Run: pane tests with no plan, no design, and a malformed PLAN.md
   - Pass: tabs show an empty state or warning; Board still works; no exception
   - Result: PASS
   - Evidence: Tests for no plan/no design (no tabs, /board plan and /board design empty states, Board and ticket still work), design-only, plan-only, and malformed PLAN.md/DESIGN.md (warning, no exception, Board works) pass on both surfaces.

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README "The pane, view by view", "Run this ticket" and keys table describe Plan, Design, phase/build Run, Brainstorm button and `p`/`d` as built; other listed docs are current or rd.md says why not
   - Result: PASS
   - Evidence: README diff reviewed: 'The pane, view by view' has Board/Plan/Design tabs, Plan and Design bullets, Ticket Brainstorm; 'Run this ticket' has phase/build Run; commands table has /board plan and design; keys table has p, d (with the ready-ticket exception) and b; Roadmap card sentence no longer says views come later. STANDARD.md, plugin.json: no change needed (no pane features listed per rd.md). Current for what was built.

## Not checked by automation

- Visual polish of the timeline and hill SVG in the Claude desktop app (alignment, readability in light and dark).
- That the router actually runs the filled-in run line end to end.

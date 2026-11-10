# Eval — 0007 — Plan and Design views

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not use it)
   - Pass: both exit 0, no failing tests
   - Result:
   - Evidence:

2. Navigation Board → Plan → ticket → Design and back
   - Run: new test in `tests/pane.test.tsx`, desktop and terminal surfaces, on a fixture with a plan and design
   - Pass: tabs switch views; a ticket pill opens the ticket page; its Design chip opens the section; Back returns each step to Board
   - Result:
   - Evidence:

3. Plan list content
   - Run: pane test reads the Plan view of the fixture
   - Pass: phases show %, builds show Size / Needs / Covers / Ticket state; not started builds show Create ticket (when 0008 exists); counts match the 0003 `progress` output
   - Result:
   - Evidence:

4. Timeline
   - Run: pane test toggles Timeline
   - Pass: SVG has a lane per phase, an arrow per `Needs` pair, one hill dot per phase; the toggle is remembered after reopening
   - Result:
   - Evidence:

5. Run ready tickets of a phase and a build
   - Run: pane test presses Run on a phase with 2 ready tickets (one blocked, one draft), then on a build
   - Pass: the prompt fill equals `runLine([ready numbers], S.hasRouter)` exactly (same text as the board's Run ready, including the router tail); blocked and draft tickets are excluded; nothing is sent; with none ready the button is disabled
   - Result:
   - Evidence:

6. Brainstorm on the ticket page
   - Run: pane test presses Brainstorm on ticket 0007's page
   - Pass: prompt fill is `/brainstorm 0007`; design section and phase buttons fill `/brainstorm D3` and `/brainstorm P2`
   - Result:
   - Evidence:

7. Design view, questions, approve gate
   - Run: pane test on a draft design with 2 open questions
   - Pass: sections show coverage states; answering a question writes a `**Resolved …**` line to DESIGN.md; Approve design is disabled until both are answered, then sets `status: approved` and touches no other file; history lists `design/changes/` entries
   - Result:
   - Evidence:

8. Empty and broken states
   - Run: pane tests with no plan, no design, and a malformed PLAN.md
   - Pass: tabs show an empty state or warning; Board still works; no exception
   - Result:
   - Evidence:

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README "The pane, view by view", "Run this ticket" and keys table describe Plan, Design, phase/build Run, Brainstorm button and `p`/`d` as built; other listed docs are current or rd.md says why not
   - Result:
   - Evidence:

## Not checked by automation

- Visual polish of the timeline and hill SVG in the Claude desktop app (alignment, readability in light and dark).
- That the router actually runs the filled-in run line end to end.

# 0007 — Plan and Design views

Type: feature

## What

Milestone M6 of PLAN-design-plan.md (sections 6.3 to 6.5). The pane gets three top-level tabs, Board / Plan / Design. Plan shows the roadmap (phases with %, builds, list and timeline); Design shows the design sections, their coverage, open questions and the approve gate. It also closes two gaps in the proposal: a Brainstorm button on the ticket page, and a Run action for the ready tickets of a phase or build, using the board's router run line.

## Behaviour

- Header tabs **Board / Plan / Design** on every desktop view and in the terminal; Plan and Design appear only when a plan / design is bound (data from 0003 `hooks/core/roadmap.ts`, board summary from 0006). Back and breadcrumbs return to the view the user came from.
- **Plan, List**: one row per phase (name, %, appetite, exit line, hill state), collapsible. Builds table columns: #, Build, Size, Needs, Covers, Ticket (pill with status), State. Not started builds show **+ Create ticket**. Phase header: **Create tickets for Pn**, **Brainstorm**, **▶ Run ready (N)**; build row: **▶ Run** when its ticket is ready. Counts and weights come from 0003, not recomputed here.
- Ticket pill opens the ticket page; a `D` chip opens that design section; the Plan item and Design chips on the ticket page (0006) open Plan and Design at the right item.
- **Plan, Timeline** (toggle, remembered per project): lanes per phase, dependency arrows between builds (`Needs`), and a hill chart with one dot per phase. All static SVG, no scroll capture, link buttons underneath for each build.
- **Run**: for a phase or a build, the ready tickets (status `ready`, no open blockers, same rule as `runnable()` in `hooks/views.tsx`) go into one run line built by `runLine(numbers, S.hasRouter)`, filled in the prompt with `fill()`; never sent automatically. Zero ready tickets: the button is disabled and says why.
- **Create tickets** (per build or phase) hands off to the 0008 job; if 0008 is not built yet the buttons are hidden, not dead.
- **Design view**: section list with coverage state (unplanned / planned / building / built / stale / dropped) and Design % ; section detail rendered like the ticket page (Why / What / Done when) with "Implemented by" build and ticket links; **Brainstorm this** and **Redesign this section** fill the prompt (`/brainstorm D3`, `/design D3`).
- **Open questions** on a design section are answered inline, same widget and `**Resolved <date> (human): …**` format as tickets.
- **Approve design** shows while `status: draft`, disabled until no open questions remain; pressing it sets `status: approved` and fills `/planning`. Writes only DESIGN.md.
- **History** lists versions from `design/changes/` newest first; no folder means no list.
- **Ticket page**: a **Brainstorm** button beside Enhance / Discuss, filling `/brainstorm <number>` (items brainstormed individually, section 5).
- No plan or no design: the tab shows an empty state pointing to Start / `/design`; malformed files show a warning, not a crash.

## Scope

In:
- View kinds `plan` and `design` in the pane, tabs, desktop and terminal layouts (terminal: compact lists, keys `p` and `d`).
- Run, Brainstorm and Approve actions listed above; pane tests; README.

Out:
- Parsing and progress maths (0003), board roadmap card (0006), skills (0005), ticket creation, replan review, stale-ticket review (0008).

## Touchpoints

- `hooks/store.ts` — `View` union gets `plan` and `design` (plus timeline toggle state).
- `hooks/views.tsx` — terminal layout, `go()`, `runnable()`, `runTicket()`, `fill()`, `drawPane()` routing.
- `hooks/desk.tsx` — desktop views, `deskBoard`, `deskTicket` (Brainstorm button), `ProjectBar`.
- `hooks/glass.tsx` — SVG helpers (`barSvg`, `heroSvg`) for phase bars, timeline and hill.
- `hooks/core/query.ts` — `runLine` / `ROUTER_TAIL`, reused unchanged.
- `hooks/core/ticket.ts` — `parseQuestions` / `answerQuestion` reused for design questions.
- `hooks/core/roadmap.ts` — from 0003 (not in the repo yet); `hooks/register.tsx` for the `/board` command keys.
- `tests/pane.test.tsx` — uses the `test(..., async ($, on) => …)` harness with desktop and terminal surfaces.

## Docs

- README.md — "The pane, view by view": add Plan and Design views; "Run this ticket": phase/build Run; "The `/board` command and keys": `p` and `d`; Ticket bullet: Brainstorm button.
- `docs/STANDARD.md` (from 0001) — no change unless the view contradicts it.
- `.claude-plugin/plugin.json` / CHANGELOG — only if they list pane features.

## Open questions

- Split out: this is L. Should it be two tickets, Plan view (with Run) and Design view (with approve gate, brainstorm on ticket)? [split in two / keep one]
  **Resolved 2026-11-10 (human): Keep one ticket for now, since the Plan and Design views share the tabs, view kinds, store changes and test harness, and splitting would duplicate that groundwork. Revisit the split only if the ticket outgrows a single review.**
- Blocked by 0006 only on the board, but Brainstorm buttons need the 0005 skills and Create tickets needs 0008. Add 0005 as a blocker? [add 0005 / buttons fill the prompt anyway, no blocker]
  **Resolved 2026-11-10 (human): Add 0005 as a blocker: the Brainstorm buttons can't do anything useful until the skills exist, and Create tickets stays hidden until 0008 lands, so the Plan and Design views should wait for 0005 rather than ship buttons that fill a prompt for a skill that isn't there.**
- Approve design: should it also fill `/planning` automatically, or only set `status: approved`? [fill prompt / status only]
  **Resolved 2026-11-10 (human): The ticket says Approve "sets `status: approved` and fills `/planning`," so the answer is fill prompt: set the status and also fill `/planning` into the prompt, without sending it.**
- Run for a phase: include ready tickets whose blockers are outside the phase but done? [yes / only within phase]
  **Resolved 2026-11-10 (human): Yes: include a ready ticket whose blockers sit outside the phase as long as those blockers are done, since the ticket is runnable under the same rule as `runnable()` (status `ready`, no open blockers).**

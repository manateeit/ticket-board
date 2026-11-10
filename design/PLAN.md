---
plan: Ticket board
design-version: 1
updated: 2026-11-10
---
# Ticket board: plan

## P1 · Standard and parser
Goal: the design and plan standard is written, this board is described in it, and a parser reads it.
Appetite: 1 week
Exit: `docs/STANDARD.md`, the templates and `design/` for this repo exist, and `roadmap.ts` parses them with tests green.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | `docs/STANDARD.md` (the format in section 3) + templates `design.md`, `plan.md`, `brief.md`, `change.md` | S | — | D1 | standard reads complete; templates parse with the M2 parser | 0001 |
| P1.2 | Ticket board's own design and plan in the standard | S | P1.1 | D1 | `design/DESIGN.md` and `design/PLAN.md` follow the standard and cover every build and section | 0002 |
| P1.3 | `hooks/core/roadmap.ts`: `parseDesign`, `parsePlan`, `bindFromBoard`, `linkTickets`, `progress`, `coverage`, `checks`; `ticket.ts` reads `Plan:` / `Design:` | M | P1.1 | D1, D2 | unit tests on a blank project, a full fixture, and a copy of the factory's `design/factory/plan.md` shape | 0003 |

## P2 · Start and sessions
Goal: a blank folder can be taken from an idea to a design and a plan in the chat.
Appetite: 2 weeks
Exit: a blank folder shows Start and the brainstorm, design and planning skills write valid files.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Project detection + Start screen (desktop and terminal) | M | P1.3 | D3 | pane tests: blank folder shows Start; folder with tickets shows board + banner | 0004 |
| P2.2 | Skills `brainstorm` (EGM bridge + built-in goldfish fallback), `design`, `planning`; agents `goldfish`, `fresh-reader`, `planner`; ticket-writer and `/ticket` write `Plan:` / `Design:` | M | P1.1 | D4 | `claude plugin validate` passes; skill text reviewed against section 5 | 0005 |

## P3 · Board and views
Goal: the pane shows real plan and design progress on the board and in full views.
Appetite: 2 weeks
Exit: a person can go from Board to Plan to a ticket to Design and back with real data.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P3.1 | Header Plan % tile, Roadmap summary card, Phase column + filter, ticket Properties links | M | P1.3 | D5 | pane tests on the fixture | 0006 |
| P3.2 | Plan view (list + timeline/hill SVG) and Design view (sections, coverage, questions, approve gate) | L | P3.1 | D6 | pane tests: navigate Board → Plan → ticket → Design and back | 0007 |

## P4 · Flows and release
Goal: tickets, redesign and replan flow from the plan, existing docs can be adopted, and 0.5.0 ships.
Appetite: 2 weeks
Exit: 0.5.0 is published and the demo project opens with a populated roadmap.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P4.1 | Create tickets from builds (batch jobs), redesign change notes + stale detection, replan proposal review/apply | L | P2.2, P3.2 | D7 | test: applying a proposal edits PLAN.md and adds draft tickets; done tickets untouched | 0008 |
| P4.2 | "I already have docs" adopt flow (AI converts to the standard, you review), `examples/demo-roadmap`, README, publish 0.5.0 | M | P4.1 | D8 | demo project opens with a populated roadmap | 0009 |

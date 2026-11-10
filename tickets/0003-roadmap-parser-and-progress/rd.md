# 0003 — Roadmap parser and progress computation

Type: feature

## What

Milestone M2 of `PLAN-design-plan.md` (sections 3 and 4). Add a pure, token-free module `hooks/core/roadmap.ts` that reads a design file and a plan file (the standard from ticket 0001), joins them to the board's tickets, and computes real progress: build states, Plan %, phase %, current phase, design coverage including stale sections, hill position per phase, and the list of roadmap checks. `hooks/core/ticket.ts` also learns to read the `Plan:` and `Design:` lines of rd.md. Later tickets (0004, 0006, 0007, 0008) only display what this computes.

## Behaviour

- `parseDesign(md)`: front matter (`design`, `version`, `status`, `updated`); sections headed `## D<n> · Title` with `Rev:` (default 1), `Why`, `What`, `Done when` bullets and `### Open questions` (`- [ ]` open, `- [x]` or a `**Resolved` line closed). `Status: dropped…` or a struck-through title (`~~…~~`) marks the section dropped. Unnumbered sections (Vision, Non-goals…) are context and ignored for coverage. Heading separator `·`, `—` or `:` all accepted; `D` ids are case-insensitive and never renumbered.
- `parsePlan(md)`: front matter (`plan`, `design-version`, `updated`); phases headed `## P<n> · Title` with `Goal`, `Appetite`, `Exit`; build table rows with `#`, `Build`, `Size`, `Needs`, `Covers`, `Done when`, `Ticket` and optional `Status` (`deferred` / `dropped` only). Columns are found by header name, so missing `Covers` / `Ticket` columns are fine; `Ticket` may hold several numbers (`0004, 0016`) or `—`.
- Factory shape: a plan with no phase headings and ids like `F1` (see `/Users/thalixdeveloper/development/thalix-sdlc-factory/design/factory/plan.md`) parses as one implicit phase holding every build; any letter prefix on build ids is accepted; rows with `—` in Needs mean no dependencies; a non-build row (the "Self-hosting point") is kept but not counted.
- `bindFromBoard(boardText, readFile)`: reads the `Design: <path> · Plan: <path>` line under the BOARD.md title, accepts upper or lower case file names, and returns the bound paths. No line: look for `design/DESIGN.md` and `design/PLAN.md`; if neither exists the project is "blank" (no design, no plan, no error).
- `ticket.ts`: new functions read `Plan: P1.3` and `Design: D1@2, D3@1` (a bare `D1` has no Rev) from rd.md, next to `Type:`. No `Plan:` line means off-plan.
- `linkTickets(plan, design, tickets)`: attaches each ticket (number, status, Plan, Design refs) to its build by the plan's `Ticket` cell and by the ticket's own `Plan:` line; either link counts, a mismatch is reported by checks.
- Build state: no ticket → not started; any draft → shaping; ready → queued; in-progress / in-check → building; all done → built; any blocked → stuck (stuck wins over the others); `deferred` / `dropped` builds are excluded from every total.
- `progress(...)`: weights S=1, M=3, L=8, unsized=3. Plan % = built weight ÷ counted weight (0 when nothing is counted); phase % likewise. Current phase = first phase under 100%, none when all done. Next up = first not-built build whose `Needs` are all built. Percentages are whole numbers, rounded down.
- `coverage(...)` per numbered, non-dropped section: unplanned → planned → building → built (all covering builds built); stale when a covering ticket says `D3@1` while the section is `Rev: 2` (stale wins). Design % = built sections ÷ counted sections.
- Hill position per phase: uphill while it has open design questions on its covered sections, a draft ticket, or a build with no ticket; over the top once every build has a ready-or-later ticket; downhill as builds finish (position follows phase %).
- `checks(...)` returns alerts, each with id, severity and subject ids: plan older than design version · section with no build · build covering no section · build with no ticket · ticket pointing at a missing build · open design questions · stale tickets · off-plan count.
- Blank project: every function returns empty or zero results and no checks fire. Malformed input never throws; it yields what parsed plus a parse warning list.
- No file reads, network or AI inside the pure functions; only `bindFromBoard` takes a reader callback.

## Scope

IN: `roadmap.ts`, the `Plan:` / `Design:` readers in `ticket.ts`, unit tests with three fixtures (blank project, full fixture covering every state, copy of the factory plan shape), README Development layout line.
OUT: any UI, Start screen, Plan/Design views, store wiring, writing DESIGN.md/PLAN.md, skills and agents, templates and `docs/STANDARD.md` (0001).

## Touchpoints

- `/Users/thalixdeveloper/development/ticket-board/hooks/core/roadmap.ts` (new)
- `/Users/thalixdeveloper/development/ticket-board/hooks/core/ticket.ts` (add `Plan:` / `Design:` readers beside the title/section helpers; reuse `parseQuestions` style)
- `/Users/thalixdeveloper/development/ticket-board/hooks/core/board.ts` (`parseBoard`, `BoardRow`, `Status` give the ticket statuses and `Blocked by`; do not change its table editing)
- `/Users/thalixdeveloper/development/ticket-board/tests/core.test.ts` (existing `claude-code/testing` suite; add roadmap tests here or in a new `tests/roadmap.test.ts`, fixtures inline as template strings like `BOARD` / `RD` there)
- `/Users/thalixdeveloper/development/ticket-board/PLAN-design-plan.md` sections 3 and 4 (the spec); ticket 0001's `docs/STANDARD.md` and templates, when present, must parse.

## Docs

- `README.md` — Development > Layout: `hooks/core/` line mentions the roadmap parser; the paragraph under it names the new test coverage. No user-facing section changes (nothing is shown yet).
- `graft/hooks/core/ticket.md` and a new graft note for roadmap.ts are generated by graft; do not hand-edit.
- `PLAN-design-plan.md` — no change unless the built behaviour deliberately differs from sections 3–4; then note it.

## Open questions

- none

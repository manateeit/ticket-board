# 0002 — Ticket board's own design and plan in the standard

Type: feature

## What
Convert this repo's own design, `PLAN-design-plan.md`, into `design/DESIGN.md` and `design/PLAN.md` written in the standard from ticket 0001 (`docs/STANDARD.md`). Milestones M1–M8 become plan builds and the Ticket column points at tickets 0001–0009 of this board. This makes ticket-board dogfood its own feature and gives the pane real data to show once the parser (0003) and views exist.

## Behaviour
- `design/DESIGN.md` has front matter (`design: Ticket board`, `version: 1`, `status: draft`, `updated: 2026-11-10`), unnumbered context sections (Vision, Problem, Non-goals) and numbered sections D1–D8 with `Rev: 1`, `Why`, `What`, `Done when` (EARS "WHEN … THE SYSTEM SHALL …" lines taken from the source) and `### Open questions` where the source has them.
- D-sections, taken from the source: D1 file standard (source §3) · D2 progress computation (§4) · D3 Start screen (§6.1) · D4 brainstorm, design and planning sessions and their agents (§5 sessions) · D5 board roadmap summary and ticket links (§6.2, §6.5) · D6 Plan and Design views (§6.3, §6.4) · D7 tickets from the plan, redesign and replan (§5 create-tickets/replan, §6.6) · D8 adopt existing docs, demo and release (§6.1 adopt flow, §7 M8).
- The source's "Not in 0.5" list and decisions (§8 defaults) go into Non-goals and a short Constraints section; they are not numbered.
- `design/PLAN.md` has front matter (`plan: Ticket board`, `design-version: 1`, `updated: 2026-11-10`) and phases with Goal, Appetite and Exit, each followed by a build table with the columns `# | Build | Size | Needs | Covers | Done when | Ticket`.
- Builds (Size and Done when copied from source §7; Needs follow the Blocked-by column of `tickets/BOARD.md`):
  - P1 Standard and parser: P1.1 = M1 → 0001 · P1.2 = this ticket (own design and plan, S, Needs P1.1, Covers D1) → 0002 · P1.3 = M2 → 0003 (Needs P1.1).
  - P2 Start and sessions: P2.1 = M3 → 0004 (Needs P1.3) · P2.2 = M4 → 0005 (Needs P1.1).
  - P3 Board and views: P3.1 = M5 → 0006 (Needs P1.3) · P3.2 = M6 → 0007 (Needs P3.1).
  - P4 Flows and release: P4.1 = M7 → 0008 (Needs P2.2, P3.2) · P4.2 = M8 → 0009 (Needs P4.1).
- Every D section is covered by at least one build; every build has exactly one ticket; no `TBD`. Covers: M1 D1 · M2 D1, D2 · M3 D3 · M4 D4 · M5 D5 · M6 D6 · M7 D7 · M8 D8.
- Neither file is bound yet. Adding the line `Design: design/DESIGN.md · Plan: design/PLAN.md` under the title of `tickets/BOARD.md` is a step for the router or the person, run after this ticket merges. The worker must not touch BOARD.md, and the final report lists this step.
- `design/DESIGN.md` stays `status: draft`: only a person approves a design.

## Scope
- IN: `design/DESIGN.md`, `design/PLAN.md`, formats exactly as `docs/STANDARD.md` (0001) defines them; content from `PLAN-design-plan.md` without inventing new requirements.
- OUT: the BOARD.md binding line (router/person step); adding `Plan:` / `Design:` lines to other tickets' rd.md; the parser and any pane code (0003 onward); `design/brief.md`, `brainstorms/`, `changes/`, `decisions/`; deleting or changing `PLAN-design-plan.md` or the root `PLAN.md` (the v1 build plan).

## Touchpoints
- Read: `/Users/thalixdeveloper/development/ticket-board/PLAN-design-plan.md` (§3–§8), `docs/STANDARD.md` and `templates/design.md`, `templates/plan.md` (from 0001), `tickets/BOARD.md` (titles and Blocked-by).
- Create: `design/DESIGN.md`, `design/PLAN.md` (the `design/` folder does not exist yet).
- Later consumers (not changed here): `hooks/core/roadmap.ts` (0003), `hooks/core/board.ts`, `tests/core.test.ts`.

## Docs
- README.md — no change: the pane cannot show the plan until 0003–0007 land; the README gets the roadmap, standard and demo sections in 0009.
- `docs/STANDARD.md` — no change, unless this ticket finds an error in it; then fix it and mention it in the report.
- `PLAN-design-plan.md` — leave as is; its status line may stay "proposal".

## Open questions
- Should `design/DESIGN.md` be committed as `status: draft` (default) or marked `approved` because the person already approved the proposal? [draft / approved]
- Is this ticket (0002) listed as its own build P1.2, as written (default), or left off the plan so it shows as off-plan? [own build / off-plan]
- Are the four phases (P1 Standard and parser, P2 Start and sessions, P3 Board and views, P4 Flows and release) right, with the appetites the worker proposes, or do you want other phase names or a flat plan? [accept grouping / give phases]
- Folder `design/` or `docs/`: depends on the open question in ticket 0001 (default `design/`). [follow 0001]

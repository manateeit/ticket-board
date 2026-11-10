# 0001 — Design and plan file standard

Type: feature

## What

Milestone M1 of `PLAN-design-plan.md` (sections 3 and 7). Write `docs/STANDARD.md`, the written standard for the design and plan layers that sit above tickets, and add four templates. The later tickets (parser 0003, start screen 0004, sessions 0005, views 0007) build on this file, so it must be complete and unambiguous. It is documentation and templates only: no parser, no pane change.

## Behaviour

- `docs/STANDARD.md` exists and covers, with a fenced example for each:
  - Folder layout: `design/brief.md`, `DESIGN.md`, `PLAN.md`, `brainstorms/<date>-<slug>.md`, `changes/<date>-design-vN.md` and `<date>-replan.md`, `decisions/NNNN-<slug>.md` (ADRs, optional).
  - `DESIGN.md`: front matter (`design`, `version`, `status: draft | approved`, `updated`); unnumbered context sections (Vision, Problem, Users, Non-goals, Glossary, Constraints) not counted for coverage; numbered `## D<n> · Title` sections with `Rev:`, `Why:`, `What:`, `Done when:` (EARS "WHEN … THE SYSTEM SHALL …" optional) and `### Open questions` in the same `- [ ]` / `**Resolved …**` format as rd.md; dropped sections stay, struck through, with `Status: dropped in vN`; D ids are never reused.
  - `PLAN.md`: front matter (`plan`, `design-version`, `updated`); `## P<n> · Title` phases with `Goal`, `Appetite`, `Exit`; the build table `# | Build | Size | Needs | Covers | Done when | Ticket` (Size S/M/L, `—` for none, `Covers` as comma-separated D ids, `Ticket` as comma-separated numbers or `—`); optional `Status` column holding only `deferred` or `dropped`.
  - rd.md lines `Plan: P1.3` and `Design: D1@2, D3@1` (section plus Rev written against), written next to `Type:`; no `Plan:` line means off-plan.
  - BOARD.md binding line under the title: `Design: design/DESIGN.md · Plan: design/PLAN.md`; names the bound files so other layouts and several tracks work; upper or lower case file names accepted.
  - Who may write what: only a person approves a design; the pane and skills edit DESIGN.md/PLAN.md.
- The standard states the progress vocabulary the later tickets rely on (build states, S=1/M=3/L=8/unsized=3 weights, coverage states) in a short section that points to PLAN-design-plan.md section 4 rather than repeating it.
- Four templates in `templates/`: `design.md`, `plan.md`, `brief.md`, `change.md`. Each has the front matter and headings from the standard, with `<…>` placeholders, and one worked D / P / build row so the shape is obvious.
- Every example in the standard and each template follows the standard exactly (same headings, same column order), so the M2 parser (ticket 0003) can read them unchanged.

## Scope

- IN: `docs/STANDARD.md`; `templates/design.md`, `templates/plan.md`, `templates/brief.md`, `templates/change.md`; README updates listed below.
- IN (added 2026-11-10 by the person): `.gitignore` — anchor the `PLAN.md` ignore to the repo root (`/PLAN.md`) so `templates/plan.md` and `design/PLAN.md` are not ignored.
- OUT: any TypeScript (`hooks/core/roadmap.ts` is ticket 0003); skills, agents and views; changes to `skills/ticket/` (ticket 0008 teaches the writer the `Plan:` / `Design:` lines); examples/demo-roadmap (ticket 0009).

## Touchpoints

- New: `/Users/thalixdeveloper/development/ticket-board/docs/STANDARD.md` (no `docs/` folder exists yet).
- New: `templates/design.md`, `templates/plan.md`, `templates/brief.md`, `templates/change.md` beside the existing `templates/BOARD.md`.
- Read: `PLAN-design-plan.md` sections 3, 4, 7; `skills/ticket/SKILL.md` and `skills/ticket/TEMPLATE/rd.md` (question and `Resolved` format to reuse); `hooks/core/board.ts` (how BOARD.md is read, so the binding line does not break the table parser).
- Edit: `README.md` (Development layout block).

## Docs

- `README.md` — Development > Layout block: add the `docs/STANDARD.md` line and the four new files under `templates/`. Add a short pointer to the standard (one sentence and a link) near the top of "Using it with the super-agent router", since the full feature docs land with tickets 0006 to 0009.
- `docs/STANDARD.md` itself is the new doc; it links to PLAN-design-plan.md for rationale.
- No change to `skills/ticket/SKILL.md` or the project CLAUDE.md/AGENTS.md (ticket 0008 owns them). No CHANGELOG exists.

## Open questions

- Folder name for the design files: `design/` (default, matches thalix-sdlc-factory) or `docs/`? [design/ · docs/]
  **Resolved 2026-11-10 (human): The design files go in `design/` (so `design/DESIGN.md`, `design/PLAN.md`, `design/brief.md`), matching thalix-sdlc-factory; `docs/` is reserved for the standard itself (`docs/STANDARD.md`).**
- Where do the four templates live? [templates/ beside BOARD.md]
  **Resolved 2026-11-10 (agent, from code: README.md Development > Layout, templates/BOARD.md)**: `templates/`, the plugin's existing template folder.

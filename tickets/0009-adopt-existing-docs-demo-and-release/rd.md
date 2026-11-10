# 0009 — Adopt existing docs, demo roadmap and 0.5.0 release

Type: feature

## What
Milestone M8 of PLAN-design-plan.md (section 7). It closes 0.5: the Start screen's "I already have docs…" path, where AI converts the person's existing files to the design/plan standard and the person reviews the result before anything is written; a demo project, `examples/demo-roadmap`, that opens with a populated roadmap; README sections for the design, plan and Start screen; and the version bump to 0.5.0. It builds on tickets 0001–0008 and adds no new file format.

## Behaviour
- Start screen: "I already have docs…" (button exists since 0004) asks for one or more file or folder paths inside the project (a text box; no file dialog). Paths outside the project, missing paths and empty input show an error and start nothing.
- Converting: the pane starts one background agent (same job queue as the ticket writer; model from the `writerModel` setting). It reads only the chosen files and the code it needs for context, then writes a conversion proposal to `design/changes/<date>-adopt.md` (a design draft, a plan draft, and for each source file what it became or why it was left out).
- Review screen: shows the proposed DESIGN.md and PLAN.md, one checkbox per proposed section, phase or build, and the reason under each (same pattern as the replan review in 0008). Nothing is written to DESIGN.md, PLAN.md or BOARD.md until the person presses **Apply selected**.
- Apply writes DESIGN.md (`status: draft`, `version: 1`), PLAN.md, and the `Design: … · Plan: …` binding line under the BOARD.md title. It never overwrites an existing DESIGN.md or PLAN.md (it asks to pick another name or cancel) and never modifies or deletes the source files.
- Pasted-in plans keep their own ids when they already follow the standard (D1…, P1.1…), and ids are never reused. Anything the AI cannot map becomes an Open question in the design, not a guess.
- After Apply the pane runs the coverage checks from 0003 and shows the Design or Plan view; the Start stepper advances.
- Terminal layout: the same flow as a numbered list and plain-text review; keys follow 0004/0007 conventions.
- `examples/demo-roadmap`: a ready-to-open project with `design/DESIGN.md` (several sections, one approved, one stale, one dropped), `design/PLAN.md` (3 phases, S/M/L sizes, `Covers`, `Ticket` cells), `design/changes/` with one note, and `tickets/` with BOARD.md carrying the binding line and 6+ tickets in mixed statuses with `Plan:` / `Design:` lines (one off-plan bug, one stale design reference, one build with no ticket). Opened with `/board` it shows a Plan % tile, a populated roadmap card, a current phase, and at least two alerts. Everything parses with no errors.
- Version 0.5.0 in `.claude-plugin/plugin.json` (the only place the version lives).

## Scope
IN: adopt flow and its review screen, demo-roadmap, README, version bump, a local release commit message "0.5.0: …" in the style of earlier releases. OUT: changing the file standard, GitHub issue sync, adopting other projects' docs by hand (see open questions), anything beyond the local commit (see open questions). `examples/demo-board` stays as is.

## Touchpoints
- `hooks/register.tsx`, `hooks/views.tsx`: Start screen button, review screen, terminal layout.
- `hooks/ai.ts`, `hooks/store.ts`: the conversion job and the guarded write on Apply; `hooks/core/roadmap.ts` (0003) for parsing and checks.
- `agents/` and `skills/` from 0005 (planner or design agent reused for conversion; add one only if none fits).
- `examples/demo-roadmap/` (new; mirror `examples/demo-board/tickets/BOARD.md` layout), `.claude-plugin/plugin.json`.
- `tests/core.test.ts`, `tests/pane.test.tsx`: parse the demo; adopt flow on an in-memory project (terminal and desktop).
- `README.md`, `docs/STANDARD.md` (from 0001).

## Docs
- `README.md` — add sections for the Start screen, Design and Plan views, adopting existing docs and the roadmap; update the intro, Contents list, Quick start (demo-roadmap line beside demo-board), the `/board` command and keys table, Settings if any changed, "How it edits your files" (DESIGN.md, PLAN.md, binding line), Troubleshooting, and the Development layout block (new files, `examples/demo-roadmap/`).
- `docs/STANDARD.md` — add how adopted documents map to the standard.
- Help text for any new key or command; `skills/ticket/SKILL.md` — no change here unless 0005 left it stale.

## Open questions
- Try it on thalix-sdlc-factory by adopting its `design/factory/` (add the BOARD.md binding line and Covers/Ticket columns)? [ask first, after the person reviews the change (default) | do it in this ticket | leave out]
  **Resolved 2026-11-10 (human): Leave it out of this ticket: the default is to ask first, after the person has reviewed the change, so nothing is adopted into thalix-sdlc-factory here.**
- Publishing 0.5.0 to the public repo manateeit/ticket-board pushes to GitHub: include the push/publish in this ticket, or stop at a local release commit? [stop at a local release commit (safe) | push and publish here]
  **Resolved 2026-11-10 (human): Stop at a local release commit; do not push or publish anything to manateeit/ticket-board in this ticket. Publishing stays out of scope and can be done separately once the person has reviewed the commit.**

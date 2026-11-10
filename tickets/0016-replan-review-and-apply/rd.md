# 0016 — Replan review and apply

Type: feature

Part (c) of the original 0008 "Tickets from the plan, redesign and replan", split 2026-11-10 by the human's answer in 0008. Needs 0008 (the create path) and 0015 (change notes).

## What

When the plan is behind the design, a replan proposal is made by the planner, reviewed on a checkbox screen and applied to PLAN.md and the board. A design or plan change that makes README/docs stale produces a docs follow-up.

## Behaviour

- **Replan proposal**: the "Plan is behind design vN" banner starts a planner run (agent from 0005) that writes `design/changes/<date>-replan.md`: markdown, one `- [ ]` line per item grouped under Add, Change, Drop and Follow-up headings, each followed by its reason. It makes no edits to PLAN.md or tickets.
- **Docs follow-up**: when a redesign or replan changes behaviour that README or docs describe, the proposal includes one Follow-up item "Update README/docs for <change>", and the change note lists it.
- **Review screen**: items grouped Add / Change / Drop / Follow-up, one checkbox each, reason under it, **Apply selected**. Nothing is ticked by default. Applying nothing is a no-op.
- **Apply**: ticked Add/Change/Drop items edit PLAN.md (Drop sets `Status: dropped`, never deletes the row); Add and Follow-up create draft tickets through 0008's create path; Change only edits the row. `design-version` in PLAN.md front matter is set to the design version. Unticked items stay in the proposal and the banner stays until all are applied or dismissed.
- **Done tickets are never rewritten**: no apply step edits the files or board row of a `done` ticket. A change to a done build becomes a new draft Follow-up ticket instead. In-progress tickets are not rewritten either; they are flagged stale (0015). No ticket becomes `ready`.
- **Errors**: PLAN.md changed on disk since the proposal was made, so Apply stops with "plan changed; regenerate the proposal" and writes nothing. An unreadable proposal shows the file path.

## Scope

In: the banner action, proposal file format and parse, review screen, apply, the docs follow-up rule, tests.
Out: the planner agent itself (0005); creating tickets (0008, reused); stale detection (0015).

## Touchpoints

- `hooks/core/roadmap.ts` — proposal parse and PLAN.md edit helpers.
- `hooks/ai.ts`, `hooks/register.tsx` — planner run from the banner.
- `hooks/plan.tsx`, `hooks/views.tsx`, `hooks/desk.tsx` — banner, review screen.
- `agents/planner.md`, `skills/planning/SKILL.md` — proposal format, docs follow-up item.
- `tests/core.test.ts`, `tests/pane.test.tsx`.

## Docs

- README.md — replan banner, review screen and apply.
- `docs/STANDARD.md` — proposal format matches the code.
- `agents/planner.md` / `skills/planning/SKILL.md` — proposal format and the docs follow-up rule.

## Open questions

- Where is the replan proposal stored and what is its format? [markdown with one `- [ ]` line per item in `design/changes/<date>-replan.md` / separate JSON]
  **Resolved 2026-11-10 (human): The replan proposal is stored as markdown at `design/changes/<date>-replan.md`, with one `- [ ]` line per item grouped under Add, Change, Drop and Follow-up headings, each followed by its reason. This keeps it human-readable and matches the design change note format, and the review screen can parse the checkboxes directly.**

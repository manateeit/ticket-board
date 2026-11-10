# 0008 — Tickets from the plan, redesign and replan

Type: feature

## What

Milestone M7 of `PLAN-design-plan.md` (sections 5 and 6.6). The Plan view can turn builds into draft tickets using today's AI job queue (3 at a time). A redesign leaves a change note and marks tickets written against an older section revision as stale. When the plan is behind the design, a replan proposal is reviewed and applied from a checkbox screen. Every ticket created this way must carry `## Docs` and the "Docs and README updated" eval check, and a design or plan change that makes README/docs stale must produce a docs follow-up. This ticket needs the roadmap parser (0003), the Plan/Design views (0007) and the skills/agents (0005).

## Behaviour

- **Create tickets**: the Plan view offers it per build, per phase, and for "all not started". Each selected build with no ticket gets its own skeleton (`createSkeleton`: next number, folder, draft row) and one ticket-writer job. Builds that already have a ticket are skipped, and the toast says how many were skipped.
- **Queue**: at most 3 writer jobs run at once; the rest wait and start as jobs finish. Waiting builds show "queued"; a failed job shows its reason and the build stays creatable again. The queue survives a pane redraw (not a restart).
- **Brief per build**: the writer gets the build row, each covered design section with its `Done when` lines, and the phase Goal and Exit. It writes `Type:`, `Plan: <build>` and `Design: D1@2, D3@1` (section plus current Rev) under the title.
- **Fields from the plan**: `Needs` become the row's Blocked by (build to ticket number; a needed build with no ticket yet is created first in the same batch, or noted in Notes if not selected). Mode is `solo`. Status is always `draft`; nothing sets `ready`.
- **Covers to eval**: each covered section's `Done when` lines become checks in `eval.md`, each with a run command and a pass criterion.
- **Docs, always**: every ticket created from the plan has `## Docs` (README.md named, with the section or "no change: <why>") and the "Docs and README updated" check. The brief says so; the pane also checks the finished files and, when either is missing, reports it in the row Notes and the toast.
- **Plan cell**: when the skeleton exists, the build's `Ticket` cell in PLAN.md gets the number (appended as `0004, 0016` if one exists already). PLAN.md is written by the pane, never by the writer.
- **Redesign note**: when `design/changes/<date>-design-vN.md` is written (by the `design` skill, ticket 0005), the pane reads the changed sections and their new Revs. A ticket whose `Design:` says `D3@1` while D3 is `Rev: 2` shows as stale ("Written against D3 rev 1, now rev 2 — Review") and counts in the alerts.
- **Docs follow-up**: when a redesign or replan changes behaviour that README or docs describe, the proposal includes one Follow-up item "Update README/docs for <change>", and the change note lists it.
- **Replan proposal**: the "Plan is behind design vN" banner starts a planner run that writes `design/changes/<date>-replan.md` (a proposal, no edits to PLAN.md or tickets). Items are Add build, Change build, Drop build, Follow-up ticket (for a done build a change affects). Each has a reason.
- **Review screen**: items are grouped Add / Change / Drop / Follow-up, one checkbox each, reason under it, **Apply selected**. Nothing is ticked by default. Applying nothing is a no-op.
- **Apply**: ticked Add/Change/Drop items edit PLAN.md (Drop sets `Status: dropped`, never deletes the row); Add and Follow-up create draft tickets by the same create path as above; Change only edits the row. `design-version` in PLAN.md front matter is set to the design version. Unticked items stay in the proposal and the banner stays until all are applied or dismissed.
- **Done tickets are never rewritten**: no apply step edits the files or board row of a `done` ticket. A change to a done build becomes a new draft Follow-up ticket instead. In-progress tickets are not rewritten either; they are flagged stale.
- **Errors**: PLAN.md changed on disk since the proposal was made, so Apply stops with "plan changed; regenerate the proposal" and writes nothing. Unreadable proposal shows the file path.

## Scope

In: batch ticket creation and the 3-job queue; `Plan:` / `Design:` lines in new tickets; stale detection and alert; replan proposal file, review screen and apply; docs rules above; tests.

Out: the planner agent and design skill themselves (0005); the Plan and Design views (0007, this adds buttons and the review screen); parsing (0003); adopt flow and demo (0009); GitHub issue sync.

## Touchpoints

- `hooks/ai.ts` — `startJob`, `brief`; add a `plan` job kind and the queue limit.
- `hooks/store.ts` — `Job` type, `S.jobs`, `createSkeleton` (add `Plan:`/`Design:` lines), `editRow`, job persistence.
- `hooks/register.tsx` — `turn.complete` job handler (start the next queued job, docs check); writer guard.
- `hooks/core/roadmap.ts` (from 0003) — plan/design parsing, stale detection; add proposal parse and PLAN.md edit helpers.
- `hooks/core/ticket.ts` — read `Plan:`/`Design:` lines.
- `hooks/views.tsx`, `hooks/desk.tsx` — Create-tickets buttons, stale chip, review screen.
- `agents/ticket-writer.md`, `skills/ticket/SKILL.md`, `skills/ticket/TEMPLATE/` — `Plan:`/`Design:` lines.
- `tests/core.test.ts`, `tests/pane.test.tsx` — new tests.

## Docs

- README.md — add a section on creating tickets from the plan, the redesign/stale alert and replan review; update "Creating a ticket with the AI writer" and the file list in Development.
- `skills/ticket/SKILL.md` and `agents/ticket-writer.md` — document `Plan:` / `Design:` lines and the plan-build brief.
- `docs/STANDARD.md` (from 0001) — if it exists, make the change-note and proposal formats match.

## Open questions

- Split out: this is large; split into (a) create tickets from builds, (b) redesign notes and stale detection, (c) replan review and apply? [one ticket / three tickets]
  **Resolved 2026-11-10 (human): Split it into three tickets: (a) create tickets from builds, (b) redesign notes and stale detection, and (c) replan review and apply, since each depends on the one before it and the ticket is too large to review as one change.**
- Where is the replan proposal stored and what is its format? [markdown with one `- [ ]` line per item in `design/changes/<date>-replan.md` / separate JSON]
  **Resolved 2026-11-10 (human): The replan proposal is stored as markdown at `design/changes/<date>-replan.md`, with one `- [ ]` line per item grouped under Add, Change, Drop and Follow-up headings, each followed by its reason. This keeps it human-readable and matches the design change note format, and the review screen can parse the checkboxes directly.**
- When a needed build is not selected, should Blocked by wait for it? [create it too / leave blocked-by empty and note it / refuse the batch]
  **Resolved 2026-11-10 (human): No. Leave that build out of Blocked by and record the missing dependency in the row's Notes, as the ticket already specifies for unselected needed builds.**
- Should the stale "Review" action open the ticket page only, or also start an AI enhance job against the new section? [open page only / offer enhance job]
  **Resolved 2026-11-10 (human): Open the ticket page only. The stale flag already states what changed, and starting an AI job from a click would add cost and a queue entry the user didn't ask for.**

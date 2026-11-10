# 0008 — Tickets from the plan

Type: feature

Split 2026-11-10 (human answer, see Open questions): the original 0008 "Tickets from the plan, redesign and replan" is now three tickets. This one is (a) create tickets from builds. (b) redesign notes and stale detection is 0015; (c) replan review and apply is 0016. The full original text is in git history (commit before this split).

## What

Milestone M7 of `PLAN-design-plan.md` (sections 5 and 6.6), part (a). The Plan view (0007) can turn builds into draft tickets using today's AI job queue (3 at a time). Every ticket created this way carries `Plan:` / `Design:` lines, `## Docs` and the "Docs and README updated" eval check. 0016 reuses this create path for Add and Follow-up items.

## Behaviour

- **Create tickets**: the Plan view offers it per build, per phase, and for "all not started" (0007 hid these buttons behind `HAS_CREATE_TICKETS = false` in `hooks/plan.tsx`; turn them on). Each selected build with no ticket gets its own skeleton (`createSkeleton`: next number, folder, draft row) and one ticket-writer job. Builds that already have a ticket are skipped, and the toast says how many were skipped.
- **Queue**: at most 3 writer jobs run at once; the rest wait and start as jobs finish. Waiting builds show "queued"; a failed job shows its reason and the build stays creatable again. The queue survives a pane redraw (not a restart).
- **Brief per build**: the writer gets the build row, each covered design section with its `Done when` lines, and the phase Goal and Exit. It writes `Type:`, `Plan: <build>` and `Design: D1@2, D3@1` (section plus current Rev) under the title.
- **Fields from the plan**: `Needs` become the row's Blocked by (build to ticket number). A needed build with no ticket that is in the same batch is created first; a needed build that is not selected is left out of Blocked by and the missing dependency is recorded in the row's Notes. Mode is `solo`. Status is always `draft`; nothing sets `ready`.
- **Covers to eval**: each covered section's `Done when` lines become checks in `eval.md`, each with a run command and a pass criterion.
- **Docs, always**: every ticket created from the plan has `## Docs` (README.md named, with the section or "no change: <why>") and the "Docs and README updated" check. The brief says so; the pane also checks the finished files and, when either is missing, reports it in the row Notes and the toast.
- **Plan cell**: when the skeleton exists, the build's `Ticket` cell in PLAN.md gets the number (appended as `0004, 0016` if one exists already). PLAN.md is written by the pane, never by the writer.

## Scope

In: batch ticket creation and the 3-job queue; `Plan:` / `Design:` lines in new tickets; the docs rules above; PLAN.md Ticket cell; tests.
Out: stale detection and redesign notes (0015); replan proposal, review and apply (0016); the planner agent and design skill (0005); parsing (0003); adopt flow and demo (0009); GitHub issue sync.

## Touchpoints

- `hooks/ai.ts` — `startJob`, `brief`; add a `plan` job kind and the queue limit.
- `hooks/store.ts` — `Job` type, `S.jobs`, `createSkeleton` (add `Plan:`/`Design:` lines), `editRow`, job persistence.
- `hooks/register.tsx` — `turn.complete` job handler (start the next queued job, docs check); writer guard.
- `hooks/core/roadmap.ts` — plan parsing; add a PLAN.md Ticket-cell edit helper.
- `hooks/core/ticket.ts` — read `Plan:`/`Design:` lines.
- `hooks/plan.tsx`, `hooks/views.tsx`, `hooks/desk.tsx` — Create-tickets buttons, queued/failed state per build.
- `agents/ticket-writer.md`, `skills/ticket/SKILL.md`, `skills/ticket/TEMPLATE/` — `Plan:`/`Design:` lines and the plan-build brief.
- `tests/core.test.ts`, `tests/pane.test.tsx` — new tests.

## Docs

- README.md — add a section on creating tickets from the plan; update "Creating a ticket with the AI writer" and the file list in Development.
- `skills/ticket/SKILL.md` and `agents/ticket-writer.md` — document `Plan:` / `Design:` lines and the plan-build brief.

## Open questions

- Split out: this is large; split into (a) create tickets from builds, (b) redesign notes and stale detection, (c) replan review and apply? [one ticket / three tickets]
  **Resolved 2026-11-10 (human): Split it into three tickets: (a) create tickets from builds, (b) redesign notes and stale detection, and (c) replan review and apply, since each depends on the one before it and the ticket is too large to review as one change.**
- When a needed build is not selected, should Blocked by wait for it? [create it too / leave blocked-by empty and note it / refuse the batch]
  **Resolved 2026-11-10 (human): No. Leave that build out of Blocked by and record the missing dependency in the row's Notes, as the ticket already specifies for unselected needed builds.**

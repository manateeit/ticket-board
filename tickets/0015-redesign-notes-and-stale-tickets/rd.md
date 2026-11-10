# 0015 — Redesign notes and stale tickets

Type: feature

Part (b) of the original 0008 "Tickets from the plan, redesign and replan", split 2026-11-10 by the human's answer in 0008. Needs 0008 (tickets carry `Design: D3@1` lines).

## What

A redesign leaves a change note in `design/changes/`, and tickets written against an older revision of a design section are marked stale so the person can review them.

## Behaviour

- **Redesign note**: when `design/changes/<date>-design-vN.md` is written (by the `design` skill, ticket 0005), the pane reads the changed sections and their new Revs.
- **Stale ticket**: a ticket whose `Design:` says `D3@1` while D3 is now `Rev: 2` shows as stale: a chip on its board row and ticket page reading "Written against D3 rev 1, now rev 2 — Review". Stale tickets count in the board alerts. `D3@2` against `Rev: 2` is not stale.
- **Review**: the stale chip's Review action opens the ticket page only. It does not start an AI job.
- **Done and in-progress tickets are never rewritten**: they may be flagged stale, but nothing in this ticket edits their files or board row.
- Malformed `Design:` lines or a missing section are ignored for staleness (no crash, no flag).

## Scope

In: reading change notes, stale detection, the stale chip and alert count, tests.
Out: replan proposal and apply (0016); creating tickets (0008); the design skill itself (0005).

## Touchpoints

- `hooks/core/roadmap.ts` — stale detection (0003 may already compute part of it; reuse it).
- `hooks/core/ticket.ts` — `Design:` line reader.
- `hooks/views.tsx`, `hooks/desk.tsx`, `hooks/plan.tsx` — stale chip on row and ticket page; alert count.
- `tests/core.test.ts`, `tests/pane.test.tsx`.

## Docs

- README.md — the stale chip, what it means and what Review does; the alerts list.
- `docs/STANDARD.md` — make the change-note format match what the pane reads.

## Open questions

- Should the stale "Review" action open the ticket page only, or also start an AI enhance job against the new section? [open page only / offer enhance job]
  **Resolved 2026-11-10 (human): Open the ticket page only. The stale flag already states what changed, and starting an AI job from a click would add cost and a queue entry the user didn't ask for.**

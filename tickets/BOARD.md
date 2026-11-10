# Ticket board

Single source of truth for the super-agent workflow. Only the router (and the
human) edit this file. Workers report back; the router updates the board.

Status flow: `draft` → `ready` → `in-progress` → `in-check` → `done`
(any status → `blocked` when a ticket is stuck; note why in the Notes column)

Every ticket's work ends with its docs: before a ticket moves to `in-check`, the
worker updates README.md and the docs listed under `## Docs` in its rd.md, and
the checker fails the ticket if they are stale.

| #    | Ticket                        | Status | Mode | Blocked by | Owner   | Notes |
|------|-------------------------------|--------|------|------------|---------|-------|
| 0001 | Design and plan file standard | draft | solo | — | — | AI draft done · 1 open question |
| 0002 | Ticket board's own design and plan in the standard | draft | solo | 0001 | — | AI draft done · 4 open questions |
| 0003 | Roadmap parser and progress computation | draft | solo | 0001 | — | AI draft done · no open questions |
| 0004 | Start screen for new projects | draft | solo | 0003 | — | AI draft done · 2 open questions |
| 0005 | Brainstorm, design and planning skills and agents | draft | solo | 0001 | — | AI draft done · 4 open questions |
| 0006 | Plan progress on the board | draft | solo | 0003 | — | AI draft done · 2 open questions |
| 0007 | Plan and Design views | draft | solo | 0006 | — | AI draft done · 4 open questions |
| 0008 | Tickets from the plan, redesign and replan | draft | solo | 0005, 0007 | — | AI draft done · 4 open questions |
| 0009 | Adopt existing docs, demo roadmap and 0.5.0 release | draft | solo | 0008 | — | AI draft done · 2 open questions |

How to read this board:

- **Status** — where the ticket is in the flow above.
- **Mode** — `solo` = one worker in one worktree. `team` = several workers
  coordinating (experimental agent teams; falls back to sequenced solo workers).
- **Blocked by** — ticket numbers that must be `done` first.
- **Owner** — the worker/session currently on it, once in-progress.
- **Notes** — last meaningful event: merged commit, check result, blocker.

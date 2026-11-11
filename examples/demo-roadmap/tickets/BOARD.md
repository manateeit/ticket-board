# Ticket board

Design: design/DESIGN.md · Plan: design/PLAN.md

Single source of truth for the super-agent workflow. Only the router (and the
human) edit this file. Workers report back; the router updates the board.

Status flow: `draft` → `ready` → `in-progress` → `in-check` → `done`
(any status → `blocked` when a ticket is stuck; note why in the Notes column)

| #    | Ticket                         | Status      | Mode | Blocked by | Owner    | Notes |
|------|--------------------------------|-------------|------|------------|----------|-------|
| 0001 | Email link sign-in             | done        | solo | —          | —        | merged 3f2a9c1, all checks PASS |
| 0002 | Salon profile page             | done        | solo | 0001       | —        | merged 8b41d07, all checks PASS |
| 0003 | Book a free slot               | in-progress | solo | 0002       | worker-1 | written against D3 rev 1 |
| 0004 | Day-before reminders           | ready       | solo | 0003       | —        | — |
| 0005 | Ratings and reviews            | draft       | solo | 0003       | —        | AI draft done · 1 open question |
| 0006 | Fix double booking on refresh  | in-check    | solo | —          | worker-2 | off-plan bug |

How to read this board:

- **Status** — where the ticket is in the flow above.
- **Mode** — `solo` = one worker in one worktree. `team` = several workers
  coordinating (experimental agent teams; falls back to sequenced solo workers).
- **Blocked by** — ticket numbers that must be `done` first.
- **Owner** — the worker/session currently on it, once in-progress.
- **Notes** — last meaningful event: merged commit, check result, blocker.

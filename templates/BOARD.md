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

How to read this board:

- **Status** — where the ticket is in the flow above.
- **Mode** — `solo` = one worker in one worktree. `team` = several workers
  coordinating (experimental agent teams; falls back to sequenced solo workers).
- **Blocked by** — ticket numbers that must be `done` first.
- **Owner** — the worker/session currently on it, once in-progress, and when
  the router dispatched it: `<owner>, dispatched YYYY-MM-DD HH:MM` (rewritten
  at `in-progress` and again at `in-check`; the watchdog reads it).
- **Notes** — last meaningful event: merged commit, check result, blocker.
  Start the note with one of these prefixes; the pane's Result badge comes
  only from the prefix at the very start, never from words further in:
  - `merged <sha>` → Merged (e.g. `merged 1a2b3c, all 5 checks PASS`)
  - `failed: …` → Failing (e.g. `failed: check 3, round 2`)
  - `blocked: …` → Blocked (e.g. `blocked: waiting on 0007`)
  - `dropped: …` → Dropped
  - `decided: …` → Decided
  - `moved from GitHub issue …` → From GitHub
  - `AI …` — written by the ticket-board pane, which replaces only notes that
    are empty or start with `AI ` (capital AI and a space). Never start your
    own note with `AI `; the pane never replaces any other note.

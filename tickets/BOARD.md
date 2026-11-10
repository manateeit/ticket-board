# Ticket board

Design: design/DESIGN.md · Plan: design/PLAN.md

Single source of truth for the super-agent workflow. Only the router (and the
human) edit this file. Workers report back; the router updates the board.

Status flow: `draft` → `ready` → `in-progress` → `in-check` → `done`
(any status → `blocked` when a ticket is stuck; note why in the Notes column)

Every ticket's work ends with its docs: before a ticket moves to `in-check`, the
worker updates README.md and the docs listed under `## Docs` in its rd.md, and
the checker fails the ticket if they are stale.

| #    | Ticket                        | Status | Mode | Blocked by | Owner   | Notes |
|------|-------------------------------|--------|------|------------|---------|-------|
| 0001 | Design and plan file standard | done | solo | — | — | merged 33a3b72 (no rebase), all 6 checks PASS, 36/36 tests |
| 0002 | Ticket board's own design and plan in the standard | done | solo | 0001 | — | merged 2ab9878 (no rebase), 7 checks PASS + 1 N/A, 36/36 tests |
| 0003 | Roadmap parser and progress computation | done | solo | 0001 | — | merged fd81dec, all 9 checks PASS, 53/53 tests |
| 0004 | Start screen for new projects | done | solo | 0003 | — | merged 405f6f0 (3 rounds), all 8 checks PASS, 86/86 tests |
| 0005 | Brainstorm, design and planning skills and agents | done | solo | 0001 | — | merged 5ea7423, all 9 checks PASS, 86/86 tests · live interactive session not yet tried by a person |
| 0006 | Plan progress on the board | done | solo | 0003 | — | merged 2393c6a, all 7 checks PASS, 101/101 tests |
| 0007 | Plan and Design views | ready | solo | 0006 | — | AI draft done · 4 open questions · note from 0003: a plan without phases has current phase "" |
| 0008 | Tickets from the plan, redesign and replan | ready | solo | 0005, 0007 | — | AI draft done · 4 open questions |
| 0009 | Adopt existing docs, demo roadmap and 0.5.0 release | ready | solo | 0008 | — | AI draft done · 2 open questions |
| 0010 | New ticket button does nothing | done | solo | — | — | merged 353ef2c, all 6 checks PASS, 112/112 tests · not reproduced on 0.4.14 (likely 0013); 11 regression tests added · needs a person to press it in the real app |
| 0011 | README button does nothing | done | solo | — | — | merged 33b4229, checks 1-4,6 PASS, 139/139 · check 5 (live click) waived by human 2026-11-10, to test after release · terminal `o` fix; desktop not reproduced (likely 0013) |
| 0012 | Agents button does nothing | done | solo | — | — | merged 4617943, all 6 checks PASS, 123/123 tests · desktop not reproduced (likely 0013); terminal Agents button added; title-bar hardening · needs a person to click it in the real app |
| 0013 | Pane does not draw when a resumed agent is listed twice | done | solo | — | — | merged 2d441d3 (no rebase), 5 checks PASS, 37/37 tests · needs a release to reach the installed plugin |
| 0014 | Show the plugin version on the board | in-progress | solo | — | worker | setting showVersion, default on · runs alongside the 0.4.15 blank-board reproducer |

How to read this board:

- **Status** — where the ticket is in the flow above.
- **Mode** — `solo` = one worker in one worktree. `team` = several workers
  coordinating (experimental agent teams; falls back to sequenced solo workers).
- **Blocked by** — ticket numbers that must be `done` first.
- **Owner** — the worker/session currently on it, once in-progress.
- **Notes** — last meaningful event: merged commit, check result, blocker.

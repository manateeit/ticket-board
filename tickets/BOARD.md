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
| 0007 | Plan and Design views | done | solo | 0006, 0005 | — | merged 3524f5a, all 9 checks PASS, 179/179 tests · Create tickets hidden until 0008 · live check: do p/d hotkeys fire while typing in an input? |
| 0008 | Tickets from the plan | done | solo | 0005, 0007 | — | merged db4475d, all 6 checks PASS, 194/194 tests · low risk noted: agent.list fallback could match a finished same-description agent on hosts that omit agentId |
| 0009 | Adopt existing docs, demo roadmap and 0.5.0 release | done | solo | 0008, 0015, 0016 | — | merged 193cb1c, all 8 checks PASS, 291/291 · 0.5.0 local only, not pushed · tests/demo-roadmap.ts must be kept in sync with examples/demo-roadmap by hand |
| 0010 | New ticket button does nothing | done | solo | — | — | merged 353ef2c, all 6 checks PASS, 112/112 tests · not reproduced on 0.4.14 (likely 0013); 11 regression tests added · needs a person to press it in the real app |
| 0011 | README button does nothing | done | solo | — | — | merged 33b4229, checks 1-4,6 PASS, 139/139 · check 5 (live click) waived by human 2026-11-10, to test after release · terminal `o` fix; desktop not reproduced (likely 0013) |
| 0012 | Agents button does nothing | done | solo | — | — | merged 4617943, all 6 checks PASS, 123/123 tests · desktop not reproduced (likely 0013); terminal Agents button added; title-bar hardening · needs a person to click it in the real app |
| 0013 | Pane does not draw when a resumed agent is listed twice | done | solo | — | — | merged 2d441d3 (no rebase), 5 checks PASS, 37/37 tests · needs a release to reach the installed plugin |
| 0014 | Show the plugin version on the board | done | solo | — | — | merged 913a4d2, all 6 checks PASS, 151/151 tests · not released yet |
| 0015 | Redesign notes and stale tickets | done | solo | 0008 | — | merged 4c8d431, all 5 checks PASS, 203/203 tests |
| 0016 | Replan review and apply | done | solo | 0008, 0015 | — | merged a8878d3, all 6 checks PASS, 238/238 · added Dismiss selected; planner spawned directly with a write guard |
| 0017 | If a run is in failed state | ready | solo | — | — | AI draft done · all 4 questions answered (no retry button; blocked-ticket explain is a separate ticket) |
| 0018 | Light colors hide buttons, tabs and text | done | solo | — | — | merged 9ff6f75, all 5 checks PASS, 213/213 · cause: desktop native buttons draw labels in app colors on painted glass; fix: inverseText plates + darker palette · needs a person to look in each Colors setting (plate width in column cells unverified) |
| 0019 | Light mode that follows the app | done | solo | 0018 | — | merged 611eb71, all 6 checks PASS, 263/263 · dark+dark unchanged except 0018 plates removed · needs a person to look: app light/dark × Colors app/dark/light; narrow-pane overflow of plated groups unverified |
| 0020 | Pane goes blank: README view too large | done | solo | — | — | merged 09f0086, all 6 checks PASS, 299/299 · real README = 8 parts, max 57.6K chars · guard checks characters only (nodes/depth not checked, low risk) · follow-ups: board paging at ~26 visible tickets, per-project Colors, remaining explicit-undefined props |
| 0021 | Activity strip says "waiting for you" while agents work | done | solo | — | — | merged 587be8b, all 3 checks PASS, 309/309 |
| 0022 | Large plans and boards shown in pages | done | solo | 0020 | — | merged dd26d38, all 5 checks PASS, 329/329 · heavy 56-build plan max page 51.6K; worst board page 83.7K · follow-up: one phase with ~30+ (or ~17+ heavy) builds still hits the notice on desktop |
| 0023 | Board cell edits never silently dropped | done | solo | — | — | merged dfd5a95, all 5 checks PASS · leak audit L1, L9 · follow-up: AI note writes (ai.ts:103, register.tsx:251) still drop notes silently on a board with no Notes column |
| 0024 | One rule for resolved questions | done | solo | — | — | merged bc53923, all 5 checks PASS, 338/338 · leak audit L3 |
| 0025 | Tickets folder setting works everywhere | done | solo | — | — | merged 69bcef7, all 5 checks PASS, 347/347 on main · leak audit L2 |
| 0026 | A half binding line keeps the other default | done | solo | — | — | merged 3dfa045, all 5 checks PASS, 336/336 · leak audit L4 |
| 0027 | Forced refresh waits for fresh data | done | solo | — | — | merged 619e285, all 5 checks PASS, 358/358 on main · leak audit L5 |
| 0028 | Plan batch errors not read from the banner | done | solo | — | — | merged 3522eda, all 5 checks PASS, 333/333 · leak audit L6 |
| 0029 | Watch buttons handle the host's refusal | done | solo | — | — | merged d042905, all 4 checks PASS, round 2 resolved a test-file conflict, 353/353 on main · leak audit L7 |
| 0030 | One parser for rd.md head fields | done | solo | — | — | merged d4493ca, all 6 checks PASS, 355/355 on main · leak audit L8 |
| 0031 | Glass palette and plates made explicit | draft | solo | — | — | leak audit L10, L11 (risk) |
| 0032 | Notes prefixes written down | done | solo | — | — | merged 4d9f3ed, all checks PASS, round 2 resolved merge conflict (render timeouts from load only) · round 2: test-file conflict with main · leak audit L12 (risk) + audit 2 L6 (bug) |
| 0033 | One status list for glass and roadmap | in-progress | solo | — | worker | built; re-merging main after the setPaneNote fix (736d7f7) · leak audit 2 L10, L14 (bug) |
| 0034 | Run line places the wait-for-blockers clause itself | done | solo | — | — | merged c812b8b, all 5 checks PASS (render timeouts from load only) · leak audit 2 L8 (bug) |
| 0035 | Tickets folder setting: remaining paths | done | solo | — | — | merged e5e54f4, all 4 checks PASS, round 2 resolved merge conflict, 408/408 on main · checker ALL PASS; round 2: test-file conflict with main · leak audit 2 L7, L13 (bug) |
| 0036 | New ticket rows report dropped columns | in-progress | solo | — | worker | checker ALL PASS; round 2: README conflict with main · leak audit 2 L2 (bug) |
| 0037 | Binding line keeps the half it is not given | done | solo | — | — | merged 07e6fa1, all 4 checks PASS (render timeouts from load only) · leak audit 2 L3 (bug) |
| 0038 | Replan Apply only applies what was ticked, for its design | done | solo | — | — | merged d42c7a1, all 5 checks PASS (render timeouts from load only) · leak audit 2 L4, L5 (bug) |
| 0039 | One rule for where a design section's questions end | done | solo | — | — | merged 18a5a76, all 5 checks PASS (render timeouts from load only) · leak audit 2 L1 (bug) |
| 0040 | Questions section hidden only when core finds it | done | solo | — | — | merged 3cb071d, all 4 checks PASS (render timeouts from load only) · leak audit 2 L9 (bug) |
| 0041 | Store writes: fresh snapshot and no edits under an AI job | done | solo | — | — | merged e475a3e, all 4 checks PASS (render timeouts from load only) · leak audit 2 L11, L15 (risk) |
| 0042 | Untracked writer spawns count and show | done | solo | — | — | merged 4789abb, all checks PASS, round 2 resolved merge conflict (render timeouts from load only) · round 2: ai.ts conflict with main · leak audit 2 L12 (risk) |
| 0043 | Agent handoff contracts match the pipeline | done | solo | — | — | merged 33d255e, all 5 checks PASS (2 render timeouts from machine load, Markdown-only diff) · leak audit 2 L16, L18, L19 |
| 0044 | Every eval.md has Result and Evidence fields | done | solo | — | — | merged 282a45b, all 4 checks PASS (round 2 fixed README), 409/409 on main · round 2: README line 281 stale (checker FAIL on docs) · leak audit 2 L17 (risk) |

How to read this board:

- **Status** — where the ticket is in the flow above.
- **Mode** — `solo` = one worker in one worktree. `team` = several workers
  coordinating (experimental agent teams; falls back to sequenced solo workers).
- **Blocked by** — ticket numbers that must be `done` first.
- **Owner** — the worker/session currently on it, once in-progress.
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

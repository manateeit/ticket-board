# The design and plan file standard

Version 1. This is the written standard for the two layers that sit above tickets: a **design**
(what we are building and why, in numbered sections) and a **plan** (phases of builds that
implement those sections). Both are plain Markdown with front matter and a few strict headings,
so a script can read them and a person can edit them. Tickets point at the plan item and design
sections they serve.

Rationale, screens and the sessions that write these files are in
[PLAN-design-plan.md](../PLAN-design-plan.md). This file is only the format. Ready-to-copy
starting points are in [templates/](../templates/): `design.md`, `plan.md`, `brief.md`, `change.md`.

Contents: [Folder layout](#1-folder-layout) · [DESIGN.md](#2-designmd) · [PLAN.md](#3-planmd) ·
[Ticket lines](#4-ticket-lines-in-rdmd) · [BOARD.md binding line](#5-boardmd-binding-line) ·
[Who may write what](#6-who-may-write-what) · [Progress vocabulary](#7-progress-vocabulary) ·
[Other files](#8-brainstorms-changes-and-decisions)

## 1. Folder layout

The design files live in `design/` (so `design/DESIGN.md`, `design/PLAN.md`, `design/brief.md`).
`docs/` is reserved for this standard.

```
tickets/BOARD.md          gains one binding line under the title (section 5)
design/
  brief.md                brainstorm result: problem, users, concepts kept and cut (optional)
  DESIGN.md               the design, numbered sections D1…Dn
  PLAN.md                 the plan, phases P1…Pn with builds P1.1…
  brainstorms/2026-11-10-offline-sync.md     one file per brainstorm (whole concept or one item)
  changes/2026-11-10-design-v3.md            one note per redesign
  changes/2026-11-12-replan.md               one note per replan
  decisions/0001-router-in-one-session.md    ADRs, optional (NNNN-<slug>.md)
```

- Dates are `YYYY-MM-DD`. A change note for a redesign is `<date>-design-v<N>.md` where N is the
  new design version; a replan note is `<date>-replan.md`.
- Only `DESIGN.md` and `PLAN.md` are needed for the progress views. Everything else is optional.
- File names are read case-insensitively (`design.md` works as well as `DESIGN.md`).
- Several tracks can live side by side (`design/factory/`, `design/card-flow/`); the BOARD.md
  binding line says which one the board is bound to.

## 2. DESIGN.md

Front matter, then context sections, then numbered `D` sections.

```markdown
---
design: Thalix SDLC Factory
version: 3
status: approved
updated: 2026-11-10
---
# Thalix SDLC Factory: design

## Vision
One paragraph: what this is and who it is for.

## Problem
What hurts today.

## Users
Who uses it.

## Non-goals
What this will not do.

## Glossary
- **Router**: the session that runs workers and checkers.

## Constraints
- Must run without a server.

## D1 · Router inside one session
Rev: 2
Why: One session keeps the run state in one place.
What: A single router session owns an intent from start to merge.
Done when:
- WHEN a run starts THE SYSTEM SHALL start one router session for the intent
- The router never opens a second session for the same intent

### Open questions
- [ ] Does the router own merges or the merger agent? [router · merger agent]
- [x] Should runs survive a restart?
  **Resolved 2026-11-09 (human): yes, state is on disk**

## D2 · AI checker layer
Rev: 1
Why: Checks need a fresh reader.
What: Every ticket is checked by a separate agent that only sees eval.md.
Done when:
- The checker runs every command in eval.md

## D7 · ~~Remote workers~~
Status: dropped in v3 (see changes/2026-11-10-design-v3.md)
```

**Front matter keys** (all required):

| Key | Value |
|---|---|
| `design` | the design's name |
| `version` | integer, starts at 1, bumped by every redesign |
| `status` | `draft` or `approved`; only a person sets `approved` |
| `updated` | `YYYY-MM-DD` of the last edit |

**Unnumbered context sections** are free prose: Vision, Problem, Users, Non-goals, Glossary,
Constraints. They are optional, may appear in any order, and are **not counted for coverage**.

**Numbered sections** use exactly `## D<n> · Title` (a capital D, the number, a space, the middle
dot `·`, a space, the title). Each has these lines, in this order:

| Line | Meaning |
|---|---|
| `Rev: <n>` | starts at 1; bumped when the section's meaning changes (not for typo fixes) |
| `Why: …` | the reason this section exists |
| `What: …` | what is being built, in plain words (may continue on following lines) |
| `Done when:` | a bullet list of observable conditions. EARS form `WHEN … THE SYSTEM SHALL …` is optional; plain statements are fine. These become the starting point of each ticket's `eval.md`. |
| `### Open questions` | questions in the same format as rd.md (below). Optional. |

**Open questions** use the rd.md format. A question is open while it has no `**Resolved …**`
line, and is written `- [ ]`. Answering it means ticking it (`- [x]`) and adding, indented under
it, `**Resolved <date> (<who>): <answer>**`. A section with any open question blocks approval of
the design.

**Dropped sections** stay in the file, with the title struck through (`~~Title~~`) and one line
`Status: dropped in v<N>` (optionally followed by a pointer to the change note). They have no
`Rev`, `Why` or `What`, and do not count for coverage.

**IDs are never reused.** A `D` number belongs to one section forever; new sections take the next
unused number, even if earlier ones were dropped. Numbers need not be contiguous.

## 3. PLAN.md

Front matter, then `P` phases, each with a build table.

```markdown
---
plan: Thalix SDLC Factory
design-version: 3
updated: 2026-11-10
---
# Thalix SDLC Factory: plan

## P1 · Control plane in miniature
Goal: routers reach the server only over its API.
Appetite: 2 weeks
Exit: a dry-run intent with 3 stories runs end to end.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Rename to thalix-sdlc-factory | M | — | D5 | no user-facing "kanban-web" strings remain | 0001 |
| P1.2 | Router agent definitions | S | P1.1 | D1 | lint test checks front matter | 0002 |
| P1.3 | Run API for an external router | M | P1.1 | D1, D3 | spec tests drive a fake router | — |

## P2 · Build loop
Goal: one run per intent, one Accept per intent.
Appetite: 3 weeks
Exit: a real intent merges through the router.

| # | Build | Size | Needs | Covers | Done when | Ticket | Status |
|---|---|---|---|---|---|---|---|
| P2.1 | One run per intent | L | P1.3 | D1, D4 | a second start reuses the run | 0004, 0016 | |
| P2.2 | Remote workers | M | — | D7 | not applicable | — | dropped |
```

**Front matter keys** (all required):

| Key | Value |
|---|---|
| `plan` | the plan's name |
| `design-version` | the design `version` this plan was made from; lower than the design's means "plan is behind" |
| `updated` | `YYYY-MM-DD` of the last edit |

**Phases** use exactly `## P<n> · Title`, followed by three lines: `Goal:` (one sentence),
`Appetite:` (how much time the phase is worth, free text such as `2 weeks`) and `Exit:` (the
observable condition that ends the phase).

**Build table** header, exactly, in this column order:

```
| # | Build | Size | Needs | Covers | Done when | Ticket |
```

| Column | Value |
|---|---|
| `#` | build id `P<phase>.<n>`, never reused |
| `Build` | short name |
| `Size` | `S`, `M` or `L`; empty means unsized |
| `Needs` | comma-separated build ids that must be built first, or `—` for none |
| `Covers` | comma-separated D ids this build implements (`D1, D3`) |
| `Done when` | one line: how you know the build is finished |
| `Ticket` | comma-separated ticket numbers (`0004, 0016`), or `—` for none yet |

An optional eighth column `Status` goes last and holds only `deferred` or `dropped`; leave the
cell empty for everything else. All other state is derived from the tickets; never write "done"
or "in progress" in the table.

The `—` is an em dash. Cells never contain a `|`.

## 4. Ticket lines in rd.md

Two lines next to the `Type:` line, written by the ticket writer and editable in the pane:

```
Type: feature
Plan: P1.3
Design: D1@2, D3@1
```

- `Plan:` is one build id.
- `Design:` is a comma-separated list of `D<n>@<rev>`: the section and the `Rev` the ticket was
  written against. When the section's `Rev` is later higher, the ticket is stale.
- A ticket with no `Plan:` line is **off-plan**. That is fine for bugs and chores; it is shown,
  not punished.

## 5. BOARD.md binding line

One line under the board title names the files the board is bound to:

```markdown
# Ticket board

Design: design/DESIGN.md · Plan: design/PLAN.md

Single source of truth for the super-agent workflow. …
```

- Format: `Design: <path> · Plan: <path>`, paths relative to the project root, separated by a
  space, a middle dot `·` and a space. Either half may be left out.
- Because it names the files, other layouts work without moving anything
  (`Design: design/factory/design.md · Plan: design/factory/plan.md`), and a project with several
  tracks binds the one it is working on.
- Upper or lower case file names are accepted.
- It is an ordinary line outside the table, so the board's table reader ignores it.
- With no binding line, `design/DESIGN.md` and `design/PLAN.md` are used if they exist.

## 6. Who may write what

- Only a **person** approves a design: `status: approved` is set by a human action (the Approve
  button in the pane, or editing the file), never by an agent.
- The pane and the design, planning and ticket skills edit `DESIGN.md` and `PLAN.md`. Background
  agents do not.
- A redesign bumps `version` and the `Rev` of each changed section and writes a change note. It
  never edits the plan or tickets; a replan does that, and only after a person accepts the
  proposal.
- Finished tickets are never rewritten by a redesign or replan; follow-up tickets are added.

## 7. Progress vocabulary

Later tooling computes progress from these files and the ticket board. The terms below are the
ones it uses; the exact rules are in
[PLAN-design-plan.md, section 4](../PLAN-design-plan.md#4-how-progress-is-computed) and are not
repeated here.

- **Build states**: not started, shaping, queued, building, built, stuck. Builds marked
  `deferred` or `dropped` are excluded from totals.
- **Weights**: S = 1, M = 3, L = 8, unsized = 3.
- **Coverage states** for a design section: unplanned, planned, building, built, stale.
- Plan %, phase % and design % are weighted shares of built work; the current phase is the first
  phase under 100%.

## 8. Brainstorms, changes and decisions

All optional notes, linked from DESIGN.md and PLAN.md where useful.

`design/brief.md`, the brainstorm result (template: `templates/brief.md`):

```markdown
---
brief: Thalix SDLC Factory
date: 2026-11-10
---
# Thalix SDLC Factory: brief

## Problem
Salon owners lose bookings to phone tag.

## Users
Owners of small salons.

## Kept
- Online booking page

## Cut
- Loyalty points
```

`design/brainstorms/<date>-<slug>.md` is free prose, one file per brainstorm.

`design/changes/<date>-design-vN.md` or `<date>-replan.md`, one note per redesign or replan
(template: `templates/change.md`):

```markdown
---
change: design-v3
date: 2026-11-10
design-version: 3
---
# Design v3

## Why
Remote workers are out of scope.

## Changes
- Dropped D7 · Remote workers
- Changed D3 (Rev 1 → 2): the checker now reads eval.md only

## Follow-ups
- Replan: P2.2 covers a dropped section
```

`design/decisions/NNNN-<slug>.md` holds an architecture decision record (context, decision,
consequences) in free prose.

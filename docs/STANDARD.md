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
[Other files](#8-brainstorms-changes-and-decisions) · [Adopting existing documents](#9-adopting-existing-documents)

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
  changes/2026-11-10-adopt.md                one proposal per adoption of existing docs
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

**Open questions** use the rd.md format and the resolved rule in section 4. A question is
written `- [ ]` and stays open until it is resolved. Answering it means ticking it (`- [x]`) and adding, indented under
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
  written against. When the section's `Rev` is later higher, the ticket is stale: the pane shows
  *Written against D3 rev 1, now rev 2 — Review* on its row and page and counts it in the board
  alerts. A bare `D<n>` (no `@rev`), a reference that cannot be read, or a section DESIGN.md does
  not have (or has dropped) is never stale. Stale tickets, done ones included, are flagged only;
  nothing rewrites them.
- A ticket with no `Plan:` line is **off-plan**. That is fine for bugs and chores; it is shown,
  not punished.

### Open questions (the resolved rule)

Each `- ` (or numbered) bullet under `## Open questions` in rd.md, and under `### Open questions`
in a DESIGN.md section, is one question. Placeholders are not questions: `- none`, the collapsed
`- none (resolved <date>; answers folded into the ticket)`, `- n/a`, `- —` and the template's
`<…>` line. A question is **resolved** only when one of these holds:

1. a line under it starts with `**Resolved`, written
   `**Resolved <date> (<who>): <answer>**`, where `<who>` is `human` or `agent, from code: <path>`
   (the ticket writer's `**Resolved <date> (agent, from code: <path>)**: <decision>` also counts);
2. its box is ticked: `- [x] …`;
3. it is struck through: `- ~~…~~`.

Nothing else counts. Words such as "resolved", "(human" or "agent)" anywhere else in a detail
line leave the question open. A ticket with any open question cannot be marked ready, and the
router refuses it. The pane implements this rule in one function, `isResolved` in
`hooks/core/ticket.ts`.

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
  proposal: the planner writes only the proposal (section 8), and the pane applies the items a
  person ticks.
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

What the pane reads from a redesign note (`<date>-design-vN.md`; replan notes are proposals,
below):

- `design-version` and `date` from the front matter; when missing, the `vN` and the date of the
  file name.
- The bullets under `## Changes` (the whole note when it has no such heading), one per section,
  case-insensitive:
  - `- Changed D<n> (Rev <a> → <b>): …`: the section and its new Rev `<b>` (`->` works for `→`;
    `(Rev <b>)` alone is accepted too).
  - `- Added D<n> · <Title>`
  - `- Dropped D<n> · <Title>`
- Other lines are skipped. The Design view's History shows the result next to the note, e.g.
  *Design v3 · 2026-11-10 · D3 now rev 2, D9 added, D7 dropped*.

Staleness itself is always computed from the `Rev:` lines in DESIGN.md (section 4), not from the
note, so a missing or hand-edited note never changes which tickets are stale.

**Replan proposals.** A replan note (`<date>-replan.md`) is a proposal: a list of items a person
ticks and applies in the pane's Replan review. The planner writes it; nothing in PLAN.md or the
tickets changes until a person presses Apply.

```markdown
---
change: replan
date: 2026-11-12
design-version: 3
plan-hash: 9f2c41ab
---
# Replan for design v3

## Why
Design v3 adds D9, changes D3 and drops D7.

## Add
- [ ] | P2.3 | Offline cache | M | P2.1 | D9 | the cache survives a restart |
  D9 is new in v3 and no build covers it.

## Change
- [ ] | P1.3 | Run API for an external router | L | P1.1 | D1, D3 | spec tests drive a fake router |
  D3 rev 2 adds the retry rule, so the build grows.

## Drop
- [ ] P2.2 · Remote workers
  It only covers D7, dropped in v3.

## Follow-up
- [ ] P1.1 · Router retries
  P1.1 is done (ticket 0001); D3 rev 2 adds retries, so a new ticket does them.
- [ ] Update README/docs for design v3: Offline cache
  README describes the online-only behaviour.
```

| Front matter key | Value |
|---|---|
| `change` | `replan` |
| `date` | `YYYY-MM-DD` |
| `design-version` | the design `version` the proposal brings the plan to |
| `plan-hash` | the fingerprint of PLAN.md the proposal was made from: FNV-1a 32-bit over the file text with `\r\n` read as `\n`, 8 lower-case hex digits. The pane computes it and hands it to the planner, and fills it in when a proposal has none |

- The four headings are `## Add`, `## Change`, `## Drop` and `## Follow-up`, in that order
  (`### Add build`, `### Change build`, `### Drop build`, `### Follow-up ticket` and
  `## Follow-ups` are read too). `- none` under an empty heading.
- One item per line: `- [ ] ` then the item; its reason on the following line(s), indented
  (a leading `Reason:` is allowed). `[x]` is an applied item and `[-]` a dismissed one: the pane
  writes these, and only open `[ ]` items are offered.
- **Add** and **Change** items are the build row without the Ticket and Status cells:
  `| # | Build | Size | Needs | Covers | Done when |`. Add uses a new id in the phase it goes into
  (`P2.3` goes into `## P2`).
- **Drop** items start with the build id: `P2.2 · Title`.
- **Follow-up** items are new draft tickets: `P1.1 · What it does` (a ticket for that build) or
  just the title (an off-plan ticket). A change to a build whose ticket is done is always a
  Follow-up: done tickets are never rewritten.
- **Docs follow-up:** when a redesign or replan changes behaviour README or docs describe, the
  proposal has exactly one Follow-up item `Update README/docs for <change>`, and the redesign's
  change note lists the same line under `## Follow-ups`.

**Applying** the ticked items:

1. PLAN.md is read again and its `plan-hash` computed. When it is not the proposal's (or the
   proposal has none), Apply stops with *plan changed; regenerate the proposal* and writes nothing.
2. **Add** inserts the row at the end of its phase's build table, Ticket `—`; **Change** rewrites
   the row's cells from Build to Done when and keeps Ticket and Status; **Drop** sets Status to
   `dropped` (adding the Status column to that table when it has none) and keeps the row. When
   anything was applied, `design-version` becomes the proposal's design version and `updated`
   today. Every other line of PLAN.md is kept.
3. Add and Follow-up items get draft tickets the way Create tickets makes them (number in the
   build's Ticket cell). No ticket's files or board row are edited, no ticket becomes `ready`.
4. The applied items become `[x]` and `plan-hash` is updated to the new PLAN.md, so the items
   left can still be applied. The pane shows the proposal until every item is `[x]` or `[-]`.

`design/decisions/NNNN-<slug>.md` holds an architecture decision record (context, decision,
consequences) in free prose.

## 9. Adopting existing documents

A project with docs of its own (notes, a spec, an old roadmap or plan) is brought into this
standard by **adopting** them: the pane's Start screen (**I already have docs…**) starts the
`planner` agent in adopt mode on the files and folders the person names. The agent writes one
proposal, `design/changes/<date>-adopt.md` (`<date>-adopt-2.md` when one already exists that day),
and nothing else; the person reviews it and the pane writes the files on **Apply selected**.

```markdown
---
change: adopt
date: 2026-11-10
sources: notes/roadmap.md, notes/old-standup.md
---
# Adopt existing docs

## Sources
- notes/roadmap.md: D1, D2, D3, P1, P1.1, P1.2
- notes/old-standup.md: left out (meeting notes with nothing to build)

## Reasons
- D1: "Accounts (D1)" in notes/roadmap.md, id kept
- D2: the salon page the notes assume; new id
- P1.1: milestone 1 in notes/roadmap.md

## DESIGN.md
~~~~markdown
---
design: Salon
version: 1
status: draft
updated: 2026-11-10
---
# Salon: design

## D1 · Accounts
Rev: 1
…
~~~~

## PLAN.md
~~~~markdown
---
plan: Salon
design-version: 1
updated: 2026-11-10
---
# Salon: plan

## P1 · Foundations
…
~~~~
```

| Part | Holds |
|---|---|
| front matter | `change: adopt`, `date`, `sources` (the paths the person named); the pane adds `applied: <date>` after Apply, and an applied proposal is not offered again |
| `## Sources` | one line per source file: `- <path>: <the ids it became>`, or `- <path>: left out (<why>)` |
| `## Reasons` | one line per design section, phase and build: `- <id>: <where it comes from>` |
| `## DESIGN.md` | the whole design draft (section 2) in a fenced block (`~~~~` or a backtick fence longer than any inside it) |
| `## PLAN.md` | the whole plan draft (section 3) in a fenced block |

How adopted documents map to the standard:

- **Prose about what and why** (vision, problem, users, non-goals) becomes the unnumbered context
  sections of DESIGN.md.
- **Each feature, capability or requirement** becomes a numbered `## D<n> · Title` section with
  `Rev: 1`, `Why`, `What` and `Done when` taken from the source; acceptance criteria and "it
  works when …" lines become `Done when` bullets.
- **Milestones, releases or sprints** become phases `## P<n> · Title` (Goal, Appetite, Exit), and
  their tasks become builds in the phase's build table, sized `S`, `M` or `L`, with `Covers`
  naming the D sections they implement. An existing ticket number the source names goes into the
  Ticket cell; otherwise it is `—`.
- **Ids are kept.** A source that already uses this standard's ids (`D3`, `P2`, `P2.1`) keeps them
  exactly; everything new takes the next unused number. Nothing is renumbered, so an id is never
  reused.
- **Nothing is guessed.** What the agent cannot map (an unclear requirement, two sources that
  disagree, a "maybe one day") becomes an open question (`- [ ] …`) under the closest design
  section, to be answered before the design is approved.
- The design is always `version: 1`, `status: draft`; the plan is `design-version: 1`. Only a
  person approves the design (section 6).

**Applying.** The review shows one checkbox per section, phase and build, all ticked, with the
reason under each. On **Apply selected** the pane:

1. leaves out the unticked sections, phases and builds (a phase's builds go with it), strikes a
   left-out section from the other builds' `Covers` and a left-out build from their `Needs`, and
   keeps every other id as it is;
2. writes `design/DESIGN.md` and `design/PLAN.md`, or other names the person picks: an existing
   DESIGN.md or PLAN.md is **never overwritten** (Apply asks for another name or cancel and writes
   nothing);
3. sets the BOARD.md binding line (section 5) to the files written, creating `tickets/BOARD.md`
   from the template when there is none;
4. marks the proposal `applied`, and runs the roadmap's coverage checks.

The source files are never modified or deleted.

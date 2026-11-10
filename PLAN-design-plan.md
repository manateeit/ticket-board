# Ticket board 0.5: Design → Plan → Tickets (proposal)

Status: proposal for review, 2026-11-10. Once you approve it, this file is the brief for a
one-prompt build. Defaults marked **(default)** are what gets built unless you change them.

## 1. The idea in one paragraph

Today the board knows tickets and nothing above them, so "100% done" only means "every ticket
I happened to write is closed". 0.5 adds the two layers above tickets — a **design** (what we
are building and why, in numbered sections) and a **plan** (phases of builds that implement
those sections) — as plain Markdown files with a small, strict standard. Tickets point at the
plan item and design sections they serve. The pane then computes real progress: how much of the
plan is built, how much of the design is covered, which phase we are in, what is stale after a
redesign, and which tickets are off-plan. A blank folder opens on a **Start** screen that walks
from "no git, no GitHub, no idea written down" to brainstorm → design → plan → tickets. A running
project keeps today's board, with a roadmap summary under it and full Design and Plan views one
click away. Redesign and replan are first-class: they produce a reviewable change list, never a
silent rewrite.

## 2. What others do, and what we take

Research covered Google's Elephant-Goldfish Model (installed here), GitHub Spec Kit, AWS Kiro
specs, obra/superpowers, BMAD, Matt Pocock's skills, Taskmaster AI, ccpm, Agent OS and Shape Up.
None of them has the full chain requirement → plan → ticket → progress; most have one link.

| Borrowed idea | From | Where it lands |
|---|---|---|
| Swarm brainstorm with zero-context "goldfish" lenses, then a fresh-reader review of the draft | EGM | `/brainstorm` (uses EGM when installed), design review step |
| Ask one question at a time, look at the code first, offer 2–3 approaches, hard gate: no plan until the design is approved | superpowers brainstorming | `/design` session rules, "Approve design" gate |
| Plan self-review: every requirement has a task, no "TBD", plan not longer than its spec | superpowers writing-plans | deterministic coverage check in the pane, run after every plan write |
| `[NEEDS CLARIFICATION]` markers must be zero before tasks are generated | Spec Kit | design Open questions block "Approve" and "Create tickets" |
| Design-first workflow; EARS "WHEN … THE SYSTEM SHALL …" acceptance lines | Kiro | optional `Done when` style in design sections; carried into eval.md |
| Tracer-bullet tickets with blocking edges; grilling; glossary + ADRs | Pocock | ticket generation keeps `Needs` → `Blocked by`; `/design` grills; `design/decisions/` |
| Status computed by a script, zero LLM tokens; local files are the truth | ccpm | all progress is computed in `hooks/core/roadmap.ts` |
| Complexity score per task, `next` by dependency | Taskmaster | Size S/M/L weights progress; "Next up" picks the first unblocked item |
| Hill chart: uphill = still figuring out, downhill = executing; a dot that doesn't move is a raised hand | Shape Up | phase hill in the Plan view; appetite per phase |
| Learn-and-adjust loop back into planning ("correct course") | BMAD | replan proposal flow |

## 3. The file standard

One folder, `design/` **(default; matches what thalix-sdlc-factory already does)**. BOARD.md
names the files it is bound to, so older layouts (like `design/factory/plan.md`) work without
moving anything:

```
tickets/BOARD.md          gains one line under the title:
                          Design: design/DESIGN.md · Plan: design/PLAN.md
design/
  brief.md                brainstorm result: problem, users, concepts kept and cut (optional)
  DESIGN.md               the design, numbered sections D1…Dn
  PLAN.md                 the plan, phases P1…Pn with builds P1.1…
  brainstorms/2026-11-10-offline-sync.md     one file per brainstorm (whole concept or one item)
  changes/2026-11-10-design-v3.md            one note per redesign / replan (what changed, why)
  decisions/0001-router-in-one-session.md    ADRs, optional
```

The parser accepts upper or lower case names and any folder BOARD.md points at, so a project can
also keep several tracks (`design/factory/`, `design/card-flow/`) and switch between them.

### DESIGN.md

```markdown
---
design: Thalix SDLC Factory
version: 3              # bumped by every redesign
status: approved        # draft | approved — only a person approves
updated: 2026-11-10
---
# Thalix SDLC Factory: design

## Vision                 ← unnumbered sections are context: Vision, Problem, Users,
## Non-goals                Non-goals, Glossary, Constraints. Not counted for coverage.

## D1 · Router inside one session
Rev: 2                    ← bumped when this section's meaning changes
Why: …
What: …
Done when:
- WHEN a run starts THE SYSTEM SHALL start one router session for the intent
- …
### Open questions
- [ ] Does the router own merges or the merger agent?   ← same format as rd.md questions

## D2 · AI checker layer
Rev: 1
…
## D7 · ~~Remote workers~~
Status: dropped in v3 (see changes/2026-11-10-design-v3.md)  ← IDs are never reused
```

Rules: a `D` id is permanent; a dropped section stays, struck through. Unnumbered sections are
free prose. `Done when` lines become the starting point of each ticket's `eval.md`.

### PLAN.md

```markdown
---
plan: Thalix SDLC Factory
design-version: 3        # the design version this plan was made from → "plan is behind" banner
updated: 2026-11-10
---
# Thalix SDLC Factory: plan

## P1 · Control plane in miniature
Goal: routers reach the server only over its API.
Appetite: 2 weeks
Exit: a dry-run intent with 3 stories runs end to end.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Rename to thalix-sdlc-factory | M | — | D5 | no user-facing "kanban-web" … | 0001 |
| P1.2 | Router agent definitions | S | P1.1 | D1 | lint test checks frontmatter | 0002 |
| P1.3 | Run API for an external router | M | P1.1 | D1, D3 | spec tests drive a fake router | — |

## P2 · …
```

This is the factory's existing table plus `Covers` and `Ticket`. An optional `Status` column takes
only `deferred` or `dropped`; everything else is derived. One build may have several tickets
(`0004, 0016`).

### Ticket lines (rd.md)

Next to today's `Type:` line, two more, written by the ticket writer and editable in Properties:

```
Type: feature
Plan: P1.3
Design: D1@2, D3@1        ← section + the Rev it was written against
```

A ticket with no `Plan:` line is **off-plan** (fine for bugs and chores; shown, not punished).

## 4. How progress is computed

All in `hooks/core/roadmap.ts`, pure functions, no tokens, recomputed on every refresh.

- **Build state** from its tickets: no ticket → *not started*; any draft → *shaping*; ready →
  *queued*; in-progress / in-check → *building*; all done → *built*; blocked → *stuck*;
  `deferred` / `dropped` → excluded from totals.
- **Weights**: S = 1, M = 3, L = 8, unsized = 3.
- **Plan %** = weight of built builds ÷ weight of all counted builds. **Phase %** the same per
  phase. **Current phase** = first phase under 100%.
- **Design coverage** per section: *unplanned* (no build covers it) → *planned* → *building* →
  *built* (every covering build built) — or *stale* when a covering ticket says `D3@1` but the
  section is now `Rev: 2`. **Design %** = built sections ÷ numbered, non-dropped sections.
- **Hill position** per phase (Shape Up): uphill while it has open questions, drafts or builds
  with no ticket; over the top once every build has a ready ticket; downhill as they finish.
- **Checks** (run after every design or plan write, shown as alerts): plan older than design
  version · section with no build · build covering no section · build with no ticket · ticket
  pointing at a missing build · open design questions · stale tickets · off-plan count.

As built (ticket 0003): a ticket listed in a build's `Ticket` cell counts as on-plan even without
a `Plan:` line, so only tickets with neither are off-plan; a ninth check, *plan mismatch*, fires
when a ticket's `Plan:` line names a different build than the cell it is listed in; each check is
one alert listing every id it is about.

## 5. Sessions: brainstorm, design, plan, and their "re-" versions

Interactive work runs in the chat (it needs you); mechanical work runs as background agents the
pane starts, as ticket writing does today.

| Session | Started by | What happens | Writes |
|---|---|---|---|
| **Brainstorm** `/brainstorm [whole \| D3 \| P2 \| 0007]` | Start screen, or "Brainstorm" on a section, phase or ticket | With EGM installed **(default when present)**: runs `/egm:egm-brainstorm` with the item and its context. Without it: built-in version — an `elephant` agent holds the whole context (item, design, plan, code findings) for up to 3 rounds; each round it starts 4 goldfish agents in parallel with no shared context, one lens each (user, simplest thing, risk, what's missing), reads all four and decides what to keep, cut or re-ask (asking you between rounds when only a person can decide). The brief says which path ran. | `design/brainstorms/<date>-<slug>.md`; "Fold into design" button feeds it to `/design` |
| **Design** `/design` | Start screen, Design view | superpowers-style: reads the code first (blank repo: skips), asks one question at a time, offers 2–3 approaches, writes DESIGN.md. Then a fresh-reader agent (EGM `egm-review` if installed) reads only the file and adds Open questions — which you answer in the pane like ticket questions. | DESIGN.md (`status: draft`) |
| **Redesign** `/design D3` or `/design` on an approved design | Design view "Redesign" (whole or one section) | Same, scoped. Bumps `version` and each changed section's `Rev`, writes a change note. Never edits plan or tickets. | DESIGN.md, `changes/<date>-design-vN.md` |
| **Plan** `/planning` | after you press **Approve design** | Reads DESIGN.md, the code and BOARD.md; writes phases and builds; runs the coverage self-review and fixes gaps before finishing. | PLAN.md |
| **Create tickets** | Plan view: per build, per phase, or "all not started" | The pane starts one ticket-writer agent per build (today's AI job queue, 3 at a time). Each gets the build row, the covered design sections and their `Done when` lines. `Needs` become `Blocked by`. All tickets start as **draft** — only you flip to ready. | ticket folders + BOARD.md rows + PLAN.md `Ticket` cells |
| **Replan** `/planning` when the plan is behind | the "Plan is behind design v3" banner | Diffs design versions (via change notes and section Revs) against the plan. Produces a **proposal**, not edits: add build, change build, drop build, follow-up ticket for a done build that a change affects. You tick what to apply in a review screen; done tickets are never rewritten. | `changes/<date>-replan.md`, then PLAN.md + new draft tickets on Apply |
| **Drift check** (optional) | Design view menu | EGM `egm-drift-report` if installed, else one agent compares code to DESIGN.md; findings become design Open questions. | DESIGN.md questions |

New pieces: skills `brainstorm`, `design`, `planning` (`/plan` is a built-in command, hence
`planning`); agents `elephant` (holds the brainstorm context across rounds, keeps and cuts),
`goldfish` (one lens, no context, read-only), `fresh-reader`, `planner`; `ticket-writer`
and `/ticket` learn the `Plan:` / `Design:` lines. The writer guard keeps protecting BOARD.md;
DESIGN.md / PLAN.md edits are allowed only from these skills and the pane.

## 6. Screens

### 6.1 Start screen (no design and no plan bound)

Shown instead of the board when the project has no design, no plan **and** no tickets. A project
that already has tickets gets the board plus a dismissible banner "No design or plan yet → Set up".

```
┌ Start a project ─────────────────────────────────────── ticket-board ┐
│  ●──────○──────○──────○──────○                                        │
│  Setup  Idea   Design Plan   Tickets                                  │
│                                                                       │
│  ✓ Git repository          main · 0 commits                           │
│  ! No GitHub repository    [Create private repo on GitHub]  [Skip]    │
│      Tickets work locally; the router needs origin to open PRs.       │
│  ○ What are you building?                                             │
│    ┌───────────────────────────────────────────────────────────────┐ │
│    │ A booking app for small salons; owners hate phone tag…         │ │
│    └───────────────────────────────────────────────────────────────┘ │
│    [✨ Brainstorm it first]  [Go straight to design]                   │
│    [I already have docs… ]  → pick files; AI converts to the standard │
│    (existing code, no docs) [Draft a design from the code]            │
└───────────────────────────────────────────────────────────────────────┘
```

- Detection reads files only, so it works in the terminal and the desktop app: `.git/config`
  (origin remote, host), `.git/HEAD` (branch), worktree `.git` pointer files — the same reader
  that draws the project/repo header since 0.4.7 (`hooks/core/project.ts`). Plus design/plan
  bound or found, tickets/ present.
- Commands (`git init`, `gh repo create`, first push) are never run by the pane. Each button
  fills the prompt with the request ("initialise git here and make the first commit", "create a
  private GitHub repo with gh and push") and Claude runs it with its Bash tool when you press
  Enter, so you see and approve every command. **(default: private)**
- After each step the stepper advances; leaving and coming back resumes where you were.

### 6.2 Board (running project) — header tracker + roadmap summary

```
┌ Ticket board ────────────────────────── [Board] [Plan] [Design]  ● working ┐
│ ┌ Need you 2 ┐┌ Ready 3 ┐┌ In flight 1 ┐┌ Open bugs 0 ┐┌ ◔ Plan 46% ─────┐│
│ └────────────┘└─────────┘└─────────────┘└─────────────┘│ P2 of 4 · D 5/9 ││
│                                                        └─────────────────┘│
│  … today's tabs, filters, table (now with a Phase column + phase filter) … │
│                                                                            │
│ ┌ Roadmap ─────────────────────────────────────────────── Open plan › ──┐ │
│ │  P1 Foundations ███████ ✓  P2 Build loop ████░░ 60%  P3 ░░░  P4 ░░░    │ │
│ │  Now: P2 · Build loop — 3 of 5 builds built · next up P2.4 (no ticket) │ │
│ │  ⚠ Plan is behind design v3 [Replan]   ⚠ D7 has no build   2 off-plan  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Board notes · BOARD.md ─ (as today) ────────────────────────────────────┐ │
```

The "Done %" tile becomes **Plan %** (falls back to ticket % when no plan exists). The phase rail
is a non-interactive SVG (no scroll capture), each segment a link button underneath.

### 6.3 Plan view

```
Plan · made from design v3 · updated 2026-11-10        [List | Timeline]  [Replan]
 P1 · Foundations   ████████ 100%  Appetite 2 wk   Exit: dry-run intent runs end to end
 ▾ P2 · Build loop  █████░░░  60%  ⛰ over the hill   [Create tickets for P2] [Brainstorm]
   #     Build                       Size Needs Covers   Ticket            State
   P2.1  One run per intent           L   P1.4  D1 D4    0016 ✓ done       built
   P2.2  One Accept per intent        L   P2.1  D4       0017 ● in-progress building
   P2.4  Clearance on the run         M   P1.4  D6       + Create ticket   not started
 ▸ P3 · Option B  ░░░░ 0%
```

- **Timeline** toggle: lanes per phase with dependency arrows between builds and a hill chart
  with one dot per phase (static SVG).
- Clicking a ticket pill opens the ticket page; a `D` chip opens that design section.

### 6.4 Design view

```
Design · v3 · approved 2026-11-10     Built 5 of 9 sections ███████░░   [Redesign] [Drift check]
 ┌ Sections ─────┐ ┌ D1 · Router inside one session ─────────── ● built · Rev 2 ┐
 │ ● D1 Router    │ │ Why / What / Done when — rendered like the ticket page     │
 │ ◐ D4 Accept    │ │ Implemented by  P1.2 → 0002 ✓   P1.4 → 0004 ✓           │
 │ ○ D6 Clearance │ │ [✨ Brainstorm this] [Redesign this section]              │
 │ ⚠ D3 stale     │ └──────────────────────────────────────────────────────────┘
 │ – D7 dropped   │ ┌ Open questions (2) ─ answered inline, same as tickets ───┐
 └───────────────┘ └──────────────────────────────────────────────────────────┘
 History: v3 2026-11-10 dropped D7, changed D3 · v2 … (from design/changes/)
```

"Approve design" appears while `status: draft`, disabled until no open questions remain.

### 6.5 Ticket page

Properties gain **Plan item** (P2.2, click → Plan view) and **Design** chips (D4, click → section).
A stale ticket shows "Written against D3 rev 1, now rev 2 — [Review]".

### 6.6 Replan review

A list of proposed changes with a checkbox each, grouped Add / Change / Drop / Follow-up, the
reason under each, and **Apply selected** — the same review pattern as answering questions.

Terminal layout gets the compact version: a `Plan 46% · P2 60% · design v3 (plan behind)` line,
keys `p` and `d` for plain-text plan and design lists, and Start steps as a numbered list.

## 7. Build plan (what the one-prompt launch does)

Each milestone ends with typecheck + `claude plugin test .` green; publish at the end as 0.5.0.

| # | Build | Size | Done when |
|---|---|---|---|
| M1 | `docs/STANDARD.md` (the format in section 3) + templates `design.md`, `plan.md`, `brief.md`, `change.md` | S | standard reads complete; templates parse with the M2 parser |
| M2 | `hooks/core/roadmap.ts`: `parseDesign`, `parsePlan`, `bindFromBoard`, `linkTickets`, `progress`, `coverage`, `checks`; `ticket.ts` reads `Plan:` / `Design:` | M | unit tests on a blank project, a full fixture, and a copy of the factory's `design/factory/plan.md` shape |
| M3 | Project detection + Start screen (desktop and terminal) | M | pane tests: blank folder shows Start; folder with tickets shows board + banner |
| M4 | Skills `brainstorm` (EGM bridge + built-in elephant and goldfish fallback), `design`, `planning`; agents `elephant`, `goldfish`, `fresh-reader`, `planner`; ticket-writer and `/ticket` write `Plan:` / `Design:` | M | `claude plugin validate` passes; skill text reviewed against section 5 |
| M5 | Header Plan % tile, Roadmap summary card, Phase column + filter, ticket Properties links | M | pane tests on the fixture |
| M6 | Plan view (list + timeline/hill SVG) and Design view (sections, coverage, questions, approve gate) | L | pane tests: navigate Board → Plan → ticket → Design and back |
| M7 | Create tickets from builds (batch jobs), redesign change notes + stale detection, replan proposal review/apply | L | test: applying a proposal edits PLAN.md and adds draft tickets; done tickets untouched |
| M8 | "I already have docs" adopt flow (AI converts to the standard, you review), `examples/demo-roadmap`, README, publish 0.5.0 | M | demo project opens with a populated roadmap |

Not in 0.5: GitHub issues sync for plan items, multiple people editing at once, estimates in time.

## 8. Decisions for you (defaults apply if you say nothing)

1. Folder: **`design/` (default)** or `docs/`.
2. New GitHub repos: **private (default)**, created through the chat so you see the command.
3. EGM: **optional — used when installed, built-in fallback otherwise (default)**, or required.
4. Try it on thalix-sdlc-factory: **adopt its `design/factory/` by adding the BOARD.md binding
   line and `Covers` / `Ticket` columns, after you review the change (default: ask first)**.

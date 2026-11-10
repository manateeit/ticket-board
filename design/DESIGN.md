---
design: Ticket board
version: 1
status: draft
updated: 2026-11-10
---
# Ticket board: design

This is the design for ticket board 0.5, written in the standard of `docs/STANDARD.md`. It is
taken from the proposal in `PLAN-design-plan.md` and adds no new requirements.

## Vision
Today the board knows tickets and nothing above them, so "100% done" only means "every ticket I
happened to write is closed". 0.5 adds the two layers above tickets, a design (what we are
building and why, in numbered sections) and a plan (phases of builds that implement those
sections), as plain Markdown files with a small, strict standard. Tickets point at the plan item
and design sections they serve. The pane computes real progress from them. A blank folder opens
on a Start screen that walks from "no git, no GitHub, no idea written down" to brainstorm,
design, plan and tickets. A running project keeps today's board, with a roadmap summary under it
and full Design and Plan views one click away. Redesign and replan are first-class: they produce
a reviewable change list, never a silent rewrite.

## Problem
Progress on the board only measures the tickets someone happened to write. Nothing says how much
of the intended product is built, which phase the work is in, what went stale after a redesign,
or which tickets belong to no plan. A new project also has no guided path from an idea to a first
ticket.

## Non-goals
Not in 0.5:
- GitHub issues sync for plan items.
- Several people editing the design or plan at once.
- Estimates in time (sizes S, M and L only weight progress).

The pane never runs `git init`, `gh repo create` or a first push itself; see Constraints.

## Constraints
Defaults taken from the proposal's decisions (section 8):
- The design files live in `design/` (not `docs/`); BOARD.md names the files it is bound to.
- New GitHub repositories are private by default, created through the chat so the person sees
  and approves the command.
- EGM is optional: used when installed, with a built-in fallback otherwise.
- Trying the standard on thalix-sdlc-factory (adopting its `design/factory/`) is done only after
  the person reviews the change.
- Only a person approves a design; agents never set `status: approved`.
- All progress is computed by pure functions in `hooks/core/roadmap.ts`: no tokens, recomputed on
  every refresh.

## D1 · File standard
Rev: 1
Why: A script and a person must read the same two files, so the format has to be small and strict.
What: One folder, `design/`, holds `DESIGN.md` (numbered sections D1…Dn) and `PLAN.md` (phases
P1…Pn with builds P1.1…), plus optional brief, brainstorms, changes and decisions. BOARD.md gains
one binding line under the title naming the files it is bound to, so other layouts and several
tracks work without moving anything. Names are read in upper or lower case. Tickets gain a
`Plan:` line (one build id) and a `Design:` line (sections with the Rev each was written
against); a ticket with no `Plan:` line is off-plan, shown and not punished. A `D` id is
permanent and a dropped section stays, struck through. Unnumbered sections are free prose, not
counted for coverage. The Plan table is the factory's existing table plus `Covers` and `Ticket`,
with an optional `Status` column that takes only `deferred` or `dropped`.
Done when:
- `docs/STANDARD.md` and the templates `design.md`, `plan.md`, `brief.md` and `change.md` read as complete and the templates parse with the roadmap parser
- WHEN BOARD.md carries a binding line THE SYSTEM SHALL read the design and plan from the paths it names
- WHEN a ticket has no `Plan:` line THE SYSTEM SHALL show it as off-plan
- WHEN a ticket's `Design:` line names a section at a lower Rev than the section now has THE SYSTEM SHALL treat the ticket as stale

## D2 · Progress computation
Rev: 1
Why: "Done" must mean built against the plan and the design, not closed tickets.
What: All progress lives in `hooks/core/roadmap.ts` as pure functions. A build's state comes from
its tickets: no ticket is not started; any draft is shaping; ready is queued; in-progress or
in-check is building; all done is built; blocked is stuck; `deferred` and `dropped` builds are
excluded from totals. Weights are S = 1, M = 3, L = 8, unsized = 3. Plan % is the weight of built
builds over all counted builds, phase % the same per phase, and the current phase is the first
phase under 100%. Design coverage per section runs unplanned, planned, building, built (every
covering build built), or stale when a covering ticket says `D3@1` but the section is now
`Rev: 2`; design % is built sections over numbered, non-dropped sections. Hill position per phase
is uphill while it has open questions, drafts or builds with no ticket, over the top once every
build has a ready ticket, and downhill as they finish. Checks run after every design or plan
write: plan older than design version, section with no build, build covering no section, build
with no ticket, ticket pointing at a missing build, open design questions, stale tickets and the
off-plan count.
Done when:
- WHEN a refresh happens THE SYSTEM SHALL recompute build state, plan %, phase %, design coverage, hill position and checks from the files and tickets, using no model tokens
- WHEN a build has no ticket THE SYSTEM SHALL report it as not started
- WHEN every ticket of a build is done THE SYSTEM SHALL report the build as built
- WHEN a build is marked `deferred` or `dropped` THE SYSTEM SHALL leave it out of every total
- WHEN a section is covered by a ticket written against an older Rev THE SYSTEM SHALL report the section as stale
- WHEN the plan's `design-version` is lower than the design's `version` THE SYSTEM SHALL raise a "plan is behind" check
- Unit tests cover a blank project, a full fixture and the shape of the factory's `design/factory/plan.md`

## D3 · Start screen
Rev: 1
Why: A blank folder has no board worth showing; it needs a path from nothing to a first ticket.
What: A Start screen replaces the board when the project has no design, no plan and no tickets.
A project that already has tickets gets the board plus a dismissible banner "No design or plan
yet, Set up". The screen has a stepper (Setup, Idea, Design, Plan, Tickets), shows whether there
is a git repository and a GitHub origin, and offers to brainstorm, go straight to design, adopt
existing docs, or draft a design from existing code. Detection reads files only (`.git/config`,
`.git/HEAD`, worktree `.git` pointer files, the bound design and plan, `tickets/`) through the
reader behind the project header (`hooks/core/project.ts`), so it works in the terminal and the
desktop app. The pane never runs commands: each button fills the prompt with the request and
Claude runs it with its Bash tool when the person presses Enter. After each step the stepper
advances and coming back resumes where the person was. The terminal layout shows the steps as a
numbered list.
Done when:
- WHEN a folder has no design, no plan and no tickets THE SYSTEM SHALL show the Start screen instead of the board
- WHEN a folder has tickets but no design or plan THE SYSTEM SHALL show the board with a dismissible "No design or plan yet" banner
- WHEN a button on the Start screen is pressed THE SYSTEM SHALL fill the prompt with the request and run nothing itself
- WHEN a step is finished THE SYSTEM SHALL advance the stepper, and WHEN the person returns THE SYSTEM SHALL resume at the current step
- Pane tests cover a blank folder and a folder with tickets, in desktop and terminal layouts

## D4 · Brainstorm, design and planning sessions
Rev: 1
Why: Interactive work needs the person and runs in the chat; the files it writes must follow the standard.
What: Three skills, `brainstorm`, `design` and `planning` (`/plan` is a built-in command, hence
`planning`), and three agents, `goldfish`, `fresh-reader` and `planner`. Brainstorm
(`/brainstorm [whole, D3, P2 or 0007]`) runs EGM's brainstorm when installed, otherwise a
built-in version with four goldfish agents with no shared context, one lens each (user, simplest
thing, risk, what is missing), then a synthesis that keeps and cuts concepts; it writes
`design/brainstorms/<date>-<slug>.md` and a "Fold into design" button feeds it to `/design`.
Design (`/design`) reads the code first (skipped on a blank repo), asks one question at a time,
offers 2 to 3 approaches and writes `DESIGN.md` as `status: draft`; then a fresh-reader agent
reads only the file and adds Open questions, which are answered in the pane like ticket
questions. Plan (`/planning`) runs after the person presses Approve design, reads `DESIGN.md`,
the code and BOARD.md, writes phases and builds, and runs the coverage self-review and fixes gaps
before finishing. The ticket-writer agent and `/ticket` learn the `Plan:` and `Design:` lines.
The writer guard keeps protecting BOARD.md; DESIGN.md and PLAN.md edits are allowed only from
these skills and the pane.
Done when:
- `claude plugin validate` passes with the new skills and agents
- WHEN EGM is installed THE SYSTEM SHALL run its brainstorm for `/brainstorm`, and WHEN it is not THE SYSTEM SHALL use the built-in four-lens version
- WHEN `/design` finishes THE SYSTEM SHALL have written `DESIGN.md` with `status: draft`
- WHEN a design is not approved THE SYSTEM SHALL NOT start `/planning`
- WHEN `/planning` finishes THE SYSTEM SHALL have run the coverage check and fixed gaps in `PLAN.md`
- WHEN a ticket is written for a build THE SYSTEM SHALL include the `Plan:` and `Design:` lines
- The skill text is reviewed against the session table of the proposal

## D5 · Board roadmap summary and ticket links
Rev: 1
Why: The running board should show real progress at a glance without leaving the ticket table.
What: The header "Done %" tile becomes Plan % with the current phase and design coverage (falling
back to ticket % when there is no plan). Under the table sits a Roadmap card: a phase rail drawn
as a non-interactive SVG with a link button under each segment, the current phase and next-up
build, and the alerts from the checks (plan behind design, section with no build, off-plan
count). The ticket table gains a Phase column and a phase filter. The ticket page Properties gain
a Plan item (click opens the Plan view) and Design chips (click opens the section), and a stale
ticket shows "Written against D3 rev 1, now rev 2" with a Review action.
Done when:
- WHEN a plan is bound THE SYSTEM SHALL show Plan % in the header tile, and WHEN none is bound THE SYSTEM SHALL fall back to ticket %
- WHEN the board is shown with a plan THE SYSTEM SHALL show the Roadmap summary card with phase rail, current phase, next-up build and check alerts
- WHEN a ticket has `Plan:` or `Design:` lines THE SYSTEM SHALL show them as links in its Properties
- WHEN a ticket is stale THE SYSTEM SHALL show which section and Rev it was written against
- Pane tests cover the fixture project

## D6 · Plan and Design views
Rev: 1
Why: The files need a readable, navigable form so people can follow the plan and design without opening Markdown.
What: The Plan view lists phases with percent, appetite and exit, each build with size, needs,
covers, ticket pill and derived state, and has Create tickets and Brainstorm actions per phase.
A Timeline toggle shows lanes per phase with dependency arrows and a hill chart with one dot per
phase (static SVG). Clicking a ticket pill opens the ticket page and a D chip opens that design
section. The Design view shows version, status and approval date, built sections over total,
a section list with coverage marks, the selected section rendered (Why, What, Done when) with
the builds and tickets that implement it, its open questions answered inline, a history from
`design/changes/`, and Redesign and Drift check actions. "Approve design" appears while the
status is `draft` and stays disabled until no open questions remain.
Done when:
- WHEN the Plan view opens THE SYSTEM SHALL list every phase and build with its derived state, and WHEN Timeline is chosen THE SYSTEM SHALL show lanes, dependency arrows and the hill chart
- WHEN a ticket pill or a D chip is clicked THE SYSTEM SHALL open that ticket page or design section
- WHEN the Design view opens THE SYSTEM SHALL list sections with their coverage state and show the selected section with the builds and tickets that implement it
- WHEN the design is `draft` and has open questions THE SYSTEM SHALL show Approve design disabled
- Pane tests navigate Board, Plan, ticket and Design and back

## D7 · Tickets from the plan, redesign and replan
Rev: 1
Why: Redesign and replan must produce changes a person reviews, never a silent rewrite.
What: Create tickets works per build, per phase or for all not-started builds. The pane starts
one ticket-writer agent per build through today's AI job queue, three at a time; each gets the
build row, the covered design sections and their Done when lines; `Needs` become `Blocked by`;
all tickets start as draft and only the person flips them to ready; the build's `Ticket` cell
is updated. Redesign (`/design D3` or `/design` on an approved design, whole or one section)
bumps `version` and each changed section's `Rev`, writes `changes/<date>-design-vN.md` and never
edits the plan or tickets. Replan (`/planning` when the plan is behind, started from the
"Plan is behind" banner) diffs design versions against the plan and writes a proposal in
`changes/<date>-replan.md`: add build, change build, drop build, or a follow-up ticket for a done
build that a change affects. The Replan review lists the proposed changes grouped Add, Change,
Drop and Follow-up, each with a checkbox and a reason, and Apply selected edits `PLAN.md` and adds
new draft tickets. Done tickets are never rewritten. The drift check (EGM drift report if
installed, else one agent comparing code to `DESIGN.md`) turns findings into design Open
questions.
Done when:
- WHEN Create tickets runs for a build THE SYSTEM SHALL create a draft ticket, add its BOARD.md row and fill the build's `Ticket` cell, with `Needs` as `Blocked by`
- WHEN a redesign finishes THE SYSTEM SHALL have bumped `version` and the changed sections' `Rev` and written a change note, and left the plan and tickets unchanged
- WHEN the plan is behind the design THE SYSTEM SHALL offer Replan and produce a proposal without editing the plan
- WHEN selected proposals are applied THE SYSTEM SHALL edit `PLAN.md` and add draft tickets, and leave done tickets untouched
- A test applies a proposal and checks that `PLAN.md` changed, new tickets are drafts and done tickets are unchanged

## D8 · Adopt existing docs, demo and release
Rev: 1
Why: Existing projects must reach the standard without retyping, and the feature needs a demo and a release.
What: An "I already have docs" flow on the Start screen lets the person pick files; an AI job
converts them to the standard and the person reviews the result before it is kept. An example
project `examples/demo-roadmap` shows a populated roadmap. The README documents the roadmap,
the standard and the demo, and version 0.5.0 is published.
Done when:
- WHEN existing docs are picked on the Start screen THE SYSTEM SHALL convert them to `DESIGN.md` and `PLAN.md` in the standard and leave them for the person to review
- WHEN `examples/demo-roadmap` is opened THE SYSTEM SHALL show a populated roadmap
- The README describes the roadmap, the standard and the demo, and 0.5.0 is published

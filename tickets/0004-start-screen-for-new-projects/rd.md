# 0004 — Start screen for new projects

Type: feature

## What
Milestone M3 of `PLAN-design-plan.md` (section 6.1). When a project has no design, no plan and no tickets, the pane shows a **Start screen** instead of the board: a stepper Setup → Idea → Design → Plan → Tickets with git and GitHub status and ways to begin. Detection reads files only, so it works in the terminal and the desktop app. Buttons never run commands; they fill the prompt so the person approves every command Claude runs.

## Behaviour
- Detection (extends `loadProject`/`Project` in the project reader): git repo present, branch, origin remote and host (already read), whether the repo has any commit (read `.git` refs files only), design and plan found or bound, `tickets/` has ticket folders or rows. Design and plan come from the roadmap parser of 0003 (the `Design:` / `Plan:` line in BOARD.md, else `design/DESIGN.md`, `design/PLAN.md`, any case). No process is spawned.
- Start screen shows when there is no design, no plan and no ticket folders or board rows. A blank folder (no BOARD.md) shows Start, not the old "No ticket board here yet" screen; Start keeps a small "Set up board only" button that does what Set up board does today.
- Stepper: Setup, Idea, Design, Plan, Tickets. The current step is computed from the files each time, so leaving and coming back resumes where the person was. Nothing extra is stored for the stepper.
- Setup step lines: Git repository (`✓ main · 0 commits` or `! not a git repo` with a button), GitHub repository (`✓ owner/repo` or `! No GitHub repository` with a button and **Skip**, plus the note that tickets work locally and the router needs origin to open PRs). A non-GitHub origin counts as set up. Skip is remembered per project in the pane store and the line then shows "skipped".
- Setup buttons fill the prompt, never run anything: "initialise git here and make the first commit"; "create a GitHub repo with gh and push"; "make the first commit and push". The note under each says Claude will ask before running the command.
- Idea step: a text box "What are you building?" and buttons **Brainstorm it first** (fills `/brainstorm` plus the idea), **Go straight to design** (fills `/design` plus the idea) and, when the folder has code but no docs, **Draft a design from the code**. They are disabled until the box has text (the code button needs none). The skills themselves arrive in ticket 0005.
- Existing project, tickets present and no design or plan: the board shows with a dismissible banner "No design or plan yet → Set up". Set up opens the Start screen. Dismissal is remembered per project.
- Terminal layout: same content as plain text, steps as a numbered list, same buttons and hotkeys; no SVG needed.
- Error cases: unreadable `.git` shows "git status unknown" rather than failing; a busy prompt box shows the existing "copy this instead" message.

## Scope
In: detection, Start screen (desktop and terminal), banner, prompt-filling buttons, pane tests, README.
Out: running any command from the pane; the brainstorm, design and planning skills (0005); design/plan views and progress (0006, 0007); the "I already have docs" adopt flow (0009); parsing design or plan files beyond finding them (0003).

## Touchpoints
- `hooks/core/project.ts` — pure helpers for commit presence and the "which step" decision (keeps unit-testable, no I/O).
- `hooks/store.ts` — `loadProject` (reads git files), `Snapshot`/`View`, dismissal and skip flags via `$.store` (like `loadFilters`), `S` state and `resetSession`.
- `hooks/views.tsx` — `drawPane`, `setupView` (replaced by Start when nothing exists), terminal Start view, `fill()` helper for the buttons.
- `hooks/desk.tsx` — desktop Start card, banner above the board in `deskBoard`.
- `hooks/register.tsx` — auto-open currently needs a board; a Start-state project must open too.
- `hooks/core/roadmap.ts` — from 0003 (design/plan detection).
- `tests/core.test.ts`, `tests/pane.test.tsx` — `boot()` fake fs; add blank-folder and tickets-present cases for both surfaces.

## Docs
- `README.md` — add a "Start screen" part to "The pane, view by view" and mention the banner; update "Contents", the intro sentence that the pane opens "in a project with a board", and the Troubleshooting entry if it says the pane needs a board.
- `PLAN-design-plan.md` — no change: it is the source proposal.
- `CHANGELOG`/version notes: none exist in the repo; bump nothing.

## Open questions
- The person asked for this to be "the first screen that comes up" when there is no design and plan; the proposal shows it only when there are also no tickets and gives existing projects a dismissible banner. Which? [Start screen whenever no design/plan | only when no tickets, banner otherwise]
- Should new GitHub repos be private by default? [private (default) | public | ask each time]

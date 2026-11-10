# ticket-board

A Claude Code mod that shows your ticket board, `tickets/BOARD.md`, and its tickets in a side pane next to the chat. You can browse, sort and filter tickets, open one to read its `rd.md` and `eval.md`, answer its open questions, move it from **draft** to **ready**, create new tickets that an AI writer turns into complete build-ready tickets, and hand ready tickets to your router with one button.

It works with the plain-markdown ticket workflow used by the Claude Code super-agent setup (a router that runs workers and checkers):

```
tickets/
  BOARD.md                       ← the board: one table row per ticket
  TEMPLATE/rd.md, TEMPLATE/eval.md
  0007-fix-login-redirect/
    rd.md                        ← what the change must do (What, Behaviour, Scope, Touchpoints, Open questions)
    eval.md                      ← how a checker verifies it (Checks, Not checked by automation)
```

Status flow: `draft` → `ready` → `in-progress` → `in-check` → `done`, and any status → `blocked`.

The files stay the single source of truth. The pane reads them and changes them in small, exact edits, so the router, the workers, git and you editing by hand all keep working as before.

---

## Contents

1. [Install](#install)
2. [Quick start](#quick-start)
3. [The pane, view by view](#the-pane-view-by-view) (including the [project header and README](#project-header-and-readme) and the [Start screen](#start-screen) for new projects)
4. [Answering open questions](#answering-open-questions)
5. [Draft → ready (and the ready check)](#draft--ready-and-the-ready-check)
6. [Creating a ticket with the AI writer](#creating-a-ticket-with-the-ai-writer)
7. [Run this ticket](#run-this-ticket)
8. [Using it with the super-agent router](#using-it-with-the-super-agent-router)
9. [The `/board` command and keys](#the-board-command-and-keys)
10. [Settings](#settings)
11. [How it edits your files](#how-it-edits-your-files)
12. [Troubleshooting](#troubleshooting)
13. [Development](#development)

---

## Install

In Claude Code:

```
/plugin marketplace add manateeit/ticket-board
/plugin install ticket-board@ticket-board
```

Or from a terminal:

```bash
claude plugin marketplace add manateeit/ticket-board
claude plugin install ticket-board@ticket-board
```

Restart the session (or run `/reload-plugins`). You need a Claude Code version with mods (hooks modules and panes).

The plugin includes:

| Part | What it is |
|---|---|
| The pane | The side panel, opened with `/board`. |
| `/board` | A slash command to open the pane, or open it on one ticket. |
| `ticket` skill | The `/ticket` ticket-writing rules plus the `TEMPLATE/` files, so `/ticket-board:ticket <idea>` works in any project. If your project has its own `.claude/skills/ticket`, the pane uses that one. |
| `ticket-writer` agent | The background AI that writes and improves tickets for the pane. It can only write `rd.md` and `eval.md` inside the one ticket folder it was given. When a ticket comes from a plan build it adds `Plan: P2.3` and `Design: D1@2, D3@1` lines under `Type:` (so does `/ticket`). |
| `brainstorm` skill | `/ticket-board:brainstorm [whole \| D3 \| P2 \| 0007]` brainstorms the whole idea, a design section, a plan phase or a ticket and writes `design/brainstorms/<date>-<slug>.md` (problem, users, kept, cut, open questions). Uses EGM's `/egm:egm-brainstorm` when EGM is installed, else the built-in elephant and goldfish agents; the brief says which path ran. Never edits the design, plan or tickets. |
| `design` skill | `/ticket-board:design` reads the code, asks one question at a time, offers 2–3 approaches and writes `design/DESIGN.md` (`status: draft`); a fresh reader (EGM `egm-review` when installed) then adds open questions you answer in the pane. `/ticket-board:design D3`, or `/design` on an approved design, is a redesign: it bumps `version` and section `Rev`s and writes `design/changes/<date>-design-vN.md`, never touching the plan or tickets. `/ticket-board:design <brief>` folds a brainstorm in. |
| `planning` skill | `/ticket-board:planning` (after you approve the design) writes `design/PLAN.md`: phases and sized builds, with a coverage self-review that fixes gaps. When the plan is behind the design it writes only a replan proposal, `design/changes/<date>-replan.md` (add, change, drop build, follow-up ticket); done tickets are never rewritten. |
| `elephant` agent | Runs the built-in brainstorm: holds the whole context for up to 3 rounds, starts 4 goldfish per round and decides what to keep, cut or re-ask, then writes the brief. |
| `goldfish` agent | One brainstorm lens (user, simplest thing, risk, what's missing) with no shared context. Read-only. |
| `fresh-reader` agent | Reads only DESIGN.md and returns the questions a stranger would have, per section. Read-only. |
| `planner` agent | Drafts PLAN.md and runs the coverage review for `/ticket-board:planning`, or writes the replan proposal. |

## Quick start

1. Open a project that has `tickets/BOARD.md`, or any project.
2. Run `/board`.
   - In a new project (no design, no plan and no tickets yet) `/board` opens the [Start screen](#start-screen), which walks you from git and GitHub to an idea, a design, a plan and tickets. Its small **Set up board only** button creates `tickets/BOARD.md` (an empty table with the usual legend) and `tickets/TEMPLATE/` and takes you straight to the board.
3. Press **+ New ticket**, describe what you want, and press **Create draft + enhance with AI**.
4. When the AI finishes, answer its open questions in the pane, press **✓ Mark ready**, then **▶ Run this ticket**.

To try it without touching a real project, copy the demo board:

```bash
cp -R ~/.claude/plugins/marketplaces/ticket-board/examples/demo-board /tmp/demo && cd /tmp/demo && claude
```

Then run `/board`. The demo has one ticket of each kind: done, ready (waiting on a blocker), draft with open questions, and blocked.

## The pane, view by view

The pane opens beside the chat. When a session starts, it opens on its own only in a project that has a `tickets/` folder (with or without `BOARD.md`): on the board when there is one, and on the [Start screen](#start-screen) when there is no `BOARD.md` yet or no design, no plan and no tickets. A folder without `tickets/` never opens the pane on its own, even when it is blank; run `/board` there to see Start. You can turn auto-open off in [Settings](#settings). On a surface with no room for a side panel, it only opens when you run `/board`.

It re-reads the board every few seconds while it is open, and right after any tool writes into `tickets/`, so changes from the router, workers or your editor show up without a refresh.

**Desktop layout.** In the Claude desktop app the pane is a professional tracker drawn in one dark glass container (it paints its own background, so it looks the same on any app theme). In the terminal it uses compact views in your terminal's colors.

- **Board.** A title bar with *+ New ticket*, *Refresh* and *▶ Run ready (N)*; five numbers (Need you, Ready to run, In flight, Open bugs, and **Plan %**) and a status bar; status tabs with counts (All, Needs me, Open, Draft, Ready, …); type filters (Features, Bugs, Chores); a mode filter, a phase filter (when there is a plan) and search. **Plan %** is the share of the plan's build weight that is built (S = 1, M = 3, L = 8; every counted build is in the total, including builds with no ticket yet, so a plan with few tickets reads low). Its sub-line reads `P2 of 4 · D 5/9 · tickets 60%`: the current phase of the phase count, the design sections built of the numbered, non-dropped ones (left out when there is no design), and the share of tickets done beside it, so the gap shows. A project with no plan keeps the old fifth number, **Done** = the share of tickets done (`N of M`). **Activity.** A strip across the top of every desktop view shows what the session is doing: a spinner and a moving light bar while Claude works (with the kind of step, e.g. "Running a command" or "Editing files", and when the turn started), how many agents are running, and how many tickets the AI writer is drafting. When nothing runs it shrinks to a quiet "Claude is idle". The pane's tab also reads `Tickets · ● working` while anything runs, so you can expand the pane to full size and still see that work is going on.

**Hide done.** Next to the type buttons, **Hide done** (key `h` in the terminal) drops done tickets from every tab except Done itself, and is remembered per project.

**Agents.** The **Agents** button in the title bar (key `a`) shows a count of running agents and opens a panel just below the summary tiles: every subagent or teammate this session is running (with its ticket, when it names one, and a Watch button), the tickets the board says are in flight, and the last few agents that finished. A router running in a different session shows up through the In flight tickets.

Tickets are a **table** — ID, Type, Title, Phase (when there is a plan), Status, Result (a one-word tag from the board's notes: Merged, Decided, From GitHub, Failing…), Depends on, Questions, Updated and one next-step button per row (*Answer 2*, *✓ Ready*, *▶ Run*, *Unblock*). Click any column header to sort, again to reverse; sorting by Status groups the rows. The text around the table on BOARD.md is shown below it as *Board notes*.

**Roadmap.** When the board is bound to a plan (the `Design: … · Plan: …` line under the BOARD.md title, else `design/DESIGN.md` and `design/PLAN.md`; format in [docs/STANDARD.md](docs/STANDARD.md)), a **Roadmap** card sits above *Board notes*. It has a phase rail (one segment per phase, filled to the phase's %, a check mark at 100%; a static picture that never captures scrolling) with a link per phase underneath that sets the phase filter (press it again to clear it); a *Now* line with the current phase, *N of M builds built* and *next up P2.4 (no ticket)* (the first unbuilt build whose needs are built; left out once the plan is complete); and one short warning line per roadmap check, for example *Plan is behind design v3*, *D7 has no build*, *Open design questions in D4*, *3 builds have no ticket: …*, *1 stale ticket: 0005* and *2 off-plan* (tickets linked to no build). With no plan the card is not drawn. A plan file that cannot be read (no phase or build table in it, or the file BOARD.md names is missing) never breaks the board: it shows as with no plan, plus one warning line. The Plan and Design views, and the *Open plan*, *Replan* and *Review* buttons, come in a later release.
- **Ticket.** A breadcrumb back to the board and *Prev / Next* through the current filtered list; the type, status and mode; a progress stepper (Draft → Ready → In progress → In check → Done); one primary action (*Answer questions*, *Mark ready* or *Run*) plus *Enhance with AI* and *Discuss in chat*. The left column holds the full progress notes from BOARD.md, the open questions (answer inline, *Suggest an answer*), the ready check and the ticket itself with *Requirements* (rd.md) and *Acceptance checks* (eval.md) tabs. The right column is a **Properties** panel where you change the type, mode and dependencies, see the plan item and design chips (when there is a plan), the owner and folder, and block or hand-fix the status.
- **New ticket.** Pick Feature, Bug or Chore, give an optional title and a description (the placeholder tells you what a good bug report or feature request contains), set mode and dependencies, then *Create + AI enhance*.

**Types.** Each ticket is a feature, a bug or a chore. The type is the `Type:` line under the title in rd.md (the AI writer and the /ticket skill keep it); tickets without one are guessed from the title ("Fix …" → bug, "Rename …" → chore, otherwise feature).

### Project header and README

Above every view the pane names the project you are in.

- **Desktop:** a **PROJECT** card with the project's name (the README's title, else `package.json`'s name, else the folder), a short summary from the README's first paragraph (else `package.json`'s description), the repo (`⎇ owner/repo`, a link when it is on GitHub; *local git · no origin remote* or *not a git repository* otherwise) and `· branch <name>`. When the session runs in a linked worktree, a line says the board is read from the main checkout. The card's buttons are **Colors** and **README**.
- **Terminal:** one line, `Project · owner/repo · branch`, with a **README** button after it, above the board, Start, a ticket, its questions and the new-ticket form.

**README** (key `o`) opens the **README view**: README.md rendered, with a back button. In the desktop app it also has **↻** (key `r`, reload) and **✨ Ask Claude to update it**, which puts a request in your prompt box to bring README.md up to date with the project and `tickets/BOARD.md`. While the README is open the header button reads **‹ Board**; pressing it, or `o` again, takes you back to the board. With no README.md the desktop button reads **README (none)** and the view shows a *No README* card with **✨ Ask Claude to write a README**; the terminal says *This project has no README.md yet.*

### Start screen

A project with no design, no plan and no tickets (no ticket folders and no board rows) opens on **Start** instead of the board. A blank folder with no `BOARD.md` at all shows Start too.

- **Stepper:** Setup → Idea → Design → Plan → Tickets. The current step is worked out from the files every time the pane draws, so you can leave and come back and it resumes where you were. Nothing extra is stored for it.
- **Setup** has two lines:
  - **Git repository**: `✓ main · 0 commits` (or `has commits`), `! not a git repo`, or `? git status unknown` when `.git` is there but cannot be read. With no repo the button reads *Initialise git and make the first commit*; with a repo and no commit, *Make the first commit* (*… and push* when origin is set).
  - **GitHub repository**: `✓ owner/repo`, or `! No GitHub repository` with *Create private repo on GitHub* and **Skip**. Tickets work locally; the router needs origin to open PRs. An origin on another host (GitLab, your own server) counts as set up. Skip is remembered per project and the line then reads *skipped*.
- **Idea:** a *What are you building?* box with **✨ Brainstorm it first** (puts `/brainstorm <your idea>` in the prompt box) and **Go straight to design** (`/design <your idea>`). Both stay dimmed and do nothing until the box has text. In a folder that already has code but no docs, **Draft a design from the code** puts `/design Draft a design from the existing code in this repository.` in the prompt box (no text needed).
- **Design, Plan, Tickets:** once a brainstorm result is saved (`design/brief.md` or a file under `design/brainstorms/`), **Write the design from …** fills `/design <that file>`. Once `DESIGN.md` exists, **Plan the builds from the design** fills `/planning <design file>`. With both, the last step offers **+ New ticket** (or **Set up board** when there is no board yet). The `/brainstorm`, `/design` and `/planning` skills come in a later release; until then the filled line is a request you can edit.
- **Set up board only** (no board yet): does what *Set up board* always did, then shows the board.

**The buttons never run anything.** Each one only fills your prompt box with a request, such as *Initialise git here and make the first commit.* or *Create a private GitHub repository for this project with `gh repo create --private`, add it as origin and push.* You read it, change it if you like (for example to make the repo public), and press Enter. Claude then runs the commands with its own tools and asks you before each one. If the prompt box already has text in it, the pane shows the line to copy instead.

Design and plan are found from the `Design: … · Plan: …` line under the title of `BOARD.md`, else `design/DESIGN.md` and `design/PLAN.md` in any case (see [docs/STANDARD.md](docs/STANDARD.md)). The git lines come from plain files (`.git/HEAD`, `.git/config`, the branch's ref or `packed-refs`, and a linked worktree's `.git` pointer file), so Start works the same in the terminal and the desktop app and never starts a process.

**Banner on an existing project.** A project that already has tickets but no design or plan opens on the board as before, with a banner *No design or plan yet → Set up* above it (*No plan yet* once a design exists). **Set up** opens the Start screen (**‹ Board** takes you back); **Dismiss** hides the banner for this project, and that is remembered.

In the terminal the Start screen has the same content as plain text, with the steps as a numbered list and the same buttons and keys.

### Board

The board view **is** your `BOARD.md`, live and clickable. It shows the file as written: the heading and intro above the table, the table itself as interactive rows, and the status flow and legend below it. When the router, a worker or your editor changes the file, the view updates on its own.

- **Counts** for each status, e.g. `draft 3  ready 2  in-progress 1  done 9`.
- **Plan line** (when there is a plan): `Plan 46% · P2 60% · design v3 (plan behind) · tickets 40%` (plan %, the current phase and its %, the design version, and the share of tickets done), and the first roadmap warning under it.
- **Buttons:** **+ New ticket**, **▶ Run ready (N)** (when any ticket can run), **Refresh**.
- **Show:** *All* (the default, so it reads like the file), *Needs me* (draft + blocked), *Not done*, or one status.
- **Sort:** number ↑ / ↓, status (flow order), most open questions, recently edited, and phase (when there is a plan: P1, P2 … in order, off-plan last).
- **Mode:** any, solo, team.
- **Phase** (only when there is a plan): any, each phase of the plan, or *Off-plan*. A ticket's phase is the phase of the build it is linked to, by its rd.md `Plan:` line or by the plan's *Ticket* cell; off-plan means neither. A `Plan:` id the plan does not have counts under the phase its id names (`P9.9` → `P9`). *Clear filters* (desktop) resets it with the others.
- **Search:** matches number, title, notes, owner and status. All words must match.
- **Each ticket row** shows the number, status, title and marks. A second line shows the phase (`P2`, or `off-plan`; when there is a plan), the mode, *blocked by*, owner and notes, plus quick actions so you can work on the board without opening the ticket:
  - draft with open questions: **Answer (N)**
  - draft that passes the ready check: **✓ Ready**
  - ready: **▶ Run** and **↩ Draft**
  - blocked: **Unblock** (back to draft)
- **Marks:**
  - `?2`: two open questions
  - `✓`: a draft that passes the ready check
  - `⛔`: waits on a ticket that is not done
  - `✎`: the AI writer is working on it
  - `⚠`: a ticket folder with no row on the board (or a row with no folder)
- Long lists are paged. Your Show/Sort/Mode/Phase choices are remembered per project.

Press a ticket number to open the full ticket.

### Ticket

- Title, status, mode, *blocked by*, owner and the Notes column.
- **Plan item and Design chips** (only when there is a plan), read from the rd.md `Plan:` and `Design:` lines: the plan item, e.g. `P2.2 · One Accept per intent` (or the build whose *Ticket* cell lists the ticket), *Off-plan*, or `P9.9 — not in the plan` for an id the plan does not have; and one chip per design reference (`D4`, `D3@1`). A chip written against an older Rev than the section has now is marked *stale*, and the ticket shows the notice *Written against D3 rev 1, now rev 2*. The pane only shows these lines; it does not write them. In the terminal they are plain text (`Plan item: …`, `Design: D1@2, D3@1 (stale)`).
- **Ready check** (drafts only): each rule with ✓ or ✗ and why. See [below](#draft--ready-and-the-ready-check).
- **Actions**, depending on the status:
  - `ready`: **▶ Run this ticket**, **Back to draft**
  - `draft`: **Answer questions (N)**, **✓ Mark ready** (only when the ready check passes), **✎ Enhance with AI**
  - `blocked`: **Unblock → draft**, **Unblock → ready**
  - any status except blocked and done: **Block…**, which asks for a reason and puts it in Notes
- **Mode** (solo/team) and **Blocked by** can be edited in place.
- **Discuss in chat** puts a starter message about this ticket in your prompt box. **Copy path** copies the ticket folder path.
- **Change status…** lets you set any status by hand, behind a warning. The router normally owns in-progress, in-check and done, so use it only to fix the board.
- **rd.md / eval.md** tabs show the files, rendered.

### Questions

Lists the open questions from the ticket's `## Open questions` section, one input box for each. See [Answering open questions](#answering-open-questions).

### New ticket

A box for your idea, plus mode and *blocked by*. See [Creating a ticket](#creating-a-ticket-with-the-ai-writer).

## Answering open questions

The `/ticket` rules say a ticket cannot be **ready** while its *Open questions* section has anything in it. The pane helps you clear those.

- Each bullet under `## Open questions` is one question. Placeholders such as `- none`, `- —` or the template's `<…>` line do not count.
- Type your answer and press **Save**. The pane writes it into `rd.md` right under the question:

  ```markdown
  ## Open questions

  - Should the toggle be remembered per device?
    **Resolved 2026-11-09 (human): Yes, per device, in localStorage.**
  ```

  A question with a `**Resolved …**` line counts as answered. The rest of the file is not touched.
- **Suggest (AI)** drafts an answer from the ticket and its touchpoints for you to edit. Nothing is saved until you press Save.
- **Discuss in chat** puts the question in your prompt box, so you can talk it through with the full session.
- After answering, **✎ Fold answers into the ticket (AI)** has the ticket writer update *Behaviour*, *Scope* and *eval.md* to match your decisions. Answered questions stay in the file as a record.

## Draft → ready (and the ready check)

**✓ Mark ready** appears only when every hard rule passes:

| Rule | Hard? |
|---|---|
| `rd.md` exists and has *What*, *Behaviour*, *Scope*, *Touchpoints*, *Open questions* | yes |
| No unanswered open questions | yes |
| `eval.md` exists and has at least one check under *Checks* | yes |
| Every *Blocked by* ticket exists on the board | yes |
| `eval.md` has an end-to-end check | warning only |
| `rd.md` is under about 80 lines | warning only |

Marking ready changes only the Status cell of that ticket's row. **Back to draft** does the reverse. Neither touches Notes.

Other moves (in-progress, in-check, done) belong to the router. They are available only through **Change status…**.

## Creating a ticket with the AI writer

1. **+ New ticket** (or `/board new <idea>`).
2. Describe the change in your own words. Set mode and *blocked by* if you know them.
3. Choose:
   - **✎ Create draft + enhance with AI** (default). The pane:
     1. takes the next free number and makes the folder `tickets/<number>-<slug>/` with `rd.md` and `eval.md` from the templates,
     2. adds a `draft` row to `BOARD.md` with the note `AI drafting…`,
     3. starts the **ticket-writer** agent in the background. It explores your codebase and writes a complete `rd.md` and `eval.md` following the `/ticket` rules: real file paths in Touchpoints, objective checks with commands, and an end-to-end check. Anything it cannot decide from the code becomes an open question instead of a guess.
     4. When it finishes, the row's note becomes `AI draft done · 2 open questions` and the pane takes you to the questions.
   - **Create empty draft**: the same folder and row, with no AI. You fill it in yourself.
   - **Draft in chat instead**: puts `/ticket <idea>` in your prompt box, so the main session writes the ticket with you, interactively.
4. You can keep using the pane and the chat while the AI writes. **Watch** opens the writer's transcript.

**✎ Enhance with AI** on an existing draft runs the same writer against the files that are already there. It keeps your decisions and answered questions, fills the gaps, and tightens the checks.

The writer is boxed in. A guard in the mod refuses any write by that agent outside its own ticket folder, so it can only write that ticket's `rd.md` and `eval.md`. It never edits `BOARD.md` or code. The pane updates the board row itself.

## Run this ticket

On a **ready** ticket, **▶ Run this ticket** (key `x`) puts a run line in your prompt box. It **never sends it**. You press Enter, so the instruction comes from you, and the session it lands in does the work and moves the status. The pane never sets in-progress itself.

In a plain project the line is just:

```
Run ticket 0014.
```

If the project defines a router agent (`.claude/agents/router.md`), the line asks for it by name, so it works in **any** session, including a Claude desktop session you could not start with `--agent router`:

```
Run ticket 0014 as the router. If this session is not already the router, first read .claude/agents/router.md and follow it exactly: dispatch worker and checker agents, update tickets/BOARD.md, and never write the code yourself.
```

A real router session reads that as itself and carries on. Any other session takes on the router's job from the file and starts the `worker` and `checker` agents itself.

- If a *blocked by* ticket is not done yet, the line adds `— but only once 0008 is done.`, and the ticket view says what it is waiting for.
- On the board, **▶ Run ready (N)** counts the ready tickets whose blockers are all done and fills one line for all of them (`Run tickets 0011, 0013 and 0014 …`).
- To make *every* new session in a project the router, desktop included, put `{ "agent": "router" }` in that project's `.claude/settings.local.json`.

## Using it with the super-agent router

Above tickets, a project can keep a design and a plan as plain Markdown; the format is in [docs/STANDARD.md](docs/STANDARD.md).

This mod was built for the router/worker/checker workflow, where:

- you (and `/ticket`) write tickets as drafts,
- you flip them to ready,
- the **router** session picks ready tickets, starts a **worker** for each in its own worktree, sends finished work to a **checker** that runs `eval.md`, and updates `BOARD.md`.

The best setup is to **run the pane in the router session**:

```bash
claude --agent router     # start the router as usual
/board                    # open the pane beside it
```

Then the whole loop happens in one window:

1. **+ New ticket**, and the AI drafts it.
2. Answer its questions, then **✓ Mark ready**.
3. **▶ Run this ticket**, press Enter, and the router dispatches it.
4. Watch the row move through `in-progress` → `in-check` → `done` as the router edits the board. The pane picks up every change on its own.

Rules the pane keeps, so it fits the router:

- It changes only the Status cell for draft⇄ready and blocked, plus Mode, Blocked by and its own `AI …` notes. It never sets Owner, and never sets in-progress, in-check or done unless you use **Change status…**.
- Every edit re-reads the file and refuses to apply if the row changed since you looked at it. For example, if the router just took the ticket, you get *"0014 is now in-progress, not draft — refreshed"* and nothing is written.

The pane also works on its own, in any project that follows the same `tickets/BOARD.md` layout, with or without a router.

## The `/board` command and keys

| Command | Does |
|---|---|
| `/board` | open (or focus) the pane |
| `/board 14` | open the pane on ticket 0014 |
| `/board new <idea>` | open *New ticket* with the idea filled in |
| `/board close` | close the pane |

Keys while the pane has focus:

| Key | Where | Does |
|---|---|---|
| `n` | board | new ticket |
| `x` | board / ready ticket | run ready / run this ticket |
| `r` | board / README (desktop) | refresh / reload the README |
| `o` | every view with the project header | open the README; again to go back to the board |
| `q` | ticket | answer questions |
| `m` | draft ticket | mark ready |
| `d` | ready ticket | back to draft |
| `e` | draft ticket | enhance with AI |
| `s` | board with the banner / Start | open Start / set up board only |
| `i`, `u`, `g`, `k` | Start | initialise git, first commit (and push), create GitHub repo, skip GitHub |
| `b`, `d`, `c` | Start | brainstorm it first, go straight to design, draft a design from the code |
| `w`, `p`, `n` | Start | write the design from the idea, plan the builds, new ticket |

You can also click every button with the mouse.

## Settings

Change these in `/plugin` → ticket-board → configure:

| Setting | Default | Meaning |
|---|---|---|
| Tickets folder | `tickets` | Folder, relative to the project, that holds `BOARD.md` and the ticket folders |
| Refresh every (seconds) | `3` | How often the open pane re-reads the board |
| Open at start | on | Open the pane automatically when a session starts in a project that has a `tickets/` folder: on the board, or on the Start screen when there is no `BOARD.md` yet or no design, plan or tickets. Projects without `tickets/` never open it on their own; run `/board` there to see Start |
| Ticket writer model | *(session's)* | Model for the AI writer, e.g. `opus` or `sonnet` |

## How it edits your files

- **BOARD.md:** finds the ticket's row by number and rewrites only the cells it is changing. Column widths are padded to match. Every other line in the file stays exactly as it was, so `git diff` shows one line. A `|` in your text is escaped. New rows go right after the last row of the table.
- **rd.md:** an answer is inserted as one `**Resolved <date> (human): …**` line under its question. Nothing else changes.
- **Conflicts:** each edit reads the file again first. If the row's status is not what you were looking at, the edit is refused and the pane refreshes.
- **AI writes** go only into the one ticket folder, enforced by a tool guard in the mod.
- **What it remembers:** your Show/Sort/Mode/Phase choices, the list of AI jobs that are still running, and per project whether you skipped GitHub on the Start screen or dismissed the *No design or plan yet* banner. These live in the pane's own store, never in your project's files. Nothing leaves your machine except the model calls for the AI writer and *Suggest*.

## Troubleshooting

| You see | Why / fix |
|---|---|
| *Start a project* instead of your board | There is no `tickets/BOARD.md` in this project (or in the folder named in Settings), or the project has no design, plan or tickets yet. Press **Set up board only** for an empty board, or point the setting at your folder. |
| *git status unknown* | `.git` exists but its files could not be read. Start does not wait on it; check the folder's permissions. |
| *BOARD.md has no ticket table* | The file needs a markdown table whose header has `#` and `Status` columns. |
| `⚠` on a row | A folder `tickets/0012-…/` with no row on the board, or the reverse. Add the row, or fix the folder name. |
| **Mark ready** missing | The ready check is failing. Open the ticket to see which rule. |
| *…is now in-progress, not draft — refreshed* | Someone (usually the router) changed that ticket first. Nothing was written. |
| Buttons (README, + New ticket, Agents) do nothing | Version 0.4.12 or older: when an agent was listed twice, the pane stopped redrawing, so every button looked dead. Update the plugin. Keys such as `o` and `n` only work while the pane has focus; click the pane first. |
| The pane doesn't open at start | It only opens on its own where it can sit beside the chat. Run `/board`. |
| The AI writer stopped | The note says why. **Watch** opens its transcript; **✎ Enhance with AI** starts it again. |
| *The prompt box is busy* | Something else is in the prompt box. Copy the line shown and paste it yourself. |

## Development

```bash
git clone https://github.com/manateeit/ticket-board && cd ticket-board
claude --plugin-dir .            # run Claude Code with the local copy
claude plugin test .             # unit tests + pane tests (terminal and desktop)
claude plugin validate .
```

Layout:

```
.claude-plugin/plugin.json      manifest and settings
.claude-plugin/marketplace.json so the repo installs as a marketplace
hooks/register.tsx              the hooks: /board, the pane, the AI writer guard, job completion
hooks/views.tsx                 the pane's views (terminal), the Start screen's logic
hooks/store.ts                  reading and writing the board and tickets
hooks/ai.ts                     ticket-writer jobs and answer suggestions
hooks/core/                     pure parsing/editing (board table, questions, ready check, filters, roadmap parser and progress)
agents/ticket-writer.md         the background writer agent
agents/elephant.md              built-in brainstorm: holds context, runs goldfish rounds, writes the brief
agents/goldfish.md              one read-only brainstorm lens, no shared context
agents/fresh-reader.md          reads only DESIGN.md and returns open questions
agents/planner.md               drafts PLAN.md + coverage review, or the replan proposal
skills/ticket/                  the /ticket rules and templates
skills/brainstorm/              /ticket-board:brainstorm (EGM bridge + built-in elephant/goldfish)
skills/design/                  /ticket-board:design (design and redesign)
skills/planning/                /ticket-board:planning (plan and replan)
templates/BOARD.md              the empty board used by "Set up board"
templates/design.md             starting points for the design and plan files
templates/plan.md                 (format in docs/STANDARD.md)
templates/brief.md
templates/change.md
docs/STANDARD.md                the file standard for the design and plan above tickets
examples/demo-board/            a demo project
tests/                          claude plugin test suites
```

The parsing and editing code in `hooks/core/` has no side effects and is covered by `tests/core.test.ts`. `tests/roadmap.test.ts` covers the roadmap parser (`hooks/core/roadmap.ts`) and the rd.md `Plan:` / `Design:` readers on three fixtures: a blank project, a full design and plan with every build state, coverage state, hill position and roadmap check, and a copy of the factory's phase-less `F1…` plan shape. `tests/pane.test.tsx` drives the real pane over an in-memory board on both surfaces: answer a question, mark ready, run a ticket, and the Start screen (a blank folder, the banner on a board with tickets, the stepper resuming from files, Skip remembered, and every Start button only filling the prompt), and plan progress on a roadmap fixture (a plan with 4 phases and a design at v3: the Plan % tile and terminal plan line against `progress()`, the Roadmap card and its warnings, the phase filter, sort and *Clear filters*, the ticket's plan item, design chips and stale notice, a plan that cannot be read, and the unchanged no-plan board). The Start screen's git and step detection, and the phase filter and sort, are covered in `tests/core.test.ts`.

## License

MIT. See [LICENSE](LICENSE).

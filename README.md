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
3. [The pane, view by view](#the-pane-view-by-view)
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
| `ticket-writer` agent | The background AI that writes and improves tickets for the pane. It can only write `rd.md` and `eval.md` inside the one ticket folder it was given. |

## Quick start

1. Open a project that has `tickets/BOARD.md`, or any project.
2. Run `/board`.
   - If there is no board yet, the pane offers **Set up board**. That creates `tickets/BOARD.md` (an empty table with the usual legend) and `tickets/TEMPLATE/`.
3. Press **+ New ticket**, describe what you want, and press **Create draft + enhance with AI**.
4. When the AI finishes, answer its open questions in the pane, press **✓ Mark ready**, then **▶ Run this ticket**.

To try it without touching a real project, copy the demo board:

```bash
cp -R ~/.claude/plugins/marketplaces/ticket-board/examples/demo-board /tmp/demo && cd /tmp/demo && claude
```

Then run `/board`. The demo has one ticket of each kind: done, ready (waiting on a blocker), draft with open questions, and blocked.

## The pane, view by view

The pane opens beside the chat. When a session starts in a project with a board, it opens on its own (you can turn that off in [Settings](#settings)). On a surface with no room for a side panel, it only opens when you run `/board`.

It re-reads the board every few seconds while it is open, and right after any tool writes into `tickets/`, so changes from the router, workers or your editor show up without a refresh.

### Board

The board view **is** your `BOARD.md`, live and clickable. It shows the file as written: the heading and intro above the table, the table itself as interactive rows, and the status flow and legend below it. When the router, a worker or your editor changes the file, the view updates on its own.

- **Counts** for each status, e.g. `draft 3  ready 2  in-progress 1  done 9`.
- **Buttons:** **+ New ticket**, **▶ Run ready (N)** (when any ticket can run), **Refresh**.
- **Show:** *All* (the default, so it reads like the file), *Needs me* (draft + blocked), *Not done*, or one status.
- **Sort:** number ↑ / ↓, status (flow order), most open questions, recently edited.
- **Mode:** any, solo, team.
- **Search:** matches number, title, notes, owner and status. All words must match.
- **Each ticket row** shows the number, status, title and marks. A second line shows the mode, *blocked by*, owner and notes, plus quick actions so you can work on the board without opening the ticket:
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
- Long lists are paged. Your Show/Sort/Mode choices are remembered per project.

Press a ticket number to open the full ticket.

### Ticket

- Title, status, mode, *blocked by*, owner and the Notes column.
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

On a **ready** ticket, **▶ Run this ticket** (key `x`) puts this in your prompt box:

```
Run ticket 0014.
```

It **never sends it**. You press Enter, so the instruction comes from you, and the session it lands in (normally the router) does the work and moves the status. The pane never sets in-progress itself.

- If a *blocked by* ticket is not done yet, the text becomes `Run ticket 0014 once 0008 is done.`, and the ticket view says what it is waiting for.
- On the board, **▶ Run ready (N)** counts the ready tickets whose blockers are all done and fills one line for all of them: `Run tickets 0011, 0013 and 0014.`

## Using it with the super-agent router

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
| `r` | board | refresh |
| `q` | ticket | answer questions |
| `m` | draft ticket | mark ready |
| `d` | ready ticket | back to draft |
| `e` | draft ticket | enhance with AI |

You can also click every button with the mouse.

## Settings

Change these in `/plugin` → ticket-board → configure:

| Setting | Default | Meaning |
|---|---|---|
| Tickets folder | `tickets` | Folder, relative to the project, that holds `BOARD.md` and the ticket folders |
| Refresh every (seconds) | `3` | How often the open pane re-reads the board |
| Open at start | on | Open the pane automatically when a session starts in a project with a board |
| Ticket writer model | *(session's)* | Model for the AI writer, e.g. `opus` or `sonnet` |

## How it edits your files

- **BOARD.md:** finds the ticket's row by number and rewrites only the cells it is changing. Column widths are padded to match. Every other line in the file stays exactly as it was, so `git diff` shows one line. A `|` in your text is escaped. New rows go right after the last row of the table.
- **rd.md:** an answer is inserted as one `**Resolved <date> (human): …**` line under its question. Nothing else changes.
- **Conflicts:** each edit reads the file again first. If the row's status is not what you were looking at, the edit is refused and the pane refreshes.
- **AI writes** go only into the one ticket folder, enforced by a tool guard in the mod.
- **What it remembers:** your Show/Sort/Mode choices and the list of AI jobs that are still running. Nothing leaves your machine except the model calls for the AI writer and *Suggest*.

## Troubleshooting

| You see | Why / fix |
|---|---|
| *No ticket board here yet* | No `tickets/BOARD.md` in this project (or in the folder named in Settings). Press **Set up board**, or point the setting at your folder. |
| *BOARD.md has no ticket table* | The file needs a markdown table whose header has `#` and `Status` columns. |
| `⚠` on a row | A folder `tickets/0012-…/` with no row on the board, or the reverse. Add the row, or fix the folder name. |
| **Mark ready** missing | The ready check is failing. Open the ticket to see which rule. |
| *…is now in-progress, not draft — refreshed* | Someone (usually the router) changed that ticket first. Nothing was written. |
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
hooks/views.tsx                 the pane's views
hooks/store.ts                  reading and writing the board and tickets
hooks/ai.ts                     ticket-writer jobs and answer suggestions
hooks/core/                     pure parsing/editing (board table, questions, ready check, filters)
agents/ticket-writer.md         the background writer agent
skills/ticket/                  the /ticket rules and templates
templates/BOARD.md              the empty board used by "Set up board"
examples/demo-board/            a demo project
tests/                          claude plugin test suites
```

The parsing and editing code in `hooks/core/` has no side effects and is covered by `tests/core.test.ts`. `tests/pane.test.tsx` drives the real pane over an in-memory board on both surfaces: answer a question, mark ready, and run a ticket.

## License

MIT. See [LICENSE](LICENSE).

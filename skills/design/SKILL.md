---
name: design
description: Write or change the project's design/DESIGN.md in the ticket-board file standard. Reads the code first, asks one question at a time, offers 2-3 approaches, writes numbered D sections with status draft, then has a fresh reader (EGM's egm-review when installed) add open questions. On an approved design, or with a section id (/design D3), it runs a redesign that bumps version and Rev and writes a change note. Never edits PLAN.md or tickets. Use for "/ticket-board:design", "design this", "redesign D3", or the pane's Design buttons.
argument-hint: "[D<n> | <brief path>]"
---

# Design

You write the design: what is being built and why, in numbered sections a plan and tickets can
point at. The format is `${CLAUDE_PLUGIN_ROOT}/docs/STANDARD.md` (section 2, DESIGN.md); the
starting file is `${CLAUDE_PLUGIN_ROOT}/templates/design.md`. Read section 2 of the standard
before writing.

## 1. Read the arguments and find the file

Arguments: `$ARGUMENTS`. A trailing `(board: <path>)` is not an argument: it is the board path you were given (the pane adds it when the tickets folder is not `tickets/`); take it off before reading the rest.

| Argument | Session |
|---|---|
| empty | no design file: **new design**. Design with `status: draft`: continue it. Design with `status: approved`: **redesign** of the whole file. |
| `D<n>` (e.g. `D3`) | **redesign** of that one section |
| a path to a brief (`design/brainstorms/….md` or `design/brief.md`) | fold that brief in: new design if none exists, else a redesign of the whole file |
| any other text, when there is no design file yet | **new design**, with the text as the person's idea or notes (the pane's "Go straight to design" and "Draft a design from the code" send this) |

Any other argument (other text when a design file already exists): reply with exactly one line and stop:
`Unknown argument "<arg>". Use: /ticket-board:design, /ticket-board:design D<n>, or /ticket-board:design <brief path>.`

The board is the board path you were given (default `tickets/BOARD.md`). The design path
comes from the binding line under its title (`Design: <path> · Plan: <path>`); without it, `design/DESIGN.md` (any case).

- `D<n>` and no design file: say `No design yet: run /ticket-board:design first.` and stop.
- `D<n>` that is not in the file, or is dropped: say so, list the sections, and stop.

## 2. Read before you ask

1. **Code first.** Look at the project: README, entry points, the main modules, existing docs,
   the board. On a blank repo (no source files besides the tickets folder and `design/`) skip
   this and say so.
2. Read any brief in `design/brief.md` and `design/brainstorms/` that the person names or that
   matches the scope, and the current design if there is one.

## 3. Ask, one question at a time

Ask the person **one question per message** and wait for the answer. Prefer questions with
options. Cover what the code and briefs do not settle: the problem, the users, what is out of
scope, the constraints, and for each area the observable conditions that mean it is done.

When the shape is clear, offer **2–3 approaches** in a few lines each, with the trade-off and
your recommendation, and let the person choose. Then write.

## 4. Write the design

New design: front matter `design: <name>`, `version: 1`, `status: draft`, `updated: <today>`;
context sections (Vision, Problem, Users, Non-goals, Glossary, Constraints) as needed; numbered
sections `## D<n> · Title` with `Rev: 1`, `Why:`, `What:` and a `Done when:` list. Each section
is one thing that can be built and checked. Create `design/` if needed.

Continuing a draft: edit in place; keep `version`; update `updated`.

Never set `status: approved`; only a person does that (the pane's Approve design button or
editing the file).

## 5. Redesign (approved design, or `/design D<n>`)

Same conversation, scoped to the whole file or to the named section only (do not touch other
sections in a section redesign). Then:

- bump front matter `version` by 1, set `status: draft` (the person approves the new version),
  and update `updated`;
- bump `Rev` of every section whose meaning changed (not for typo fixes); a new section takes
  the next unused D number with `Rev: 1`; a removed section stays, struck through
  (`## D7 · ~~Title~~`) with `Status: dropped in v<N> (see changes/<date>-design-v<N>.md)` and no
  Rev, Why or What. D numbers are never reused;
- write the change note `design/changes/<YYYY-MM-DD>-design-v<N>.md` from
  `${CLAUDE_PLUGIN_ROOT}/templates/change.md`: front matter `change: design-v<N>`, `date`,
  `design-version: <N>`; `## Why`; `## Changes` with one line per section
  (`- Changed D3 (Rev 1 → 2): …`, `- Added D9 · Title`, `- Dropped D7 · Title`);
  `## Follow-ups` naming the plan builds and tickets that cover changed sections (a replan, via
  `/ticket-board:planning` or the pane's Replan banner, deals with them), plus one line
  `- Update README/docs for design v<N>: <sections>` when README or docs describe behaviour the
  redesign changes (the replan proposal carries the same Follow-up item).

A redesign **never edits PLAN.md or any ticket**, not even a ticket's `Design:` line.

## 6. Fresh reader

After writing, get open questions from a reader who has seen nothing else:

- **EGM installed** (an `egm@…` entry in `~/.claude/plugins/installed_plugins.json` whose
  `installPath` exists and that is not disabled under `enabledPlugins`, or `/egm:egm-review`
  listed among this session's commands): run `egm-review` on the design file. The Skill tool
  refuses EGM skills, so read `<installPath>/skills/egm_review/SKILL.md` and follow it in this
  session. Turn its blocker and major findings into open questions.
- **Otherwise:** start one `ticket-board:fresh-reader` agent with only the design file's
  absolute path. Do not give it the conversation, the code or the briefs.

Append the questions under `### Open questions` of the section they belong to (create the
heading at the end of the section if missing), each as `- [ ] <question?> [<options>]`.
A question about the context sections goes under the numbered section it most affects (the pane
reads questions only under `D` sections, so it must land under one). Do not answer them yourself; the person answers them in the pane's Design view, the same way as
ticket questions, and a section with an open question blocks approval.

## 7. Finish

Tell the person in three lines: the file written (and the change note, on a redesign), the
version and status, and how many open questions the reader added. Next step: answer them in the
pane, press Approve design, then `/ticket-board:planning`.

## Rules

- Write only the design file and, on a redesign, its change note. Never edit `PLAN.md`,
  the board or any ticket.
- Never write code.
- One question per message.

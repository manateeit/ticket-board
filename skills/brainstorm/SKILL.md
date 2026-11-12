---
name: brainstorm
description: Brainstorm the whole concept, one design section, one plan phase or one ticket, and write the result to design/brainstorms/<date>-<slug>.md (problem, users, kept, cut, open questions). Uses EGM's /egm:egm-brainstorm when EGM is installed, otherwise the built-in elephant + goldfish agents. Never edits DESIGN.md, PLAN.md or tickets. Use for "/ticket-board:brainstorm [whole | D3 | P2 | 0007]", "brainstorm this idea", or the pane's Brainstorm buttons.
argument-hint: "[whole | D<n> | P<n> | <ticket number>] [notes]"
---

# Brainstorm

You turn a half-formed idea, or one item of an existing design, into a short brief: what problem
it solves, for whom, which concepts to keep and which to cut, and what is still open. The brief
is input for `/ticket-board:design` later ("Fold into design"). You never edit the design, the
plan or any ticket here.

The file standard is `${CLAUDE_PLUGIN_ROOT}/docs/STANDARD.md`; the brief template is
`${CLAUDE_PLUGIN_ROOT}/templates/brief.md`.

## 1. Read the scope

Arguments: `$ARGUMENTS`. The first word is the scope; anything after it is the person's notes.

| Scope | Item |
|---|---|
| empty or `whole` | the whole concept: the person's idea, or the existing design as a whole |
| `D<n>` (e.g. `D3`) | design section D3 |
| `P<n>` (e.g. `P2`) | plan phase P2 and its builds |
| a ticket number (e.g. `0007` or `7`) | the ticket `0007-*/` next to the board |

Any other first word: reply with exactly one line and stop:
`Unknown scope "<word>". Use: whole | D<n> (design section) | P<n> (plan phase) | <ticket number>.`

Find the files. The board is the board path you were given (default `tickets/BOARD.md`). The
design and plan paths come from the binding line under its title (`Design: <path> · Plan: <path>`); without it use `design/DESIGN.md` and
`design/PLAN.md` (any case). Then:

- `D<n>` with no design file, or `P<n>` with no plan file: say
  `No design yet: run /ticket-board:design first.` (or `No plan yet: run /ticket-board:planning
  first.`) and stop.
- `D<n>`, `P<n>` or a ticket that does not exist: say so in one line, list the ones that do,
  and stop.

## 2. Gather the context

Read the item and what surrounds it: for `whole`, the design's context sections (if any) and a
quick look at the code (skip on a blank repo); for `D<n>`, that section plus Vision, Non-goals,
Constraints and the builds that cover it; for `P<n>`, the phase, its builds, the sections they
cover and their tickets' status on the board; for a ticket, its `rd.md`, the `Plan:` build and
`Design:` sections it names. Note real file paths.

If the item is the whole concept and you have no idea text yet (no notes, no design), ask the
person one question: what are you building and for whom? Ask one question at a time, at most
three before you start; the brainstorm itself will find the rest.

Pick the brief path: `design/brainstorms/<YYYY-MM-DD>-<slug>.md`, slug from the item
(`whole` → the idea or project name; `D3` → `d3-<section-title>`; `P2` → `p2-<phase-title>`;
ticket → `<number>-<ticket-slug>`), lowercase with hyphens. If that file exists, add `-2`, `-3`.

## 3. Choose the path

EGM is **installed** when `~/.claude/plugins/installed_plugins.json` has an `egm@…` entry whose
`installPath` exists and the plugin is not disabled in settings (`"egm@…": false` under
`enabledPlugins`), or when `/egm:egm-brainstorm` is listed among this session's commands or
skills. If the person asked for the built-in path ("without EGM", "built-in"), use it even when
EGM is installed.

### With EGM

Run `/egm:egm-brainstorm` with the item and the context from step 2 as the concept. EGM's skills
are user-invoked only, so the Skill tool refuses them: read
`<installPath>/skills/egm_brainstorm/SKILL.md` and follow it in this session, as EGM's own
Claude Code guide says. When it has produced its concepts brief, write the brainstorm brief
(format below) from it with `Path: EGM (/egm:egm-brainstorm)`. Leave EGM's own working file where
it wrote it and mention its path.

### Built-in: elephant and goldfish

Start one `ticket-board:elephant` agent. Give it the scope, the item text, the context from step
2 (summaries and file paths, not whole files), what the person has said, today's date and the
brief path. Do not start goldfish yourself and do not read their output: the elephant starts
them, four in parallel each round with no shared context (lenses: user, simplest thing, risk,
what's missing), holds the whole context across rounds, and decides keep, cut or re-ask. It runs
at most 3 rounds and then writes the brief.

When the elephant stops with `## Questions for you`, ask the person those questions one at a
time, then continue **the same** elephant (SendMessage to its agent id) with the answers so it
keeps its context. If the agent cannot be continued, start a new elephant with the previous
elephant's last reply and the answers.

## 4. The brief

Both paths write the same format (the brief template plus two lines and Open questions), and the
`Path:` line says which path ran:

```markdown
---
brief: <Project or item name>
date: <YYYY-MM-DD>
---
# <Project or item name>: brief

Path: built-in (elephant + 4 goldfish, 2 rounds)      or      Path: EGM (/egm:egm-brainstorm)
Scope: <whole | D3 · Title | P2 · Title | ticket 0007>

## Problem
## Users
## Kept
- <concept> (<why>)
## Cut
- <concept> (<why>)
## Open questions
- [ ] <question?> [<option a> · <option b>]
```

## 5. Finish

Check the brief exists and has the `Path:` line, Kept and Cut lists. Tell the person in two or
three lines: the brief path, the path used, the open questions, and that `/ticket-board:design
<brief path>` (the pane's "Fold into design") folds it into the design.

## Rules

- Write only the brief (and, on the EGM path, EGM's own working file). Never edit
  `DESIGN.md`, `PLAN.md`, the board or any ticket.
- Never write code.
- Plain English, critique before agreement, no flattery.

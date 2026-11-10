---
name: ticket
description: Turn a feature request or idea into a build-ready ticket for the super-agent workflow. Creates tickets/<number>-<slug>/rd.md (what the feature must do) and eval.md (how a checker verifies it is done), then adds the ticket to tickets/BOARD.md as a draft. Use when the user describes a feature, bug, or change they want built by the router/worker system, or says "make a ticket", "ticket this", or "add this to the board".
---

# Ticket writer

You convert a plain-language request into a ticket that a worker agent can build
**without asking the human any questions**, and that a checker agent can verify
**without asking the worker what it did**. If either file would force a question
later, the ticket is not finished — resolve the ambiguity now, from the codebase
or by asking the human while they are still here.

The ticket-board pane (`/board`) shows the result: the person answers open
questions there and flips the ticket from `draft` to `ready`.

## Steps

1. **Explore first.** Read the relevant parts of the codebase (entry points,
   similar features, existing conventions, tests) so the ticket reflects how
   this project actually works, not how a generic project might.

2. **Number the ticket.** Look in `tickets/` (and the rows of
   `tickets/BOARD.md`) for the highest existing number and use the next one,
   zero-padded: `0007-fix-login-redirect`. Create the folder
   `tickets/<number>-<slug>/`. If `tickets/BOARD.md` does not exist yet, create
   it from this skill's board template (`templates/BOARD.md` in the
   ticket-board plugin) or ask the person to press **Set up board** in `/board`.
   The templates for the two files are in this skill's `TEMPLATE/` folder.

3. **Write `rd.md`** — the requirements doc. Exactly these sections:
   - `# <number> — <Title>`
   - `Type: feature` (or `bug` / `chore`) on its own line under the title, so the board can show and filter by kind.
   - `Plan: P2.3` and `Design: D1@2, D3@1`, each on its own line under `Type:`, **only when
     the ticket comes from a plan build** (the request names a build id, or comes from the
     pane's Plan view). `Plan:` is the one build id; `Design:` lists each design section the
     build covers with the `Rev` it has now (`D<n>@<rev>`), read from the build's `Covers`
     cell in the plan and the sections in the design (paths from the `Design: … · Plan: …`
     line in `tickets/BOARD.md`, else `design/DESIGN.md` and `design/PLAN.md`). When the
     section's `Rev` later goes up, the board shows the ticket as stale. Omit both lines for
     a ticket that does not come from a build (an off-plan bug or chore is fine). Format:
     `docs/STANDARD.md` section 4 in the ticket-board plugin.
   - `## What` — 2–5 sentences: what this feature/change is and why.
   - `## Behaviour` — bullet list of observable behaviour. Be specific:
     inputs, outputs, UI states, edge cases, error cases. No implementation
     instructions here — behaviour only.
   - `## Scope` — what is explicitly IN and explicitly OUT.
   - `## Touchpoints` — files/modules you found in step 1 that this will
     probably touch (guidance for the worker, not a straitjacket).
   - `## Docs` — the documentation step of the ticket: which parts of
     `README.md` and which other docs (docs/, CHANGELOG, help text, the
     project's CLAUDE.md/AGENTS.md) the worker must update so they match the
     change. Always name README.md: what to add or change, or
     `README.md — no change: <why>`. Updating these is part of the work, not
     a follow-up ticket.
   - `## Open questions` — anything genuinely undecided, one `- question`
     bullet each. If this section has an unanswered question, the ticket
     cannot be marked ready. When there are none, write `- none`.

4. **Write `eval.md`** — the verification contract. Exactly these sections:
   - `# Eval — <number> — <Title>`
   - `## Checks` — a numbered list of checks a checker agent can run and
     pass/fail objectively. Each check names: how to run it (command, URL,
     or steps), and what result counts as a pass. Prefer checks that use the
     project's own test/build commands, plus at least one check that exercises
     the new behaviour end-to-end (browser check for UI work).
   - One check is always **Docs and README updated**: the docs listed in
     rd.md's `## Docs` and README.md describe the change as built. A ticket
     is not done while its docs are stale.
   - `## Not checked by automation` — anything a human still has to eyeball.
   - The checker marks each check PASS/FAIL in this file and appends evidence
     (command output summaries, screenshot paths). It never edits the checks
     themselves.

5. **Classify the ticket:**
   - **Mode `solo`** — one worker, one worktree, no coordination needed.
   - **Mode `team`** — genuinely needs several workers coordinating (e.g. a
     migration + its UI + its docs that must land together). Default to solo;
     team is the exception. (Team mode uses Claude Code's experimental agent
     teams; if that is unavailable, the router runs team tickets as multiple
     solo workers and merges in dependency order.)
   - **Blocked by** — ticket numbers that must be DONE before this one starts,
     or `—`.

6. **Add a row to `tickets/BOARD.md`** with status `draft`, and show the human
   the ticket. The ticket only becomes `ready` when the human (or the router,
   on the human's instruction) flips it — workers never start drafts.

## Tickets from the plan

The pane's Plan view creates tickets from plan builds (**+ Create ticket** on a build,
**+ Create tickets for P2** on a phase, or **all not started**). For each build with no ticket
the pane itself makes the skeleton, so the writer starts from:

- `rd.md` with `Type: feature`, `Plan: <build id>` and `Design: D1@2, D3@1` (each covered
  section at its current `Rev`) under the title, and a `## Docs` section naming README.md;
- `eval.md` with one check per `Done when` line of the covered sections (`Run:` and `Pass:`
  lines to fill in) and the **Docs and README updated** check;
- a `draft` row (mode `solo`) whose Blocked by maps the build's `Needs` to ticket numbers. A
  needed build with no ticket that is not in the same batch is left out of Blocked by and named
  in the row's Notes instead;
- the new number already in the build's `Ticket` cell in PLAN.md (only the pane writes it).

The **plan-build brief** the writer gets holds the build row, the phase's Goal and Exit, and each
covered section with its `Rev`, What and `Done when` lines. Write the ticket from it as in the
steps above, keeping the `Type:` / `Plan:` / `Design:` lines, turning each `Done when` line into
a check with a run command and a pass criterion, and keeping `## Docs` (README.md named) and
the docs check: the pane reports a finished ticket that lacks either. At most 3 writers run at
once; the rest wait as *queued*. Nothing sets the ticket `ready`.

## Answered questions

When a person answers an open question (in chat or in the `/board` pane), keep
the question and put the answer under it:

```
- Should the export include archived rows?
  **Resolved 2026-11-08 (human): no, active rows only**
```

A question is open until it has a `**Resolved …**` line. When the answers have
been worked into What/Behaviour/Scope, the list may be collapsed to
`- none (resolved <date>; answers folded into the ticket)`.

## Rules

- One feature per ticket. If the request is really three features, write three
  tickets and link them with Blocked-by.
- Every ticket ends with its docs: the worker updates README.md and the docs
  in `## Docs` in the same change, and the checker verifies them.
- Never write code in this skill. Tickets describe behaviour and verification,
  not implementations.
- Keep `rd.md` under ~80 lines. A worker's context window is precious; link to
  files instead of pasting them.

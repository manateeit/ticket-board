---
name: planning
description: Turn the approved design/DESIGN.md into design/PLAN.md (phases of sized builds that cover every design section) in the ticket-board file standard, with a coverage self-review that fixes gaps before finishing. When the plan is behind the design, it writes only a replan proposal to design/changes/<date>-replan.md instead. Use for "/ticket-board:planning", "plan this design", "replan", or the pane's Approve design and Replan buttons. (Named planning because /plan is a built-in command.)
---

# Planning

You turn a design into a plan: phases, each with builds small enough to be one ticket, and every
design section covered by a build. The format is `${CLAUDE_PLUGIN_ROOT}/docs/STANDARD.md`
(section 3, PLAN.md); the starting file is `${CLAUDE_PLUGIN_ROOT}/templates/plan.md`. The
`ticket-board:planner` agent drafts and reviews; you choose the mode, check its work and report.

## 1. Find the files and choose the mode

`$ARGUMENTS` takes nothing. If anything is given, reply with one line and stop:
`/ticket-board:planning takes no arguments; it plans the design bound in tickets/BOARD.md.`

The design and plan paths come from the binding line under the title of `tickets/BOARD.md`
(`Design: <path> · Plan: <path>`); without it, `design/DESIGN.md` and `design/PLAN.md` (any
case).

- No design file: say `No design yet: run /ticket-board:design first.` and stop.
- Design `status: draft`: say the design is not approved yet (open questions, then Approve design
  in the pane) and stop. Never approve it yourself.
- No plan file: mode **plan**.
- Plan `design-version` lower than the design's `version`: mode **replan** (the plan is behind).
- Plan `design-version` equal to the design's `version`: say the plan is up to date; offer to run
  the coverage review only (mode **plan** on the existing file, fixing gaps, no other changes).

## 2. Mode: plan

Read the design, skim the code and `tickets/BOARD.md` yourself so you can judge the result. Start
one `ticket-board:planner` agent with: mode `plan`, the design, plan and board paths, today's
date, and anything the person said about order, appetite or phases. It writes PLAN.md: front
matter (`plan`, `design-version` = the design's version, `updated`), phases `## P<n> · Title`
with `Goal:`, `Appetite:`, `Exit:`, and a build table per phase with exactly
`| # | Build | Size | Needs | Covers | Done when | Ticket |`.

**Coverage self-review** (the planner runs it; check it again yourself before finishing):

- every non-dropped `D` section is covered by at least one build that is not deferred or dropped;
- no build has an empty `Covers`, and every D id it names exists and is not dropped;
- every `Needs` id exists, no cycles; build ids are unique.

If any check fails, fix the gap (continue the planner with the failures, or edit PLAN.md
yourself) and check again. Do not finish with a gap.

## 3. Mode: replan

The plan was made from an older design version. The pane's replan banner (*Plan is behind design
vN*) starts the planner itself with **Replan**; from the CLI, start the planner with mode
`replan`, the design, plan and board paths, today's date and the proposal path
`design/changes/<YYYY-MM-DD>-replan.md`. It diffs the design versions (the change notes in
`design/changes/` and each section's `Rev` and dropped status) against the plan and the tickets'
`Design:` lines, and writes **only that proposal**, in the format of
`${CLAUDE_PLUGIN_ROOT}/docs/STANDARD.md` section 8: front matter `change: replan`, `date`,
`design-version` (and `plan-hash`, which the pane fills in when the planner was started from the
CLI), then one `- [ ]` line per item under these headings, each with its reason on the next line,
indented:

- **`## Add`**: a section with no build; the item is the new build row
  `| P2.3 | Name | M | P2.1 | D9 | done when |`;
- **`## Change`**: a build whose name, size, needs, covers or done-when must change; the item is
  the whole new row in the same six cells;
- **`## Drop`**: a build that only covers dropped sections: `P2.2 · Name`;
- **`## Follow-up`**: a done build that a change affects: `P1.1 · What the new ticket does`. The
  done ticket is never rewritten; a new draft ticket does the change.

**Docs follow-up rule.** When a redesign or replan changes behaviour that README or docs
describe, the proposal has exactly one Follow-up item `Update README/docs for <change>`, and the
redesign's change note lists the same line under `## Follow-ups`. When the pane started the
planner it adds both if they are missing; from the CLI, check both yourself (you may add the line
to the change note; the planner may not).

Replan does not edit PLAN.md, DESIGN.md or any ticket. The person reviews the proposal in the
pane's **Review replan** screen, ticks items (nothing is ticked by default) and presses **Apply
selected**: the pane edits PLAN.md (Add row, Change cells, Drop as `Status: dropped`,
`design-version`), creates draft tickets for Add and Follow-up items and marks the applied items
`[x]`. If PLAN.md changed since the proposal, Apply stops with *plan changed; regenerate the
proposal*.

## 4. Finish

Tell the person in three lines: the file written, the phases and builds (or proposals by group),
and the coverage review result. Next step after a plan: create tickets from builds in the pane's
Plan view (or `/ticket` with the build id, which writes the `Plan:` and `Design:` lines).

## Rules

- Plan mode writes only PLAN.md. Replan mode writes only the replan proposal (and, from the CLI,
  the docs follow-up line in the change note).
- Never edit `DESIGN.md`, `tickets/BOARD.md` or any ticket; never rewrite a done ticket.
- Never set the design's status; never write code.
- In the build table never write done or in-progress state; the optional `Status` column holds
  only `deferred` or `dropped`.

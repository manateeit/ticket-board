# 0005 — Brainstorm, design and planning skills and agents

Type: feature

## What

Milestone M4 of `PLAN-design-plan.md` (section 5). Add three skills (`brainstorm`, `design`, `planning`) and four agents (`elephant`, `goldfish`, `fresh-reader`, `planner`) to the plugin. They run the interactive sessions that write `design/DESIGN.md`, `design/PLAN.md`, brainstorm briefs and change notes in the file standard from ticket 0001. `ticket-writer` and `/ticket` also learn to write `Plan:` and `Design:` lines. When EGM is installed the skills use it; when not, a built-in fallback must still have an elephant (one agent that holds the whole context across rounds and synthesises the goldfish lenses), not just goldfish plus a synthesis step.

## Behaviour

- `/ticket-board:brainstorm [whole | D3 | P2 | 0007]` scopes to the whole concept, a design section, a phase or a ticket. It reads that item and its context, then writes `design/brainstorms/<date>-<slug>.md` (format: brief template from 0001). It never edits DESIGN.md, PLAN.md or tickets; "Fold into design" later feeds the brief to `/design`.
- With EGM installed (detected by its skills being listed) brainstorm runs `/egm:egm-brainstorm` with the item and context, and saves the result in the brief format. Without EGM it uses the built-in path below. It says which path it used at the top of the brief.
- Built-in path: the `elephant` agent keeps the whole context (item, design, plan, code findings) and runs up to 3 rounds. Each round it starts 4 `goldfish` agents in parallel with no shared context, one lens each (user, simplest thing, risk, what's missing), then reads all four and decides what to keep, cut, or re-ask. It writes the brief with keep / cut lists and open questions. Goldfish never see each other's output or the elephant's history.
- `/ticket-board:design` reads the code first (skips on a blank repo), asks one question at a time, offers 2–3 approaches, then writes DESIGN.md with `status: draft`. A `fresh-reader` agent then reads only that file (EGM `egm-review` when installed) and appends Open questions under the sections, which are answered in the pane.
- Redesign: `/design` on an approved design, or `/design D3`, is scoped to the whole file or the named section. It bumps `version` and each changed section's `Rev`, writes `design/changes/<date>-design-vN.md`, and never edits PLAN.md or any ticket.
- `/ticket-board:planning` (after Approve design) reads DESIGN.md, the code and BOARD.md, writes phases and builds into PLAN.md, then runs a coverage self-review (every non-dropped section covered by a build, no build without a section) and fixes gaps before finishing. The `planner` agent does the drafting and review.
- Replan (`/planning` when the plan is behind) diffs design versions (change notes and section Revs) against the plan and writes only a proposal to `design/changes/<date>-replan.md`: add build, change build, drop build, follow-up ticket for a done build a change affects. It does not edit PLAN.md or tickets; done tickets are never rewritten.
- `ticket-writer` and `/ticket` write `Plan: P2.3` and `Design: D1@2, D3@1` lines in rd.md when the ticket comes from a build; they omit them otherwise.
- Edge cases: unknown scope argument gets a one-line error listing valid forms; missing DESIGN.md on `/design D3` or `/planning` says to run `/design` first; goldfish agents have read-only tools and cannot write files.

## Scope

IN: the three skills, four agents, `Plan:`/`Design:` support in `agents/ticket-writer.md` and `skills/ticket/` (SKILL.md, TEMPLATE/rd.md), README and docs.
OUT: pane buttons, Start screen, Plan/Design views and batch ticket creation (tickets 0004, 0007, 0008); the parser (0003); the file standard and templates (0001); drift check; any TypeScript.

## Touchpoints

- New: `skills/brainstorm/SKILL.md`, `skills/design/SKILL.md`, `skills/planning/SKILL.md`; `agents/elephant.md`, `agents/goldfish.md`, `agents/fresh-reader.md`, `agents/planner.md` (same frontmatter style as `agents/ticket-writer.md`: name, description, tools).
- Edit: `agents/ticket-writer.md`, `skills/ticket/SKILL.md`, `skills/ticket/TEMPLATE/rd.md` (add the optional `Plan:` / `Design:` lines under `Type:`).
- Read only: `PLAN-design-plan.md` sections 3 and 5; `docs/STANDARD.md` and the templates from 0001; EGM's `skills/egm_brainstorm/SKILL.md`, `agents/synthesizer.md` under `~/.claude/plugins/marketplaces/egm`.
- Plugin auto-discovers `skills/` and `agents/`; `.claude-plugin/plugin.json` needs no list, but bump nothing (release is 0009).

## Docs

- `README.md`: add rows for the three skills and four agents to the "The plugin includes" table (around line 58); add the new files to the Layout block under Development (around line 329).
- `skills/ticket/SKILL.md` and `skills/ticket/TEMPLATE/rd.md`: document the `Plan:` / `Design:` lines.
- `docs/STANDARD.md` (from 0001): no change unless a line format differs from what the skills write.
- `PLAN-design-plan.md` section 5: note the elephant role in the built-in brainstorm row.
- CHANGELOG, CLAUDE.md, AGENTS.md: none exist in this repo; no change.

## Open questions

- Is EGM optional, used when installed with the built-in elephant + goldfish fallback otherwise, or required? [optional with fallback (default); required]
  **Resolved 2026-11-10 (human): EGM is optional: the skills use `/egm:egm-brainstorm` and `egm-review` when EGM is installed, and fall back to the built-in elephant and goldfish path otherwise, with the brief stating which path was used.**
- Split out: should this be three tickets (brainstorm + elephant/goldfish; design + fresh-reader; planning + planner + `Plan:`/`Design:` lines)? [keep as one M-size ticket; split into three]
  **Resolved 2026-11-10 (human): Keep it as one M-size ticket; the ticket already scopes all three skills and four agents together, and splitting would break the shared file standard and the Plan/Design line work it depends on.**
- Maximum elephant rounds before it must write the brief? [3 (as drafted); 2; ask the person each round]
  **Resolved 2026-11-10 (human): The ticket already drafts this as 3 rounds, so keep the maximum at 3; the elephant writes the brief after round 3 even if questions remain, listing them as open questions.**
- Should the elephant be a separate agent file, or the brainstorm skill itself acting as elephant in the main chat? [separate `elephant` agent (as drafted, holds context across rounds); the main session is the elephant]
  **Resolved 2026-11-10 (human): The elephant should be a separate `elephant` agent file, as drafted, because it has to hold the whole context across rounds while the goldfish run in isolation, and the main chat session would otherwise see the goldfish output and break their no-shared-context rule.**

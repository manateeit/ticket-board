# Eval — 0005 — Brainstorm, design and planning skills and agents

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` in the repo root (tsc is not installed; do not run it)
   - Pass: both exit 0, no warnings about the new skills or agents
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed, nothing reported about the new skills/agents); `claude plugin test .` 53 pass, 0 fail (network notices only).

2. Files exist with valid frontmatter
   - Run: read `skills/brainstorm/SKILL.md`, `skills/design/SKILL.md`, `skills/planning/SKILL.md`, `agents/elephant.md`, `agents/goldfish.md`, `agents/fresh-reader.md`, `agents/planner.md`
   - Pass: all seven exist; each has `name` and `description` (agents also `tools`); `goldfish` and `fresh-reader` have no Write/Edit tools
   - Result: PASS
   - Evidence: All seven files exist with name+description; agents have tools: elephant Read,Grep,Glob,Agent,Write; goldfish Read,Grep,Glob; fresh-reader Read; planner Read,Grep,Glob,Write,Edit. goldfish and fresh-reader have no Write/Edit.

3. Built-in brainstorm has an elephant
   - Run: read `skills/brainstorm/SKILL.md` and `agents/elephant.md` and `agents/goldfish.md`
   - Pass: elephant holds context across rounds, starts 4 goldfish in parallel (user, simplest thing, risk, what's missing), reads their output and writes keep/cut; goldfish get no shared context; the fallback is not described as goldfish plus a bare synthesis step
   - Result: PASS
   - Evidence: brainstorm SKILL starts one ticket-board:elephant; elephant.md holds context across up to 3 rounds, starts 4 goldfish in one parallel message (user, simplest thing, risk, what's missing), reads all four, decides keep/cut/re-ask, writes brief with Kept/Cut. goldfish prompt carries only lens, item, file paths; goldfish forbidden from reading design/brainstorms. Not described as goldfish plus bare synthesis.

4. EGM bridge and fallback
   - Run: read `skills/brainstorm/SKILL.md` and `skills/design/SKILL.md`
   - Pass: both say to use `/egm:egm-brainstorm` / `egm-review` when installed, and use the built-in path otherwise; the brief records which path ran; scope forms `whole | D3 | P2 | 0007` are all covered with the unknown-scope error
   - Result: PASS
   - Evidence: brainstorm: EGM detected (installed_plugins.json or listed skill) -> /egm:egm-brainstorm (reads EGM SKILL.md since Skill tool refuses it; path verified to exist), else elephant path; brief has `Path:` line. design: egm-review when installed else fresh-reader. Scope forms whole|D<n>|P<n>|ticket number handled, unknown scope gives the one-line error listing valid forms; missing design/plan message present.

5. Design and redesign rules
   - Run: read `skills/design/SKILL.md`
   - Pass: reads code first (blank repo skipped), one question at a time, 2–3 approaches, `status: draft`, fresh-reader adds Open questions; redesign bumps `version` and section `Rev`, writes `design/changes/<date>-design-vN.md`, never edits plan or tickets
   - Result: PASS
   - Evidence: design SKILL: code first (blank repo skipped), one question per message, 2-3 approaches, status: draft (never approved), fresh-reader appends Open questions under D sections. Redesign (approved design or D<n>) bumps version and section Rev, writes design/changes/<date>-design-vN.md, never edits PLAN.md or tickets. Extra: redesign resets status to draft - not contradicted by rd.md.

6. Planning, coverage review and replan proposal
   - Run: read `skills/planning/SKILL.md` and `agents/planner.md`
   - Pass: writes PLAN.md phases and builds; coverage self-review fixes gaps before finishing; replan writes only `design/changes/<date>-replan.md` with the four proposal kinds and never rewrites done tickets
   - Result: PASS
   - Evidence: planning SKILL + planner: plan mode writes PLAN.md phases/builds with exact table header, coverage self-review (every non-dropped section covered, no build without section, Needs valid) fixes gaps before finishing, skill re-checks. Replan writes only design/changes/<date>-replan.md with Add build / Change build / Drop build / Follow-up ticket; never edits PLAN.md/tickets; done tickets never rewritten. Missing DESIGN.md -> run /design first. Extra: refusing a draft design is consistent with 'after Approve design'.

7. Plan:/Design: lines in the ticket writer
   - Run: read `agents/ticket-writer.md`, `skills/ticket/SKILL.md`, `skills/ticket/TEMPLATE/rd.md`
   - Pass: all three describe `Plan:` and `Design: D1@2, D3@1` under `Type:`, optional; the original hard limits of ticket-writer are unchanged
   - Result: PASS
   - Evidence: ticket-writer.md, skills/ticket/SKILL.md, TEMPLATE/rd.md all describe optional Plan: P2.3 and Design: D1@2, D3@1 under Type:; format matches docs/STANDARD.md section 4. git diff of ticket-writer is additions only; original hard limits unchanged.

8. End-to-end dry run
   - Run: in a scratch project with the plugin loaded (`claude --plugin-dir .`) and without EGM, run `/ticket-board:brainstorm whole` on a one-line idea, answer the elephant, then `/ticket-board:design`
   - Pass: a brief appears in `design/brainstorms/` stating the built-in path with keep/cut lists; DESIGN.md is created with `status: draft`; no plan or ticket file was changed
   - Result: PASS
   - Evidence: Worker's headless run in /tmp/claude-501/e2e-0005 inspected: design/brainstorms/2026-11-10-salon-booking-page.md has `Path: built-in (elephant + 4 goldfish, 2 rounds)`, Kept and Cut lists, Open questions; design/DESIGN.md created with status: draft, version 1, fresh-reader Open questions under D sections; no PLAN.md, no tickets/ folder; README.md unchanged. Caveat: not interactive. The session answered for the person (brief notes 'Decisions taken without the person'), the 'without EGM' override was needed because EGM is installed, and the elephant-asks/skill-relays/SendMessage-continue loop and one-question-at-a-time design dialogue were not exercised live. I could not run it interactively either (headless, no network in my sandbox). Pass criteria are all artifact-based and met; live conversation quality is listed as not automated.

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README's plugin table and Layout block list the new skills and agents; ticket skill docs describe `Plan:`/`Design:`; PLAN-design-plan.md section 5 mentions the elephant; each doc describes the new behaviour as built
   - Result: PASS
   - Evidence: README table has rows for 3 skills and 4 agents (ticket-writer row mentions Plan:/Design:); Layout block lists new agents and skills; skills/ticket SKILL.md and TEMPLATE/rd.md document Plan:/Design:; PLAN-design-plan.md section 5 brainstorm row, new-pieces paragraph and M4 row mention the elephant; STANDARD.md unchanged and its formats match.

## Not checked by automation

- Quality of the brainstorm and design conversations (a human should run one real session).
- Behaviour with EGM installed (needs the EGM plugin present).

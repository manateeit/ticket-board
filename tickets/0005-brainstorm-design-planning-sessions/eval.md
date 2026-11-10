# Eval — 0005 — Brainstorm, design and planning skills and agents

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` in the repo root (tsc is not installed; do not run it)
   - Pass: both exit 0, no warnings about the new skills or agents
   - Result:
   - Evidence:

2. Files exist with valid frontmatter
   - Run: read `skills/brainstorm/SKILL.md`, `skills/design/SKILL.md`, `skills/planning/SKILL.md`, `agents/elephant.md`, `agents/goldfish.md`, `agents/fresh-reader.md`, `agents/planner.md`
   - Pass: all seven exist; each has `name` and `description` (agents also `tools`); `goldfish` and `fresh-reader` have no Write/Edit tools
   - Result:
   - Evidence:

3. Built-in brainstorm has an elephant
   - Run: read `skills/brainstorm/SKILL.md` and `agents/elephant.md` and `agents/goldfish.md`
   - Pass: elephant holds context across rounds, starts 4 goldfish in parallel (user, simplest thing, risk, what's missing), reads their output and writes keep/cut; goldfish get no shared context; the fallback is not described as goldfish plus a bare synthesis step
   - Result:
   - Evidence:

4. EGM bridge and fallback
   - Run: read `skills/brainstorm/SKILL.md` and `skills/design/SKILL.md`
   - Pass: both say to use `/egm:egm-brainstorm` / `egm-review` when installed, and use the built-in path otherwise; the brief records which path ran; scope forms `whole | D3 | P2 | 0007` are all covered with the unknown-scope error
   - Result:
   - Evidence:

5. Design and redesign rules
   - Run: read `skills/design/SKILL.md`
   - Pass: reads code first (blank repo skipped), one question at a time, 2–3 approaches, `status: draft`, fresh-reader adds Open questions; redesign bumps `version` and section `Rev`, writes `design/changes/<date>-design-vN.md`, never edits plan or tickets
   - Result:
   - Evidence:

6. Planning, coverage review and replan proposal
   - Run: read `skills/planning/SKILL.md` and `agents/planner.md`
   - Pass: writes PLAN.md phases and builds; coverage self-review fixes gaps before finishing; replan writes only `design/changes/<date>-replan.md` with the four proposal kinds and never rewrites done tickets
   - Result:
   - Evidence:

7. Plan:/Design: lines in the ticket writer
   - Run: read `agents/ticket-writer.md`, `skills/ticket/SKILL.md`, `skills/ticket/TEMPLATE/rd.md`
   - Pass: all three describe `Plan:` and `Design: D1@2, D3@1` under `Type:`, optional; the original hard limits of ticket-writer are unchanged
   - Result:
   - Evidence:

8. End-to-end dry run
   - Run: in a scratch project with the plugin loaded (`claude --plugin-dir .`) and without EGM, run `/ticket-board:brainstorm whole` on a one-line idea, answer the elephant, then `/ticket-board:design`
   - Pass: a brief appears in `design/brainstorms/` stating the built-in path with keep/cut lists; DESIGN.md is created with `status: draft`; no plan or ticket file was changed
   - Result:
   - Evidence:

9. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README's plugin table and Layout block list the new skills and agents; ticket skill docs describe `Plan:`/`Design:`; PLAN-design-plan.md section 5 mentions the elephant; each doc describes the new behaviour as built
   - Result:
   - Evidence:

## Not checked by automation

- Quality of the brainstorm and design conversations (a human should run one real session).
- Behaviour with EGM installed (needs the EGM plugin present).

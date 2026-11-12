# 0024 — One rule for resolved questions

Type: bug

## What

Whether an open question is answered is decided only by a pane heuristic in `hooks/core/ticket.ts:115`. Its pattern `/\bresolved\b.*\(human|agent\)/i` parses as "resolved…(human" OR "agent)", so any detail line containing `agent)` (e.g. "(ask the agent)") marks the question resolved, and Mark ready is offered too early. The router only reads "has open questions in its rd.md", so pane and router can disagree.

## Behaviour

- A question is resolved only when it has a `**Resolved <date> (<who>…): …**` line (the form in `skills/ticket/SKILL.md` "Answered questions"), or the existing `~~` / `[x]` forms if kept — whichever forms are accepted are written in one place in the standard.
- A detail line containing "agent)" or "(human" without a Resolved line stays open.
- `**Resolved 2026-11-11 (agent, from code: x.ts): …**` counts as resolved.
- `- none` and the collapsed `- none (resolved …)` forms keep counting as no open questions.
- The router's instructions point at the same rule, so router and pane agree.

## Scope

IN: report L3 (`isResolved`, the standard text, router.md wording). OUT: designfile question parsing changes beyond reusing the same function; other leaks.

## Touchpoints

- `hooks/core/ticket.ts` (~L115, `answerQuestion` ~L146), `hooks/core/designfile.ts` (reuses it)
- `skills/ticket/SKILL.md` "Answered questions", `docs/STANDARD.md`, `.claude/agents/router.md` ~L25
- Source: `tickets/audits/leaks-2026-11-11.md` L3

## Docs

- README.md — where open questions / Mark ready are described: state the resolved rule.
- docs/STANDARD.md — the accepted resolved forms.

## Open questions

- none

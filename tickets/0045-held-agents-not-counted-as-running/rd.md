# 0045 — Held agents are not counted as running

Type: bug

## What

The pane counts an agent in the host's `waiting` status as running. The host's
`AgentStatus` docs (`.claude-plugin/types/claude-code/index.d.ts`, `AgentStatus`)
say `waiting` means *held*: on background work the agent owns, on a plan's
approval, or (in a background subagent) on an Agent call. It is not running a
turn. On 2026-11-12, Worker 0040 and Checker 0041 had finished and their tickets
were merged hours earlier, yet the pane showed "AGENTS · 2 RUNNING" and "Waiting
on 2 agents · Claude continues when they report" until they were stopped by hand
(TaskStop), after which they showed as `killed`. The person could not tell that
nothing was working, and stopping the agents looked like something had killed
live work.

## Behaviour

- Only `pending` and `running` agents count as running: in the Agents panel's
  `AGENTS · N RUNNING` heading and list, the *Agents ● N* button count, the
  desktop activity strip's "N agents running" and "Waiting on N agents", and the
  pane tab's `● working` title.
- `waiting` agents are listed in their own group, **Held**, under the running
  list, each with its `waiting` pill. If a held agent's ticket
  (`ticketOfAgent`) is `done` on the board, its line also says
  `ticket done: probably leftover`.
- When the main turn has ended and the only agents left are held, the activity
  strip says `N agents held · nothing running` (no "Claude continues when they
  report"). The strip is still not the quiet "Claude is idle", because the agents
  exist.
- `idle` agents (between turns, waiting for a message) never count as running
  and never keep the strip up; they are listed under **Recently finished** like
  the ended ones.
- `completed`, `failed` and `killed` are unchanged.
- A status the pane does not know (a future host value) is not counted as
  running and is shown with its raw word, like today.

## Scope

- IN: how the pane classifies the host's agent statuses and how it words
  running, held and finished agents in the panel, the strip, the button count
  and the tab title.
- OUT: stopping agents from the pane (the plugin API has no stop call), changing
  what the host reports, and the 0042 untracked-writer slots (they still count
  as writers, not agents).

## Touchpoints

- `hooks/store.ts` `LIVE` / `isLive` (~L1021): the one place that decides
  running. Split it so held is its own predicate.
- `hooks/desk.tsx` `ActivityBar` (~L335–360), `AGENT_HEX` (~L172), the agents
  card (~L230).
- `hooks/views.tsx` agents panel (~L305–330), the *Agents ● N* button.
- Whatever sets the tab's `● working` title (grep `working`).
- `tests/pane.test.tsx`: existing activity-strip and agents-panel tests.

## Docs

- README.md: the **Activity** paragraph (Board section, "Waiting on N agents…")
  and the Agents panel description. Say which statuses count as running, what
  Held means and that a held agent with a done ticket is probably a leftover.
- No other docs.

## Open questions

- none

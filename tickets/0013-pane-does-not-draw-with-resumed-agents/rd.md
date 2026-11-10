# 0013 — Pane does not draw when a resumed agent is listed twice

Type: bug

## What

In a session where a finished subagent is resumed (SendMessage to it), `$.agent.list()` can return that agent's `id` twice. The pane stored the raw list, so the Agents panel drew two rows with the same keys (`agent-<id>`, `agent-w-<id>`, …) and the host refused to draw the pane: "ticket-board has not drawn in this pane". Should: the pane always draws; each agent shows once, with its latest state. Reproduce: list one id twice (completed, then running) and open the board with the Agents panel. Found and fixed by the reproducer (branch `worktree-agent-a0a8217dd3ac22f7f`, commit b6a8915); pre-existing in 0.4.12.

## Behaviour

- `loadAgents` keeps one entry per agent id: the last one listed (the latest state).
- The board, the Agents panel and its Activity toggle draw with unique keys when the list holds duplicate ids, unknown statuses, or agents without name or description.
- Nothing else about the panel changes.

## Scope

In:
- `hooks/store.ts` `loadAgents`; a regression test in `tests/pane.test.tsx`.

Out:
- Tickets 0010–0012 (button bugs): may share this cause; re-test them after this lands.
- A release/publish of the fix.

## Touchpoints

- hooks/store.ts — loadAgents
- hooks/desk.tsx — AgentsPanel (keys rows by agent id; unchanged)
- tests/pane.test.tsx — regression test

## Docs

- README.md — no change: a bug fix with no user-facing behaviour or option change.

## Open questions

- none

# 0017 — Explain a failed agent run

Type: feature

## What

In the Agents panel, an agent that ended badly shows only a red `● failed` (or `● killed`) pill, with no reason and no hint of what happens next. Pressing that status should open a short explanation: what the run was doing, why it ended (as far as this session saw), and whether something is trying again or nothing is. This saves digging through transcripts to find out whether a failure needs the person.

## Behaviour

- In the Agents panel (desktop card and terminal lines), the status of an agent with status `failed` or `killed` can be pressed. Pressing it opens a **failure detail** box under that agent's row; pressing it again, or **Hide** in the box, closes it. Only one detail box is open at a time. Other statuses are not pressable and look as today.
- The detail box shows, each line left out when unknown:
  - **What it was doing:** name/description, type, and its ticket (a link that opens the ticket, as the row link does today) with that ticket's board status and Notes cell.
  - **Why it ended**, in plain words from the run's last `turn.complete` seen by the pane: `error` → "Stopped on an API error (retries used up or context limit)", `aborted` → "Interrupted (stopped by you or by its spawner)", `refusal` → "The model refused" plus the refusal's category and explanation, `answer` → "It finished its turn but was marked failed". Plus when it ended (HH:MM) and how long the turn ran.
  - **Last words:** the run's final answer text, at most 12 lines (cut with `…`), or "No final text" when it was empty.
  - **Last steps:** the last 5 tool steps from the agent's activity log, in the same wording as the Activity box.
  - **Next:** one of
    - "Trying again: <name> is <status> now" when another agent on the same ticket is live (pending, running, waiting); the name is a button that opens that agent's Activity;
    - "Tried again: <name> <status>" when another agent on the same ticket comes after it in the agent list and has finished;
    - "Not retried: nothing else is working on this" otherwise.
    For an agent with no ticket, "same ticket" means the same `name`, or else the same type and description.
  - **Open transcript ↗**, offered for failed/killed agents too (the existing fallback message applies when the app refuses).
- When the pane did not see the run end (it loaded after the failure, or the session was resumed), the "why" line reads "The pane did not see how this run ended. Open its transcript for the reason." The rest still shows.
- A `failed` agent that later turns live again (resumed) closes its detail box on the next agent refresh.
- The pane never retries or restarts anything itself, and writes no file.
- `/board` behaviour, BOARD.md, the ticket writer's toast and its Notes text are unchanged.

## Scope

In:
- Pressable failed/killed status and the detail box on desktop and terminal.
- Recording each agent's last `turn.complete` (reason, refusal, answer, time, duration) in pane memory for this session.
- Pane tests for both surfaces.

Out:
- A Retry button or any automatic retry.
- Explaining `blocked` tickets or failed checks from a router in another session.
- Keeping failure details across sessions or pane reloads.

## Touchpoints

- `hooks/desk.tsx` — `AgentsPanel` (`agentRow`, `activity`, `AGENT_HEX`, `openTranscript`): pressable pill and the desktop detail box.
- `hooks/views.tsx` — `agentsPanel` (terminal lines): pressable status and the plain-text detail.
- `hooks/register.tsx` — the `turn.complete` hook: record the run's end for every `e.agentId`, not only writer jobs.
- `hooks/store.ts` — `S` (beside `agentLog`, `watching`), `resetSession`, `loadAgents`, `isLive`, `ticketOfAgent`: where the per-agent end record and the open detail id live, and the "same ticket / retry" lookup.
- `.claude-plugin/types/claude-code/index.d.ts` — `AgentInfo`, `AgentStatus`, `TurnCompleteInput`, `TurnRefusal` (what the engine gives; `AgentInfo` itself carries no error).
- `tests/pane.test.tsx` — the `agent.list` stub (line ~116) and existing Agents tests to extend.

## Docs

- README.md — "The pane, view by view", the **Agents.** paragraph: say a failed or killed agent's status can be pressed to show why it ended and whether it is being retried, on desktop and terminal.
- README.md — Board section, **Buttons** bullet for Agents: no change unless the wording of the panel link changes.
- `docs/STANDARD.md` — no change: it covers design/plan/ticket file formats, not the pane.
- `.claude-plugin/plugin.json` version — bump only if the router asks for a release (as in 0012/0014).

## Open questions

- Should `killed` agents get the same detail as `failed`?
  **Resolved 2026-11-10 (agent, from code: hooks/desk.tsx `AGENT_HEX`)**: yes; both are drawn red as an ended-badly state, so both are pressable.
- Should failure details survive a pane reload or a new session?
  **Resolved 2026-11-10 (agent, from code: hooks/store.ts `resetSession`, `agentLog`)**: no; the agent list and activity log are this-session memory only, so the detail is too.
- Split out: explain why a ticket on the board is `blocked` or failed its checks (router or checker in another session), from the ticket view? [separate ticket; fold into this one; not wanted]
- Should the detail box offer a retry action? [no button; a button that fills the prompt box with a retry request for that ticket; later ticket]

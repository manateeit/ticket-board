# 0012 — Agents button does nothing

Type: bug

## What

Reported 2026-11-10: pressing the **Agents** button in the board's title bar (key `a`) no longer opens the agents panel; it worked earlier the same day. It should toggle the panel (`S.showAgents`) below the summary tiles, listing running agents, in-flight tickets and recently finished agents, and reload the list. Today nothing visibly happens.

Likely shared cause with 0010 (+ New ticket) and 0011 (README), reported at the same time. The handlers are fine: `tests/pane.test.tsx` "agents button shows what is running" and the README test press these buttons by key (`ui.press({ key })`) and pass, so the handler logic works and the failure is probably in how a real click or key reaches the button. Candidate: the title bar (`hooks/desk.tsx` ~L517-544) puts a text column (board path, which can truncate) beside the button row without `flexShrink={0}`, the layout problem 0.4.11 fixed only for the project bar (comment at ~L1223); Agents and + New ticket sit in that same row. Other candidates: the 0.4.12 linked-worktree change (`resolveRoot`, `hooks/store.ts` L121) or `loadAgents` failing quietly. The worker must confirm which.

Reproduce (unconfirmed, see Open questions): `/board` on a project with `tickets/BOARD.md`, click **Agents** (or press `a`). Expected: panel opens and the button turns primary. Actual: no change.

## Behaviour

- Click, Enter or `a` on **Agents** toggles the panel on the board view, on desktop and terminal; the button shows primary while open and the count of running agents (`● N`).
- Opening also calls `loadAgents`; if `agent.list` is unavailable the panel opens empty with "No agents running in this session right now." and no error.
- **Hide** in the panel closes it. **Show agents** in the activity strip opens it (and returns to the board first).
- The panel works the same from a linked worktree session, where the board is read from the main checkout.
- If 0010 and 0011 have the same cause, one fix repairs all three buttons.

## Scope

In: find why the press has no effect, fix it, add regression tests for the Agents button.
Out: redesigning the panel; changing what agents are listed; fixing 0010 / 0011 beyond a shared cause (see questions).

## Touchpoints

- `hooks/desk.tsx` — title bar and Agents button (~L517-544), `AgentsPanel` (L165), `ActivityBar` (L302), `ProjectBar` (L1215).
- `hooks/views.tsx` — terminal board and its buttons; `go` (L55).
- `hooks/store.ts` — `loadAgents` (L492), `redraw` (L136), `resolveRoot` (L121), `S.showAgents` (L68).
- `hooks/register.tsx` — `ui.render` handler (L114), `open` (L39), 3 s agents poll (L75).
- `hooks/glass.tsx` — `glassUI` wraps Text/Box on desktop; check it does not alter Button or layout.
- `tests/pane.test.tsx` — `boot()` (L89), "agents button shows what is running" (L233).

## Docs

- README.md — "Agents" paragraph (L95) and the buttons/keys list (L108, "The `/board` command and keys" L255): no change if behaviour is restored as written; fix them if the label, key or panel placement changes. Add a Troubleshooting row (L297) if the cause is a user-visible condition.
- No CHANGELOG, docs/, CLAUDE.md or AGENTS.md in the repo.
- `.claude-plugin/plugin.json` — bump `version` (now 0.4.12) if the per-fix convention applies.

## Open questions

- Fix all three in one ticket (0010, 0011, 0012)? [yes, merge into one ticket, no, keep three but fix the shared cause once under the lowest-numbered ticket]
  **Resolved 2026-11-10 (human): Keep the three tickets separate, but fix the shared cause once under 0010, the lowest-numbered ticket. The scope already limits this ticket to the shared cause, so 0011 and 0010 only need the layout fix, not separate work.**
- Which surface fails? [desktop, terminal, both]
  **Resolved 2026-11-10 (human): assume both**
- How is it pressed? [mouse click, Enter on focus, the `a` hotkey, all fail]
  **Resolved 2026-11-10 (human): both**
- Which plugin version is running? [0.4.12, older, `--plugin-dir` worktree checkout]
  **Resolved 2026-11-10 (human): don't know**
- What happens on press? [nothing at all, the panel flashes then closes, the button toggles but no panel shows, an error]
  **Resolved 2026-11-10 (human): nothing at all**
- Is the session in a linked git worktree? [yes, no]
  **Resolved 2026-11-10 (human): i don't know**

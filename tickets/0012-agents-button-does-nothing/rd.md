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

## Findings

Worker, 2026-11-10, on main at 5e2ac52 (plugin 0.4.14).

**Desktop: not reproduced.** On current code, pressing `agents` toggles the panel (`AGENTS · 1 RUNNING`, `worker-0002`), pressing it again or **Hide** closes it, **Show agents** in the activity strip returns to the board from a ticket page and opens it, the button shows `● N`, and it works with resumed (duplicate-id) agents, with `agent.list` unavailable (empty panel, "No agents running in this session right now.", no error) and from a linked worktree session (board read from `/main`). The most likely cause of the desktop report is **0013** (fixed in 0.4.13): in 0.4.12 the Agents panel drew duplicate keys for a resumed agent, and the host stopped redrawing the pane. The Agents button is the one that loads and draws that list, so it was hit first. The harness cannot show this: it keeps pressing keys even when a drawing has duplicate keys. Same conclusion as 0010.

**Terminal: confirmed and fixed.** The terminal board never had an Agents button or panel. The button and panel were added for desktop only (6ef2604), so in the terminal `a` did nothing and there was nothing to click. The ticket says Agents must work on both surfaces, so the terminal board now has **Agents ● N** (key `a`) beside **Refresh**, and a plain panel under the buttons (running agents, in-flight tickets, recently finished, **Hide**). This is a gap that was always there, not a regression, and it does not explain "it worked earlier the same day" unless that was on desktop.

**Desktop title bar: defensive hardening, not a confirmed cause.** The text column (board title and path) sat beside the button group (Run ready, Agents, Refresh, + New ticket) with no `flexShrink={0}` on the buttons and no `minWidth={0}` / truncation on the text. 0.4.11 fixed the same layout for the project bar because a truncated text column can overlap a Button and swallow its clicks. The title bar now has the buttons at `flexShrink={0}` and the text column at `flexShrink={1} minWidth={0}` with `wrap="truncate"`. **Show agents** in the activity strip got the same treatment. The pane harness has no layout or hit-testing, so the test checks these props on `ui.drawn()`; a real click at a narrow width still needs a human (eval "Not checked by automation").

**Small state fix found on the way.** `resetSession` did not clear `S.agents` or `S.showAgents`, so a new session in the same module could start with the last session's agents listed and the panel already open (then the first press of Agents *closed* it). Both are now reset. Not the reported cause.

**Other candidates ruled out.** `resolveRoot` (linked worktree): the panel opens the same there (test). `loadAgents` failing quietly: it catches the error, the button has already flipped `S.showAgents` and redrawn, so the panel opens empty as the ticket specifies (test).

**Shared with 0010 / 0011?** Yes for the desktop report: the same most-likely cause (0013, already fixed). The title-bar hardening also covers **+ New ticket** (same row). It does not touch the README button (project bar, already fixed in 0.4.11). The terminal gap is specific to Agents: + New ticket and README always had terminal buttons.

Tests added in `tests/pane.test.tsx` under "Agents (0012)", right after "agents button shows what is running". With the `hooks/` changes reverted, 6 of the 11 new tests fail (the four terminal tests, the title-bar layout test and the new-session test); the desktop press tests pass on old code, as expected for a cause that was fixed in 0.4.13.

Docs: README updated (title bar list, Agents paragraph incl. Hide / Show agents / empty panel / terminal, Board buttons list, keys table gains `a`). No Troubleshooting row: nothing for the user to fix. `plugin.json` version not bumped (router instruction).

# 0010 — New ticket button does nothing

Type: bug

## What

Reported 2026-11-10: pressing **+ New ticket** in the ticket-board pane has no visible effect. Pressing it should switch the pane to the New ticket form (kind, title, description, mode, depends-on, and the Create buttons). Today the pane stays on the board. The code wires both buttons to `go($, { kind: 'new' })` and renders the form for `S.view.kind === 'new'`, and no existing test presses the button, so the cause is not visible from reading. The worker must reproduce it, find the cause, fix it, and add a regression test.

Reproduce (to be confirmed, see Open questions): open `/board` on a project with `tickets/BOARD.md`, stay on the board view, press **+ New ticket** (header row on desktop, button row under the status counts in the terminal) or press `n`. Expected: the form opens. Actual: nothing changes.

## Behaviour

- Pressing **+ New ticket** on the board, by click, Enter or the `n` hotkey, replaces the board with the New ticket form on both surfaces: desktop (`deskNew`) and terminal (`newView`).
- The form shows its Description input (key `new-idea`) focused and the Create buttons; `‹ Board` / Back returns to the board.
- Any message or confirm left over from the board is cleared on opening (as `go` does today).
- The same works from the other entry points that open the form: `+ Create the first ticket` on an empty desktop board, and `/board new <idea>` (idea prefilled).
- If the form cannot open for a reason that is expected (no board yet, board has no table), the pane says so instead of doing nothing.
- No other view or button changes behaviour.

## Scope

- IN: find why the press has no effect on whichever surface fails; fix it; add pane tests for both surfaces.
- OUT: redesigning the form, changing Create / AI enhance behaviour, other buttons.

## Touchpoints

- `hooks/desk.tsx` — `+ New ticket` button (~L542), `deskNew` (~L1100), the empty-board button (~L617).
- `hooks/views.tsx` — `go` (L55), terminal `+ New ticket` button (~L172), `newView` (~L646), `drawPane` view switch (~L784-830).
- `hooks/store.ts` — `View` type (L37), `redraw` (L136), `S.view` state; `createSkeleton` (L345) is only used after the form opens.
- `hooks/register.tsx` — `/board new` (L90), `ui.render` handler (L114).
- `tests/pane.test.tsx` — `boot()` helper (L89) and existing per-surface tests (L128 on); add the new test here.

## Docs

- `README.md` — no change if behaviour is restored as documented: "The pane, view by view" (L99, L108), "Creating a ticket with the AI writer" (L186) and the keys table (L268) already say the button / `n` opens New ticket. Update only if the fix changes a documented key or label, and add a Troubleshooting row if the cause is a user-visible condition.
- No CHANGELOG, `docs/`, CLAUDE.md or AGENTS.md exist in the repo.
- Bump `version` in `.claude-plugin/plugin.json` (now 0.4.12) only if the project's convention for fixes calls for it (recent commits bump it per fix).

## Open questions

- Which surface shows the problem? [desktop app, terminal, both]
  **Resolved 2026-11-10 (human): Assume both surfaces until reproduced, since the report doesn't say which one fails and the fix needs a pane test on each. Start with the desktop `deskNew` path and the terminal `newView` path, and fix whichever one doesn't switch to the form.**
- How is the button pressed? [mouse click, Enter on focus, the `n` hotkey, all of them]
  **Resolved 2026-11-10 (human): All of them: the ticket says the press fails for click, Enter and `n` alike, and it is wired through the same `go($, { kind: 'new' })` call, so the fix should cover all three, with the pane test pressing the button on each surface.**
- Which plugin version is running? [0.4.12 (current), older, a worktree checkout via `--plugin-dir`]
  **Resolved 2026-11-10 (human): you need to check .. i don't know**
- What exactly happens on press? [nothing at all, the board flickers and stays, the form flashes then returns, an error toast, the setup view appears]
  **Resolved 2026-11-10 (human): nothing at all**
- Does `/board new <idea>` or the `+ Create the first ticket` button open the form for you? [yes, no, not tried]
  **Resolved 2026-11-10 (human): i have not tried that yet.**
- Does the project have a `tickets/BOARD.md` with a ticket table when it fails? [yes, no board yet, board without a table]
  **Resolved 2026-11-10 (human): yes.. its this project.**

## Findings

Worker, 2026-11-10, on main at 4fb7f16 (plugin 0.4.14): **not reproduced; no `hooks/` change.**

What was tried. Every case passes on current code, on both surfaces:
- **+ New ticket** on the board (`ui.press({ key: 'new' })`) opens the form: you see the `New ticket` text, `new-idea` and `create-ai`, and the board rows are gone. Back brings the board back. `create-plain` writes `tickets/0004-export-button-does-nothing/rd.md` and the pane shows the new ticket.
- `/board new foo` opens the form with `foo` in the Description. On an empty desktop board, `+ Create the first ticket` (`new-empty`) opens the form.
- The same press works with resumed agents listed twice (the 0013 fixture), with the desktop Agents panel open first.
- It works on a plan-bound board with a roadmap card (the `Design: … · Plan: …` line).
- It works in a throwaway run that used this repo's real `tickets/BOARD.md`, `design/` and every ticket folder. That run was not kept.
- `go()`, `redraw()`, `drawPane`'s view routing (including the 0004 Start screen), and the `ui.render` handler all switch to `new` without anything in between. No other button on the board or Start uses the `n` hotkey, and no board Input has `autoFocus` that could take the `n` key.

Most likely cause: **0013**, which shipped in 0.4.13. The report came from 0.4.12. In 0.4.12, `$.agent.list()` could return a resumed agent twice, the desktop Agents panel drew duplicate keys, and the host stopped drawing the pane. A pane that no longer redraws makes every button look dead. That fits this ticket and the matching README (0011) and Agents (0012) reports.

The test harness does not model that: it still lets other keys be pressed when a drawing has duplicate keys. So the new tests cannot fail without the 0013 fix, and eval check 4 cannot be met by a test that fails today.

Remaining hypothesis (not reproducible in the in-memory pane): a desktop layout overlap. In the board title bar, the title column sits beside the button group, which has no `flexShrink={0}`. 0.4.11 already moved the ProjectBar buttons onto their own row for this reason ("a truncated text column can overlap a Button beside it and swallow its clicks"). If a person still sees this on 0.4.14 in the desktop app, try that next.

Regression tests were added in `tests/pane.test.tsx` under "New ticket (0010)". README needs no change: behaviour, keys and labels are as documented, and the cause (fixed in 0013) was not a user-fixable condition.

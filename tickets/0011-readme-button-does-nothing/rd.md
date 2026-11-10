# 0011 — README button does nothing

Type: bug

## What

The README button in the pane's project header does nothing when the person presses it: no README view opens and nothing visibly changes. It was reported once before; 0.4.11 ("buttons on their own row so desktop clicks land") only moved the button to its own row in `ProjectBar` and did not fix it for this person, so the fix is incomplete or regressed.

Should happen: pressing **README** (or its hotkey `o`) opens the README view (rendered README.md, a back button, an "Ask Claude to update it" button). Pressing it again (it then reads **‹ Board**) returns to the board.

Reproduce: run `/board` in a project that has a README.md, then click **README** in the PROJECT header (desktop) or the `README` button after the project line (terminal). Expected: the README view. Actual (reported): nothing. The exact surface, version and symptom are not known (see Open questions).

Why the existing test passes: `tests/pane.test.tsx` ("desktop header names the project and repo, and opens the README") calls `ui.press({ key: 'readme' })`, which fires the button's `onPress` directly by key. It never goes through a real click, hit-testing, layout or the `o` hotkey, so it cannot see a button whose clicks are swallowed by the host. The handler path (`openReadme` in `hooks/desk.tsx`: `go()` then `refresh($, true)`) is correct in the test, which points at the click not reaching the button, not at the handler. This is a best guess, not confirmed.

## Behaviour

- Pressing README from the board, a ticket, the questions view or the new-ticket view opens the README view on both surfaces; the header button then reads **‹ Board** (desktop) and pressing it returns to the board.
- The hotkey `o` does the same as the button, and does not fire twice for one press (a double fire would open then close the view, which looks like "nothing").
- With no README.md the button reads **README (none)** and opens a "No README" card, not a blank pane.
- A press must give visible feedback within one redraw, even if the background refresh is busy (`refresh` returns early while another refresh runs; the view switch must not depend on it).
- The README view's own buttons (back, ↻, Ask Claude) keep working.

## Scope

- IN: find why the button does not respond in the real pane and fix it in both layouts; add a test that exercises the press the way the host delivers it, not only by key; docs.
- OUT: redesign of the header, other header buttons (colors) unless they share the same cause, README summary logic.

## Touchpoints

- `hooks/desk.tsx` — `ProjectBar` (README button, lines ~1215-1271), `openReadme`, `deskReadme`.
- `hooks/views.tsx` — `withProject` (terminal README button), `readmeView`, `drawPane` (view switch), `go`.
- `hooks/store.ts` — `refresh`, `loadProject` (readme text).
- `tests/pane.test.tsx` — existing header test (~line 267) and terminal test (~line 285); `boot` helper.
- Git history: commit 6b84724 (0.4.11) is the earlier attempt; compare its `ProjectBar` change with the current one.

## Docs

- `README.md` — "The pane, view by view": add the project header (name, repo, branch, summary) and the README view (README button, `o`, back, Ask Claude). The "The `/board` command and keys" table: add `o` (open/close README). README does not mention either today.
- `README.md` Layout list: no change unless files move.
- No CHANGELOG or docs/ folder exists; if the version is bumped, `.claude-plugin/plugin.json` carries it.

## Open questions

- Which surface does the failure happen on? [Claude desktop app / terminal / both]
  **Resolved 2026-11-10 (human): Both surfaces are unconfirmed, but the ticket's own evidence points at the desktop app: the report says "desktop clicks" and the 0.4.11 fix targeted desktop clicks, so the simplest sensible answer is Claude desktop app, with the terminal README button to be checked as well.**
- What exactly happens on press? [nothing at all / view flashes and returns to the board / pane scrolls or loses focus / error toast]
  **Resolved 2026-11-10 (human): nothing at all**
- Does the `o` hotkey work when the click does not? [yes / no / not tried]
  **Resolved 2026-11-10 (human): no**
- Which plugin version is installed? [0.4.11 / 0.4.12 / other]
  **Resolved 2026-11-10 (human): i don't know the version**

## Findings

Worker, 2026-11-10, on main at 5e2ac52 (plugin 0.4.14).

**Desktop: not reproduced.** In the desktop pane, **README** opens the README view from the board, a ticket, the questions view and the new-ticket form. The button then reads **‹ Board**, and pressing it again returns to the board. Exactly one Button carries hotkey `o` in each view, so one press cannot toggle twice. The view switch is drawn even while another refresh is in flight: `openReadme` calls `go()`, which redraws by itself, before `refresh`, and the early return in `refresh` does not matter. With no README.md the button reads **README (none)** and opens the *No README* card. The README view's own buttons work: back, ↻ and Ask Claude. It also works with resumed agents listed twice (the 0013 fixture), with the Agents panel open. The most likely cause of the desktop report is the same as in 0010: before 0.4.13, the duplicate agent keys stopped the pane redrawing, so every button looked dead (0013).

**Terminal: a real gap, fixed.** In the terminal, the README button (and with it the `o` key) was drawn only above the board and Start. On a ticket, its questions or the new-ticket form, `o` did nothing. In the README view there was no `o` button either, so `o` could not take you back. That matches "the `o` hotkey also does nothing". Fix in `hooks/views.tsx`: `drawPane` wraps the ticket, questions, new and README views in `withProject`, and the button reads **‹ Board** in the README view. The README view's title is now the file name, because the project line is already above it. Without the fix, 5 of the new terminal tests fail (board, ticket, questions, new, and no README).

Tests: `tests/pane.test.tsx`, "README (0011)", on both surfaces.

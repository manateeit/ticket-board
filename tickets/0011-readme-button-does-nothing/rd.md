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

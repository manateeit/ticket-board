# 0020 — Pane goes blank: README view too large for the host

Type: bug

## What

Reported 2026-11-11 on 0.5.0 (desktop): the pane drew fine, the person switched to another session, came back, and the pane showed "nothing to show", staying blank through /reload-plugins, /board and closing/reopening the pane. Reproducer (router-dispatched) found in the desktop log `ui_press not handled {"plugin":"ticket-board","key":"readme"}` (hotkey `o`) then `key:"new"`: the README view had opened. The README (62 KB after 0009) draws as a ~290,000-character tree; the host limit is 20,000 nodes / 32 deep / 100,000 characters serialized, over which the instance unmounts ("nothing to show"). `S.view` stays `readme`, so it stays blank. Also found: bad saved filter values make the render fall back to the engine's empty drawing.

## Behaviour

- The desktop README view shows the README in parts (split before headings or at blank lines, never inside a code block, nothing lost), each part's drawing under the host limit, with Previous / Next part and "Part k of n".
- No view can exceed the host limit silently: an over-limit drawing shows a short "too large for the pane" notice with a way back (‹ Board, or Hide done tickets when the board itself is too big).
- Saved filters and jobs with bad or old values fall back to defaults; the board still draws.
- Board row action column wide enough for "▶ Run" on plated rows.

## Scope

- IN: README paging, the size guard, defensive store loading, the action column width, tests.
- OUT: board paging for very large boards (follow-up), per-project Colors (follow-up), remaining explicit-undefined props (follow-up).

## Touchpoints

- `hooks/desk.tsx`, `hooks/views.tsx`, `hooks/register.tsx`, `hooks/store.ts`, `tests/pane.test.tsx`.

## Docs

- README.md — README view: parts and Previous/Next; Troubleshooting row: "Pane says nothing to show" (too-large view now shows a notice; update).

## Open questions

- none

# 0035 — Tickets folder setting: remaining paths

Type: bug

## What

0025 made Run lines and agent briefs follow the `ticketsDir` setting, but two paths were missed. Pane-filled slash-command prompts (`/ticket`, brainstorm, design, planning, the Start screen; `hooks/views.tsx:929,1129-1133,749`, `hooks/desk.tsx:1135`, `hooks/plan.tsx:172`) carry no board path, so the skills fall back to `tickets/`. `hasCode` (`hooks/core/project.ts:248`) compares top-level folder names with the whole setting and hard-codes `design|tickets`, so a nested folder like `planning/tickets` makes an empty project look like it has code.

## Behaviour

- Every pane-filled slash-command prompt names the board path when it is not the default (same form as `runLine`), and reads exactly as today with the default.
- With ticketsDir `work`, `/ticket <idea>` from "Write it in chat" and Brainstorm on a ticket act on `work/BOARD.md` and `work/<n>-*`.
- `hasCode` ignores the first path segment of the tickets folder and of the bound design and plan files (e.g. `planning/` for `planning/tickets`, `spec/` for `spec/DESIGN.md`).
- An empty project with ticketsDir `planning/tickets` is not treated as having code.

## Scope

IN: report L7, L13. OUT: absolute ticketsDir values; other leaks.

## Touchpoints

- `hooks/views.tsx` (`draftInChat` ~L929, `startPrompt` ~L1129-1133, Brainstorm ~L749)
- `hooks/desk.tsx` ~L1135, `hooks/plan.tsx` (`brainstorm` ~L172)
- `hooks/core/project.ts` (`hasCode` ~L245-249), `hooks/store.ts` ~L335
- Source: `tickets/audits/leaks-2026-11-11-2.md` L7, L13

## Docs

- README.md — Tickets folder setting row: say slash-command prompts follow it too.

## Open questions

- none

# 0029 — Watch buttons handle the host's refusal

Type: bug

## What

`$.ui.view({ agentId })` resolves with `{ deny }` when the host refuses to switch views (desktop). Only `openTranscript` (`hooks/desk.tsx:179`) handles that and falls back to the activity log. The ticket page Watch buttons (`hooks/desk.tsx:1126`, `hooks/views.tsx:647`) only `.catch`, so on desktop pressing Watch while the AI writes a ticket does nothing and shows nothing.

## Behaviour

- Every "show this agent" action goes through one function that handles a resolved deny the same way the Agents panel does (message and activity-log fallback).
- Desktop, Watch on a ticket being written: the person sees the same explanation/fallback as from the Agents panel.
- Where the host allows the switch, Watch opens the transcript as today.

## Scope

IN: report L7. OUT: changing `openTranscript`'s fallback behaviour; other leaks.

## Touchpoints

- `hooks/desk.tsx` (`openTranscript` ~L178-190, Watch ~L1126), `hooks/views.tsx` (~L647)
- Source: `tickets/audits/leaks-2026-11-11.md` L7

## Docs

- README.md — where Watch is described: say what happens on desktop.

## Open questions

- none

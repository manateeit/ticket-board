# 0041 — Store writes: fresh snapshot and no edits under an AI job

Type: chore

## What

Two store write rules live in callers. `editRow` and `saveAnswer` (`hooks/store.ts:660,675`) call `refresh($)` without `force`, so they can get the snapshot of a run that read the files before their write (left over from 0027). And only `startJob` checks for a running AI job: `setKind` (`hooks/desk.tsx:859-865`) and `saveAnswer` write rd.md while the AI is writing it, and the Type select and Save answer stay enabled.

## Behaviour

- After any pane write (status move, answer, Type change), the redraw shows the written value, even if a refresh was running.
- While an AI job holds a ticket, the store refuses rd.md writes for it with a clear message, and the Type select and Save answer controls are disabled with a reason.
- Writes on tickets with no job, and refresh coalescing for the poll, behave as today.

## Scope

IN: report L11, L15. OUT: AI job lifecycle; other leaks.

## Touchpoints

- `hooks/store.ts` (`refresh` ~L374-394, `editRow` ~L660, `saveAnswer` ~L669-675)
- `hooks/desk.tsx` (`setKind` ~L859-868, Type select ~L1186-1191, QuestionsCard ~L915-947)
- `hooks/views.tsx` (questionsView ~L826-835)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L11, L15

## Docs

- README.md — say answers and Type are locked while the AI writes the ticket.

## Open questions

- none

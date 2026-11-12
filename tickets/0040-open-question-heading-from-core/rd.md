# 0040 — Questions section hidden only when core finds it

Type: bug

## What

The desktop ticket page hides the Open questions section with its own regex (`/^open questions?\b/i`, `hooks/desk.tsx:853`), while core (`findSection`, `hooks/core/ticket.ts:34`) does not recognise a singular `## Open question`. Such an rd.md gets no questions card, its section is hidden, and the ready check fails with no visible reason.

## Behaviour

- The ticket page hides a section only when it is the one core's `findSection` returns for open questions.
- An rd.md headed `## Open question` shows that section, so the person can see why the ticket is not readyable (or core accepts the singular and the card shows; pick one rule and use it in both).
- Standard `## Open questions` tickets look exactly as today.

## Scope

IN: report L9. OUT: other section names; other leaks.

## Touchpoints

- `hooks/desk.tsx` (`docSections` ~L853)
- `hooks/core/ticket.ts` (`findSection` ~L34, `parseQuestions` ~L130, readiness ~L214)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L9

## Docs

- README.md — no change: no visible change for standard tickets.

## Open questions

- none

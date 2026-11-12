# 0044 — Every eval.md has Result and Evidence fields

Type: chore

## What

eval.md is one contract: the template (`skills/ticket/TEMPLATE/eval.md`) gives each check Run / Pass / Result / Evidence, and the checker may edit only Result and Evidence. But the pane's plan-build skeleton writes only Run and Pass (`hooks/store.ts:803`), its docs check is a single line (`store.ts:804`), and the plan-build brief (`hooks/ai.ts:74`) and `agents/ticket-writer.md:46` ask only for Run and Pass, so checkers add lines they are told not to.

## Behaviour

- Every eval.md the pane or a writer produces has Run, Pass, Result and Evidence lines for every check, including the docs check, matching the template.
- The plan-build brief and ticket-writer.md ask for the template's fields.
- Existing tickets are not rewritten.

## Scope

IN: report L17. OUT: rewriting old eval.md files; other leaks.

## Touchpoints

- `hooks/store.ts` (skeleton ~L795-806)
- `hooks/ai.ts` (plan-build brief ~L70-75)
- `agents/ticket-writer.md` ~L46-47
- `skills/ticket/TEMPLATE/eval.md`
- Source: `tickets/audits/leaks-2026-11-11-2.md` L17

## Docs

- README.md — no change: no visible change.
- skills/ticket/SKILL.md — if it describes eval.md fields, match the template.

## Open questions

- none

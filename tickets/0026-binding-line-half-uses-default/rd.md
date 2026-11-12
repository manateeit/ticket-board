# 0026 — A half binding line keeps the other default

Type: bug

## What

`bindFromBoard` (`hooks/core/roadmap.ts:401`) uses `design/DESIGN.md` and `design/PLAN.md` only when BOARD.md has no binding line. Once a `Design:`/`Plan:` line exists, a missing half becomes undefined. Adopt writes a one-sided line when it made only one draft (`hooks/ai.ts:764,794`), so a later `design/PLAN.md` is never bound: the Plan tab stays dim and adding a plan ticket throws "No PLAN.md is bound".

## Behaviour

- A binding line overrides only the half it names; a missing half falls back to its default path when that file exists.
- Design-only line + `design/PLAN.md` on disk → plan bound; Plan tab works; `addPlanTicket` succeeds.
- Plan-only line + `design/DESIGN.md` on disk → design bound.
- A missing half whose default file does not exist stays unbound, as today.
- Lines naming both halves behave exactly as today.

## Scope

IN: report L4 (binding resolution and its doc comment). OUT: changing what adopt writes; other leaks.

## Touchpoints

- `hooks/core/roadmap.ts` (`parseBindingLine`, `bindFromBoard` ~L395-405, `setBindingLine` ~L1534)
- `hooks/store.ts` `findDesignAndPlan` (~L265) and `addPlanTicket` (~L797); `tests/core.test.ts` (~L937)
- Source: `tickets/audits/leaks-2026-11-11.md` L4

## Docs

- README.md — the binding line: say a missing half uses the default.
- docs/STANDARD.md — the binding line rule.

## Open questions

- none

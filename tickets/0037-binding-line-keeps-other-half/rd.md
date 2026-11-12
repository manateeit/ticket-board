# 0037 — Binding line keeps the half it is not given

Type: bug

## What

`setBindingLine` (`hooks/core/roadmap.ts:1545`) rewrites the `Design: … · Plan: …` line with only the halves it is given, and `applyAdopt` (`hooks/ai.ts:796`) passes `undefined` for the half the proposal lacks. After 0026 the missing half falls back to its default, so a board bound to `docs/arch.md` that adopts a plan-only proposal silently loses `docs/arch.md` from the Design tab, coverage and checks.

## Behaviour

- `setBindingLine` keeps an existing half when it is not given a new value for it.
- Adopting a plan-only proposal on a board bound to custom design and plan paths keeps the custom design path and binds the new plan.
- A design-only adopt keeps a custom plan path the same way.
- With no existing line, behaviour is as today.

## Scope

IN: report L3. OUT: changing what adopt drafts; other leaks.

## Touchpoints

- `hooks/core/roadmap.ts` (`setBindingLine` ~L1530-1550, `bindFromBoard` ~L400)
- `hooks/ai.ts` (`applyAdopt` ~L760-800)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L3

## Docs

- docs/STANDARD.md section 5 — say rewriting the line keeps a half not being changed.
- README.md — no change unless adopt's binding is described there.

## Open questions

- none

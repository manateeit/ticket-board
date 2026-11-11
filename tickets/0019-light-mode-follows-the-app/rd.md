# 0019 — Light mode that follows the app

Type: feature

## What

Follow-up to 0018 (2026-11-10). After 0.4.20 the person reported: the two dark settings look great, light is "terrible": every non-primary button sits on a heavy black `inverseText` plate, table headers became black boxes, and some controls are still blank (the filter chips after "Hide done 15", a button between the chips and the table). The person chose the design direction "Light that follows the app" in the Design picker.

Research (router, 2026-11-10): on desktop a non-primary Button is the app's native button, drawn in the app's colors. The plugin CAN read the app's light/dark mode: kanban-board (claude-mods/kanban-board 0.14.0, hooks/register.tsx ~L36-47, L1458, L1573) reads `$.config.list()` row `theme` at `session.start` (`isLight = value.startsWith('light')`) and follows `on('config.set', { key: 'theme' })`, then `$.ui.invalidate('ui.render')`. It puts the app's controls on a plate matched to the app theme, one plate per section, not per button.

## Behaviour

- **Read the app theme** at `session.start` from `$.config.list()` (`theme` row; `light…` = light, anything else or unreadable = dark) and follow `config.set` on `theme` (redraw). Store it in `G` / state next to the scheme.
- **Scheme meanings**:
  - `app` (default): the pane's glass matches the app: light glass when the app is light, dark glass when it is dark.
  - `dark`: dark glass always.
  - `light`: light glass always.
- **Light glass when the app is light** (the chosen design): background slate-100 (#F1F5F9), white cards with slate-200 (#E2E8F0) borders and 12px-ish rounding, text slate-900 (#0F172A), secondary text slate-500/600, indigo accent (#4F46E5) for primary/active and links, tiles white with a soft tinted border per status (amber / emerald / indigo / red), status pills as soft tinted chips (e.g. Done = #ECFDF5 bg, #047857 text). The app's own native buttons are used **with no plates at all**.
- **Plates only when glass and app disagree** (light glass + dark app, or dark glass + light app): no per-button boxes. Instead each group of buttons (project header buttons, view tabs, title-bar actions, filter chip rows, sort headers, row action groups) sits on ONE rounded plate matched to the app theme (slate-700 #334155 under a dark app; white with slate-300 border under a light app), with padding and the group's gap inside it. Single buttons inside text (row ID/title) get no plate: draw row ID and title so they read on the card (see next bullet).
- **Board rows**: row ID and title must read in every combination. If a native button cannot be made readable on a white card under a dark app, draw the title as Text (readable color) inside a keyed Box with the press on a small trailing "Open" Button, or keep the Button but give the row a plate — choose the option that looks like the mockup (clean white rows, bold ID, plain title) and document it.
- **Table headers**: sort headers must not become black boxes in light; header labels small caps-ish slate-500 on the card, sort still works.
- **Nothing left blank**: the controls reported blank (filter chips after "Hide done", the button between chips and the table, anything else) are readable in all 3 schemes × 2 app modes.
- Dark schemes keep their current look (the person likes them); only change dark if a contrast check requires it.
- Fonts: same sizes/weights; caption/footnote readable.

## Scope

- IN: app-theme detection, scheme meanings, light palette, group plates, row/header treatment, contrast test extended to 3 schemes × 2 app modes, README.
- OUT: new features, layout redesign beyond the plates/rows/headers above, terminal colors.

## Touchpoints

- `hooks/glass.tsx` — SURFACES/HUES light palette, `glassUI` plating (replace per-button plates with group plates), `setScheme`, app-theme state.
- `hooks/register.tsx` — `session.start` read of `$.config.list()`, `config.set` hook for `theme`.
- `hooks/store.ts` — state for the app theme.
- `hooks/desk.tsx`, `hooks/plan.tsx` — group plates around button groups, board row and header treatment.
- `tests/pane.test.tsx` — the 0018 contrast test extended to the app-mode axis with the theme read from a fake `config.list`; a test that `config.set` theme redraws.

## Docs

- README.md — Settings → Colors: what app / dark / light do now and that the pane follows the Claude app's theme; Troubleshooting row updated.

## Open questions

- none

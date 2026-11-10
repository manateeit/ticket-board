# 0014 — Show the plugin version on the board

Type: feature

## What

Requested 2026-11-10: the board should show which ticket-board version is running, so it is obvious after an update and reload whether the new version actually loaded (today the human cannot tell 0.4.14 from 0.4.15 in the pane). Showing it is a plugin setting the person can switch on and off.

## Behaviour

- A small, muted version label (for example `ticket-board 0.4.15`) is shown on the board view on both surfaces: desktop in the board's title bar area, terminal on the board's header line. It must not crowd or overlap the title-bar buttons (see 0012's layout hardening: buttons do not shrink, text beside them truncates).
- The version comes from the plugin's own manifest (`.claude-plugin/plugin.json` `version`) as loaded at runtime, not a hard-coded string, so it is always the version that is actually running. If the version cannot be read, the label is simply not shown (no error, nothing else changes).
- New plugin setting `showVersion` (boolean, title "Show version", default **on**) in `.claude-plugin/plugin.json` `userConfig`. Off hides the label everywhere. Read the same way as the other options (`hooks/register.tsx` options, `Options` type in `hooks/store.ts`).
- Nothing else in the pane changes. No new keys.

## Scope

- IN: the label on the board view (both surfaces), the `showVersion` setting, tests, README.
- OUT: showing the version on other views, update checks or "new version available" notices.

## Touchpoints

- `.claude-plugin/plugin.json` — `userConfig.showVersion`.
- `hooks/register.tsx` — reading options (~L23).
- `hooks/store.ts` — `Options` type and defaults (~L46-52).
- `hooks/desk.tsx` — board title bar (`deskBoard`).
- `hooks/views.tsx` — terminal board header.
- `tests/pane.test.tsx` — tests for on (label shows the manifest version) and off (no label), both surfaces.

## Docs

- `README.md` — "Settings" table (~L327): add the Show version row. "Board" section (~L141): mention the version label. Troubleshooting (~L346): "Not sure which version is running? Look at the version on the board".

## Open questions

- none

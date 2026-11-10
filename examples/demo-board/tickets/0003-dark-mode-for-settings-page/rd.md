# 0003 — Dark mode for settings page

## What

Let people switch the settings page between light and dark themes, so it matches the rest of the app
for people who already use dark mode elsewhere.

## Behaviour

- Settings shows a **Theme** control with Light, Dark and System.
- Choosing an option applies it at once, without a reload.
- The choice is remembered across sessions.

## Scope

In:
- The theme control and theme styles for the settings page.

Out:
- Theming any other page.

## Touchpoints

- src/pages/settings/SettingsPage.tsx — the page
- src/styles/tokens.css — colour tokens

## Open questions

- Should the choice be stored per device (browser storage) or per account (synced)? [per device / per account]
- Is "System" the default for new users? [System / Light]

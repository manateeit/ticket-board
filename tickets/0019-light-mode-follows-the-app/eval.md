# Eval — 0019 — Light mode that follows the app

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. App theme is read and followed
   - Run: pane tests with a fake `$.config.list()` returning theme `light` and `dark`, then a `config.set` of `theme`
   - Pass: the scheme `app` draws light glass for a light app and dark glass for a dark app; after `config.set` the pane redraws with the other; unreadable config falls back to dark with no error
   - Result:
   - Evidence:

3. Contrast in every scheme × app mode
   - Run: the contrast test over board, ticket, Plan, Design, New, README, questions and Start for schemes app/dark/light × app light/dark
   - Pass: every label passes the 0018 floors; it covers the filter chips, the chip after "Hide done", sort headers, tabs, title-bar buttons, project header buttons and row ID/title
   - Result:
   - Evidence:

4. No per-button plates; group plates only when needed
   - Run: read the drawn tree for light glass + light app, and light glass + dark app
   - Pass: light+light has no plates at all; light+dark has at most one plate per button group (not one per Button); sort headers and row titles are not drawn as dark boxes in light+light
   - Result:
   - Evidence:

5. Dark looks unchanged
   - Run: diff the drawn tree for dark glass + dark app before and after
   - Pass: no change, or only changes the contrast test requires (listed)
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read README.md Settings → Colors and Troubleshooting
   - Pass: describes the schemes and theme-following as built
   - Result:
   - Evidence:

## Not checked by automation

- A person looks at the pane with the Claude app in light and in dark, in each Colors setting, and the light pane looks like the chosen mockup (white cards, soft borders, indigo accent, no black boxes).

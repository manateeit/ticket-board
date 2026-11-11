# Eval — 0019 — Light mode that follows the app

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` -> Validation passed. `claude plugin test .` -> 263 pass, 0 fail (main: 238 pass; no test skipped or deleted, the 0018 contrast tests became per-app-mode variants). Only network-deny notices from the sandbox.

2. App theme is read and followed
   - Run: pane tests with a fake `$.config.list()` returning theme `light` and `dark`, then a `config.set` of `theme`
   - Pass: the scheme `app` draws light glass for a light app and dark glass for a dark app; after `config.set` the pane redraws with the other; unreadable config falls back to dark with no error
   - Result: PASS
   - Evidence: Tests 'Colors <scheme> in a <mode> app draws the <glass> glass' (auto/light -> #F1F5F9, auto/dark -> #0A0F1E, dark/light -> #0A0F1E, light/dark -> #F1F5F9) read the theme from a fake config.list; 'Colors app follows the app when its theme changes' does $.config.set theme light-daltonized then dark and the pane redraws #F1F5F9 / #0A0F1E; 'an unreadable app theme falls back to dark' (config.list denied) draws #0A0F1E, no error text. Code: loadAppTheme wraps $.config.list() in try/catch (also covers a missing row or non-array); on('config.set',{key:'theme'}) returns next's result unchanged (`const r = await next(e); if (r.deny === undefined) followAppTheme(...); return r`), never alters or blocks the change, and has a .catch that calls next(e). Key `theme` and the ConfigRow/ConfigSetResult shapes match the host types.

3. Contrast in every scheme × app mode
   - Run: the contrast test over board, ticket, Plan, Design, New, README, questions and Start for schemes app/dark/light × app light/dark
   - Pass: every label passes the 0018 floors; it covers the filter chips, the chip after "Hide done", sort headers, tabs, title-bar buttons, project header buttons and row ID/title
   - Result: PASS
   - Evidence: All 3 schemes x 2 app modes run the contrast test over board (incl. keys hide-done, mode, phase, search asserted drawn), ticket, Plan, Design, New, README, questions, Start (plus replan banner/review/unreadable from 0016): 36 test runs, all green. Model checked: native Button/Link/Select/Input counted in the app's text color on the ground under them (plate/card/glass), floors 4.5 / 3 as 0018. Caveat: model treats all theme keys (subtle, inactive...) as one app text color.

4. No per-button plates; group plates only when needed
   - Run: read the drawn tree for light glass + light app, and light glass + dark app
   - Pass: light+light has no plates at all; light+dark has at most one plate per button group (not one per Button); sort headers and row titles are not drawn as dark boxes in light+light
   - Result: PASS
   - Evidence: Test 'light glass in a light app': platesOf(tree) is [] and no inverseText; sort-num/sort-title/sort-status/open-0005/title-0005 have only light grounds (luminance > 0.8). Test 'light glass in a dark app': one plate per group (PROJECT scheme+readme; tabs; title-bar runall/agents/refresh/new; status tabs; type chips; filter row hide-done/mode/phase/search; sort headers; row actions open+run), no nesting, plates < controls, no inverseText; row title drawn as Text with an Open button. Same for dark glass in a light app.

5. Dark looks unchanged
   - Run: diff the drawn tree for dark glass + dark app before and after
   - Pass: no change, or only changes the contrast test requires (listed)
   - Result: PASS
   - Evidence: Rendered dark scheme + dark app on main and on this branch (board, ticket, Plan, Design, New, README, questions, Start) and diffed every node. The only differences: (a) all 0018 per-button `Box backgroundColor=inverseText` plates removed (board 18+, ticket 17, Plan 33, Design 17, New 11, README 7, questions 31/6, Start 9); (b) the board sort-header Box gained key `plate-sort` (props otherwise identical). No color, size, weight, text or layout prop changed. The inverseText plates were a 0.4.20 addition for the contrast model (black on the dark glass in a dark app), so removing them leaves the pre-0018 dark look. Plus test 'dark glass in a dark app: no plates, the dark palette as before'.

6. Docs and README updated
   - Run: read README.md Settings → Colors and Troubleshooting
   - Pass: describes the schemes and theme-following as built
   - Result: PASS
   - Evidence: README Settings -> Colors describes app/dark/light as built (app = matches the Claude app, light glass when light, dark when dark; dark/light always), that the theme is read at session start and followed on change, the dark fallback, plates only when glass and app disagree, one per group, Open button on rows. Troubleshooting rows updated (blank buttons/pickers/search; black boxes in light on 0.4.20).

## Not checked by automation

- A person looks at the pane with the Claude app in light and in dark, in each Colors setting, and the light pane looks like the chosen mockup (white cards, soft borders, indigo accent, no black boxes).

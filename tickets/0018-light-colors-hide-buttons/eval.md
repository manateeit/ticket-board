# Eval — 0018 — Light colors hide buttons, tabs and text

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 213 pass, 0 fail (203 before; 10 new tests, none skipped or deleted). Sandbox network-deny notices only.

2. Contrast test in every scheme
   - Run: a pane test that renders the desktop board, a ticket, Plan, Design and Start in each scheme (auto, dark, light) and computes the contrast of every Button label and Text color against the background it sits on (the nearest ancestor background, or the scheme's surface)
   - Pass: every pair is at least 4.5:1, or at least 3:1 for bold/large text and dimmed controls; the test fails on the code before the fix in the light scheme
   - Result: PASS
   - Evidence: Tests render desktop board, ticket, Plan, Design, new, README, questions and Start in auto/dark/light, each against app light and dark mode, via `contrastFailures` in tests/pane.test.tsx (floors 4.5, 3 for large/bold/dimmed). All pass after the fix. Independently restored hooks/glass.tsx from af22c53: 204 pass, 9 fail (all nine scheme view tests, including light), then restored. Caveat: the model assumes a native Button/Link label reads on an `inverseText` plate (app's own colors), and `inverseText` appears only in glass.tsx and the tests; no host type definitions exist in this repo, so the root cause and the key are not verifiable here.

3. The reported elements
   - Run: read the drawn tree for the light scheme
   - Pass: the Plan and Design tabs, the filter chips, the title-bar buttons, README and Colors in the project header, and board row ID and title all have explicit readable colors (not inheriting near-white app colors)
   - Result: PASS
   - Evidence: Light-scheme test covers key tab-plan, tab-design, filter chips, title-bar buttons, readme, scheme (Colors), row open-NNNN and title-NNNN Buttons; each is plated and its Text carries an explicit hex. Reading hooks/glass.tsx: every non-primary Button and Link is wrapped in a Box with backgroundColor 'inverseText' in dark and light.

4. Nothing else changed
   - Run: diff review of hooks/
   - Pass: only colors, variants and contrast-related props changed; no layout, key, hotkey or behaviour changes
   - Result: PASS
   - Evidence: Diff of hooks/ is glass.tsx only: palette hexes, AUTO_KEY mapping, code-block background, and the Button/Link plate wrapper. No keys, hotkeys or behaviour changed; no explicit-undefined props, no `$` or `h` locals added. Caveat (judged acceptable, not a clean FAIL): the wrapper Box is a structural layout node, not only colors. The harness has no layout engine, so gaps, flexWrap, flexShrink or truncation of the title-bar group (flexShrink 0), chip rows (flexWrap) and row title Buttons (wrap=truncate in a flexShrink 1 column, where a stretch-width wrapper makes a full-width plate) were NOT verified. The key stays on the inner Button, so ui.find and press by key work (tests pass), but the wrapper carries no key in mapped lists. Plain Buttons (row ID, title, stale chips) also get plates. A human look in dark and light is required.

5. Docs and README updated
   - Run: read README.md Settings and Troubleshooting
   - Pass: Colors schemes described as built
   - Result: PASS
   - Evidence: README Settings has a Colors section (app, dark, light, what each does, contrast promise, plates) and a Troubleshooting row for blank buttons or tabs; the desktop layout paragraph no longer claims 'one dark glass'. Matches what was built.

## Not checked by automation

- A person looks at the pane in the desktop app in each Colors setting, with the app in light and in dark mode, and can read every tab, button and row.

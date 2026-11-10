# Eval — 0018 — Light colors hide buttons, tabs and text

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Contrast test in every scheme
   - Run: a pane test that renders the desktop board, a ticket, Plan, Design and Start in each scheme (auto, dark, light) and computes the contrast of every Button label and Text color against the background it sits on (the nearest ancestor background, or the scheme's surface)
   - Pass: every pair is at least 4.5:1, or at least 3:1 for bold/large text and dimmed controls; the test fails on the code before the fix in the light scheme
   - Result:
   - Evidence:

3. The reported elements
   - Run: read the drawn tree for the light scheme
   - Pass: the Plan and Design tabs, the filter chips, the title-bar buttons, README and Colors in the project header, and board row ID and title all have explicit readable colors (not inheriting near-white app colors)
   - Result:
   - Evidence:

4. Nothing else changed
   - Run: diff review of hooks/
   - Pass: only colors, variants and contrast-related props changed; no layout, key, hotkey or behaviour changes
   - Result:
   - Evidence:

5. Docs and README updated
   - Run: read README.md Settings and Troubleshooting
   - Pass: Colors schemes described as built
   - Result:
   - Evidence:

## Not checked by automation

- A person looks at the pane in the desktop app in each Colors setting, with the app in light and in dark mode, and can read every tab, button and row.

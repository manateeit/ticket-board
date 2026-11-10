# Eval — 0014 — Show the plugin version on the board

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Version shows on the board (both surfaces)
   - Run: pane tests booting terminal and desktop with default options
   - Pass: the drawn board contains the version string from `.claude-plugin/plugin.json` (read by the test from the manifest, not hard-coded), and the title-bar buttons are all still present
   - Result:
   - Evidence:

3. The switch hides it
   - Run: pane tests booting both surfaces with `showVersion` off
   - Pass: no version label is drawn; everything else on the board is unchanged
   - Result:
   - Evidence:

4. Setting declared and read
   - Run: read `.claude-plugin/plugin.json` and `hooks/register.tsx` / `hooks/store.ts`
   - Pass: `userConfig.showVersion` is a boolean with default true and a title and description; the option is read like the others; the version is not hard-coded in hooks/
   - Result:
   - Evidence:

5. Unreadable version does no harm
   - Run: pane test (or code reading if the harness cannot simulate it) with the version unavailable
   - Pass: the board draws normally without the label and without an error
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read README.md Settings, Board and Troubleshooting sections
   - Pass: Show version row in Settings, label mentioned under Board, Troubleshooting hint present; all match the code
   - Result:
   - Evidence:

## Not checked by automation

- A person updates the plugin, reloads, and sees the new version on the board; then turns Show version off in /plugin configure and sees it gone.

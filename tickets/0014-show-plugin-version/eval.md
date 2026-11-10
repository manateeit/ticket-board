# Eval — 0014 — Show the plugin version on the board

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 151 pass, 0 fail (base 139; diff shows only additions to tests, nothing skipped or deleted). Sandbox network-deny notices ignored.

2. Version shows on the board (both surfaces)
   - Run: pane tests booting terminal and desktop with default options
   - Pass: the drawn board contains the version string from `.claude-plugin/plugin.json` (read by the test from the manifest, not hard-coded), and the title-bar buttons are all still present
   - Result: PASS
   - Evidence: Tests `the board shows the running version from the manifest (terminal|desktop)` pass: drawn board contains `ticket-board <version>` and keys new/refresh/agents/readme are all found. Reasoning on 'not hard-coded': the harness cannot read files, so the test takes the version the engine itself read from .claude-plugin/plugin.json (the `plugin.register` event, asserted to match semver; manifest is 0.4.15) and serves it back as the plugin's manifest read. Nothing is hard-coded, and a change to plugin.json changes the expected string. Limit: it proves loadVersion reads whatever fs.read of that path returns, not the production path itself; I checked the path `${$.plugin.root}/.claude-plugin/plugin.json` by code reading and `$.plugin.root` is already used the same way in hooks/ai.ts. Acceptable.

3. The switch hides it
   - Run: pane tests booting both surfaces with `showVersion` off
   - Pass: no version label is drawn; everything else on the board is unchanged
   - Result: PASS
   - Evidence: Tests `Show version off hides the label (terminal|desktop)` pass: no version string and no `ticket-board ` in drawn output, ticket content (Health endpoint) still drawn, all four buttons present.

4. Setting declared and read
   - Run: read `.claude-plugin/plugin.json` and `hooks/register.tsx` / `hooks/store.ts`
   - Pass: `userConfig.showVersion` is a boolean with default true and a title and description; the option is read like the others; the version is not hard-coded in hooks/
   - Result: PASS
   - Evidence: plugin.json userConfig.showVersion: type boolean, title `Show version`, description present, default true. register.tsx readOptions: `showVersion: o.showVersion !== false` beside autoOpen; Options type and S.options default updated in store.ts. No version literal in hooks/ (read at runtime by loadVersion).

5. Unreadable version does no harm
   - Run: pane test (or code reading if the harness cannot simulate it) with the version unavailable
   - Pass: the board draws normally without the label and without an error
   - Result: PASS
   - Evidence: Four unreadable cases x 2 surfaces pass (manifest missing, not JSON, no version, not a version string): board draws (Health endpoint), no `ticket-board ` label, buttons present, no error. Code: loadVersion wraps read, JSON.parse and validation in one try/catch (template string with $.plugin.root is inside the try), sets S.version='' on any failure; it is awaited in session.start so a throw cannot escape.

6. Docs and README updated
   - Run: read README.md Settings, Board and Troubleshooting sections
   - Pass: Show version row in Settings, label mentioned under Board, Troubleshooting hint present; all match the code
   - Result: PASS
   - Evidence: README: Board bullet (version label, where it sits per surface, off switch), Settings row `Show version | on`, Troubleshooting row `Not sure which version is running`; all match code (terminal counts line, desktop footnote under title, setting name).

## Not checked by automation

- A person updates the plugin, reloads, and sees the new version on the board; then turns Show version off in /plugin configure and sees it gone.

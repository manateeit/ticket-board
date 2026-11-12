# Eval — 0031 — Glass palette and plates made explicit

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. `width` no longer decides plating
   - Run: pane test: Box with `width` holding Buttons, light glass in a dark app
   - Pass: the group is plated as marked

3. Palette needs no getters
   - Run: `grep -n "get hex" hooks/*.tsx` and a pane test with a plain map built from the palette, switching scheme
   - Pass: no getters left; the map shows light-scheme colours after the switch

4. No visual change
   - Run: existing contrast and plate tests (0018/0019) in all four combinations
   - Pass: all pass unchanged

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- Eyeball the pane in light and dark app themes.

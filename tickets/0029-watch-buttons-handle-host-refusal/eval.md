# Eval — 0029 — Watch buttons handle the host's refusal

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Deny handled on both Watch buttons (fails before the fix)
   - Run: pane tests (desktop and terminal ticket page) with `ui.view` resolving `{ deny: 'x' }`, press Watch
   - Pass: same message/fallback as the Agents panel; not silent

3. One code path
   - Run: `grep -n "ui.view(" hooks/*.tsx`
   - Pass: only the shared function calls `$.ui.view` for agents

4. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- Pressing Watch in the live desktop app while a writer runs.

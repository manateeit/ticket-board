# Eval — 0021 — Activity strip says "waiting for you" while agents work

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Wording per state (both surfaces)
   - Run: pane tests: busy turn; turn ended with 1 live agent; with 2 agents; with an AI writer job only; nothing running
   - Pass: busy shows "Claude is working"; agents/writers show a waiting-on-agents line that does not contain "waiting for you"; nothing running shows "Claude is idle"
   - Result:
   - Evidence:

3. Docs and README updated
   - Run: read README.md
   - Pass: the activity strip states are described as built
   - Result:
   - Evidence:

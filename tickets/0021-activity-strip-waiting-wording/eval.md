# Eval — 0021 — Activity strip says "waiting for you" while agents work

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 309 pass, 0 fail, 0 skipped (only sandbox network-deny notices). 0019 contrast tests pass.

2. Wording per state (both surfaces)
   - Run: pane tests: busy turn; turn ended with 1 live agent; with 2 agents; with an AI writer job only; nothing running
   - Pass: busy shows "Claude is working"; agents/writers show a waiting-on-agents line that does not contain "waiting for you"; nothing running shows "Claude is idle"
   - Result: PASS
   - Evidence: 10 tests 'activity wording: <state> (desktop|terminal)' all pass: busy -> 'Claude is working · Thinking · since hh:mm · 1 agent running'; 1 agent -> 'Waiting on 1 agent · Claude continues when it reports'; 2 agents -> 'Waiting on 2 agents · ... when they report'; writer only -> 'Waiting on the AI · AI writing 1 ticket · the board updates when it is done'; nothing -> 'Claude is idle'. All assert no 'waiting for you'. Terminal: ActivityBar is only rendered on the desktop path (views.tsx:1295); terminal tests assert no strip and the Agents count. Adopt change is safe: S.adoptJob is cleared in finishAdopt (ai.ts:699) and register.tsx:34 already counts it as working. No explicit-undefined props or `h` locals added.

3. Docs and README updated
   - Run: read README.md
   - Pass: the activity strip states are described as built
   - Result: PASS
   - Evidence: README.md Activity paragraph (L104) now describes working / waiting on agents / idle states, the writer/adopt-only wording, and that the terminal has no strip.

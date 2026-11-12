# Eval — 0024 — One rule for resolved questions

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. "agent)" no longer resolves (fails before the fix)
   - Run: core test: question with detail "ask the router (or the agent)" and no Resolved line
   - Pass: isResolved false; readiness reports 1 open question

3. Real answers still resolve
   - Run: core tests for `**Resolved <date> (human): …**`, `(agent, from code: x)`, `- none`, `- none (resolved …)`, and any other accepted form
   - Pass: each counts as resolved / no open questions

4. Router and standard name the same rule
   - Run: read `.claude/agents/router.md` and `docs/STANDARD.md`
   - Pass: both describe the same resolved forms the code accepts

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

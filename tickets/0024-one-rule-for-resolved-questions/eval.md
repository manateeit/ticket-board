# Eval — 0024 — One rule for resolved questions

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed); `claude plugin test .` exit 0, 331 pass / 0 fail, no skip or deleted tests. One earlier run had a single timing failure in the unrelated 'plan too large for the terminal' test (5.1s vs 5s limit, load-dependent); it passed on two other runs (4.3s, 3.0s) and is not touched by this ticket.

2. "agent)" no longer resolves (fails before the fix)
   - Run: core test: question with detail "ask the router (or the agent)" and no Resolved line
   - Pass: isResolved false; readiness reports 1 open question
   - Result: PASS
   - Evidence: Test 'a detail line mentioning "agent)" or "(human" does not resolve a question (0024)' passes on the branch: isResolved false, parseQuestions gives 1 unresolved, readiness label contains '1 open question'. Against hooks/core/ticket.ts from 400b67d (old pattern, plus an isResolved shim for the import) the same test FAILS (330 pass / 1 fail); file then restored, tree clean.

3. Real answers still resolve
   - Run: core tests for `**Resolved <date> (human): …**`, `(agent, from code: x)`, `- none`, `- none (resolved …)`, and any other accepted form
   - Pass: each counts as resolved / no open questions
   - Result: PASS
   - Evidence: Test 'every accepted resolved form counts as answered (0024)' passes: `**Resolved 2026-11-11 (human): …**`, `(agent, from code: x.ts): …`, the writer form `(agent, from code: x.ts)**: …`, `[x]`, `~~…~~` all resolved and readiness questions check ok; `- none` and `- none (resolved …)` give 0 questions and ok. Existing tests for answerQuestion/ready check still pass.

4. Router and standard name the same rule
   - Run: read `.claude/agents/router.md` and `docs/STANDARD.md`
   - Pass: both describe the same resolved forms the code accepts
   - Result: PASS
   - Evidence: router.md step 1 and docs/STANDARD.md section 4 'Open questions (the resolved rule)' state the same forms: line under it starting `**Resolved`, `[x]`, `~~…~~`; `- none` / `- none (resolved …)` mean none. Matches isResolved in hooks/core/ticket.ts. SKILL.md 'Answered questions' also points at it. designfile.ts uses parseQuestions' isResolved (no separate pattern).

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README.md (answering questions section) states the rule, that mentions of '(human'/'agent)' leave a question open, the none forms, and that the router uses the same rule; docs/STANDARD.md has the accepted forms. Both match what was built.

## Not checked by automation

- none

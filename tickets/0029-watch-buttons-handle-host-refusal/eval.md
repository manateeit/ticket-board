# Eval — 0029 — Watch buttons handle the host's refusal

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: validate: "Validation passed" exit 0; plugin test: 339 pass, 0 fail, 3 files; no skip/delete of tests in diff vs 400b67d.

2. Deny handled on both Watch buttons (fails before the fix)
   - Run: pane tests (desktop and terminal ticket page) with `ui.view` resolving `{ deny: 'x' }`, press Watch
   - Pass: same message/fallback as the Agents panel; not silent
   - Result: PASS
   - Evidence: New tests (both desktop and terminal): resolved { deny }, rejected, and allowed cases all pass at HEAD. With hooks/desk.tsx and hooks/views.tsx from 400b67d, tests/pane.test.tsx fails (0 pass, 1 fail: file does not load because openTranscript is not exported; the deny tests cannot pass). Files restored, tree clean. Host rules: exported $ functions are plain function declarations, no local h, no explicit undefined props, keys unique.

3. One code path
   - Run: `grep -n "ui.view(" hooks/*.tsx`
   - Pass: only the shared function calls `$.ui.view` for agents
   - Result: PASS
   - Evidence: grep "ui.view(" hooks/*.tsx gives only hooks/desk.tsx:181 (openTranscript); both Watch buttons call openTranscript.

4. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README step 4 now says what happens where the app will not switch (desktop): message plus activity under buttons, same fallback as Agents panel. rd.md lists only README.
## Not checked by automation

- Pressing Watch in the live desktop app while a writer runs.

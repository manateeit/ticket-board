# Eval — 0030 — One parser for rd.md head fields

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` passed (exit 0). `claude plugin test .` 340 pass / 0 fail, no skipped or deleted tests (tests only added: 0030 core + pane tests). The 'plan too large for the terminal (8 phases x 20 builds)' test passed in this run, so no rerun was needed.

2. Body `type:` lines are shown (fails before the fix)
   - Run: pane test: rd.md with `type: module` inside a code fence in Behaviour
   - Pass: the line appears in the desktop ticket view; the head Type line does not
   - Result: PASS
   - Evidence: Pane test 'ticket page: only the head Type line is hidden; setting Type edits the head (0030, desktop)' passes: rd.md with `type: module` in a code fence under Behaviour is drawn (contains 'type: module' and body 'Type: written in the body'), head 'Type: bug' is not drawn. With hooks/core/query.ts and hooks/desk.tsx from 400b67d the test FAILS (338 pass / 2 fail); files restored, tree clean.

3. Long head is read
   - Run: core test: Type: on line 15, before the first ##
   - Pass: kindOf returns that type
   - Result: PASS
   - Evidence: Core test 'head fields: one reader and writer, head only (0030)': Type: on line 15 above the first ## gives kindOf 'bug'; Type in a section or fence gives 'feature'. Passes on the branch; FAILS with query.ts/desk.tsx from 400b67d (same 338/2 run).

4. setKind edits only the head
   - Run: core/pane test: short head with no Type and a body `Type:` line; change Type
   - Pass: a head line is added; the body line is unchanged
   - Result: PASS
   - Evidence: Same core test plus the pane test: a head with no Type and a body `Type:` line gets `Type: chore` added under the title, body line and fenced `type: module` unchanged; an existing head line is rewritten in place (CRLF kept); the pane select on kind-0003 writes the head only. Fails against the 400b67d desk.tsx/query.ts.

5. Single parser
   - Run: `grep -rnE 'slice\(0, ?12\)|\^type:' hooks`
   - Pass: no separate head scans remain
   - Result: PASS
   - Evidence: `grep -rnE 'slice\(0, ?12\)|\^type:' hooks` returns no matches (exit 1). kindOf uses headField, docSections uses headFieldLine, setKind uses setHeadField, all in hooks/core/ticket.ts. Host rules: exported functions taking `$` are plain `function` declarations; setKind is a plain async function; no new local named `h` (the `const h` in docSections and desk.tsx:620 exist unchanged on 400b67d); no explicit `undefined` props added (the only `: undefined` in the diff are expectation values in a roadmap test from ticket 0026).

6. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README.md Types paragraph says only the head counts (above the first `## `, any line count), body `type:` lines stay visible, and changing Type rewrites the head line or adds one under the title. docs/STANDARD.md section 4 says head lines live anywhere above the first `## ` and the same words in a section or code block are body text. No leftover mention of a 12-line limit in README, docs or skills.
## Not checked by automation

- none

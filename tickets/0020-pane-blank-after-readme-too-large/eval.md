# Eval — 0020 — Pane goes blank: README view too large for the host

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: validate: 'Validation passed', exit 0. test: 299 pass, 0 fail (291 on base + 8 new), none skipped or deleted. Network-deny notices only.

2. README in parts under the limit
   - Run: pane test with a README of this repo's size (≥60 KB) on desktop in several schemes
   - Pass: every part's serialized drawing is under 100,000 characters; every section is reachable via Next; Previous works; no line lost; code blocks not split
   - Result: PASS
   - Evidence: Tests 'a long README draws on the desktop in parts' pass in light/auto/dark glass (app dark/light/dark): every part < 100,000 chars, no 'too large', all 100 sections reached via readme-next, readme-prev works; 'README parts break...' passes (join equals input, no odd fence counts). Also measured this repo's real README.md (62,955 bytes) via a temporary test (removed): 8 parts, max 57,655 chars (light), 56,745 (auto); nodes <= 1,784; depth 20 (counting every object/array level); well under 100,000 / 20,000 / 32.

3. Size guard
   - Run: pane test with an oversized view (e.g. a huge ticket rd.md) on desktop and terminal
   - Pass: a notice under the limit with a working way back; never an over-limit tree
   - Result: PASS
   - Evidence: Tests 'a view too large for the pane draws a notice with a way back' pass on desktop and terminal: notice text appears, drawn < 100,000, too-large-board returns to the board, still < 100,000.

4. Defensive store loading
   - Run: boot with bad saved filters and bad jobs
   - Pass: the board draws with defaults; without the fix it does not
   - Result: PASS
   - Evidence: Test 'saved filters with old or bad values fall back...' passes (bad filters and bad jobs, board draws). With hooks/ restored from f16300b (plus a one-line readmeParts stub so the test file loads) it fails.

5. Tests fail without the fix
   - Run: restore hooks/ from f16300b, run the new tests, restore
   - Pass: the new tests fail before and pass after
   - Result: PASS
   - Evidence: git checkout f16300b -- hooks: test file did not load at all (imports readmeParts) = 61 pass 1 fail. With a stub readmeParts export appended: 291 pass, 8 fail, exactly the 8 new tests (3 README-in-parts, parts unit, too-large desktop+terminal, bad filters, action column). hooks/ restored to HEAD afterwards (git status clean); 299 pass after.

6. Docs and README updated
   - Run: read README.md
   - Pass: README view parts and the troubleshooting row described as built
   - Result: PASS
   - Evidence: README.md diff vs f16300b: README view paragraph describes Previous/Next part, 'Part k of n', starts at part 1, short README no buttons; Troubleshooting row 'Pane says nothing to show' added, describing parts and the too-large notice with ‹ Board / Hide done tickets. Matches the built behaviour.

## Not checked by automation

- The real desktop host's unmount on an over-limit tree (inferred from the host types and the desktop log); a person opens README with `o` and pages through it, and the board stays drawn.

# Eval — 0023 — Board cell edits never silently dropped

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Missing column is reported (fails before the fix)
   - Run: core test: board without Notes/Mode/Blocked by; `setCells` with notes, mode, blockedBy
   - Pass: the call reports the three skipped columns; the file is unchanged for them

3. Pane does not claim success
   - Run: pane test on a board without Mode and Notes: change mode; move status with a note
   - Pass: no "Mode →" or "saved" success message; an error or disabled control instead; status move says the note was not saved

4. Blocked by encoding owned by the board module
   - Run: `grep -nE 'padStart\(4|d\{1,4\}' hooks/desk.tsx hooks/views.tsx`
   - Pass: no matches; a core test round-trips `['0003','10000']` and `[]` (written `—`)

5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

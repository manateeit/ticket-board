# Eval — 0023 — Board cell edits never silently dropped

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 333 pass, 0 fail across 3 files; no tests deleted or skipped (diff only adds tests).
2. Missing column is reported (fails before the fix)
   - Run: core test: board without Notes/Mode/Blocked by; `setCells` with notes, mode, blockedBy
   - Pass: the call reports the three skipped columns; the file is unchanged for them
   - Result: PASS
   - Evidence: core test 'setCells reports columns the board does not have...' passes: skipped = [blockedBy, mode, notes], text identical to input; mixed edit moves status, skips notes. With hooks restored from 400b67d the core test file fails to load (new exports missing): fails before the fix.
3. Pane does not claim success
   - Run: pane test on a board without Mode and Notes: change mode; move status with a note
   - Pass: no "Mode →" or "saved" success message; an error or disabled control instead; status move says the note was not saved
   - Result: PASS
   - Evidence: pane tests (terminal + desktop) pass: no Mode control, text 'BOARD.md has no Mode column', no 'Mode →', block reason box labelled 'not saved: no Notes column', status becomes blocked, 'note not saved' warning shown, no plain success. Both fail with 400b67d hooks (old pane draws Mode select and green '0003 → blocked').
4. Blocked by encoding owned by the board module
   - Run: `grep -nE 'padStart\(4|d\{1,4\}' hooks/desk.tsx hooks/views.tsx`
   - Pass: no matches; a core test round-trips `['0003','10000']` and `[]` (written `—`)
   - Result: PASS
   - Evidence: grep for padStart\(4|d\{1,4\} in hooks/desk.tsx hooks/views.tsx: no matches (exit 1). Core test 'Blocked by: the board module owns the cell format' round-trips ['0003','10000'] and [] (written '—'); unchanged-edit gives identical bytes.
5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README.md lines ~201-202 describe controls needing the column, error instead of saved, 5-digit Blocked by, empty as —, Notes-less Block. rd.md Docs lists only README.md.

## Not checked by automation

- none

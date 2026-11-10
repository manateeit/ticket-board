# Eval — 0001 — Design and plan file standard

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin still validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not run it)
   - Pass: both exit 0; no test that passed before now fails
   - Result:
   - Evidence:

2. Files exist
   - Run: `ls docs/STANDARD.md templates/design.md templates/plan.md templates/brief.md templates/change.md`
   - Pass: all five paths exist and are non-empty; `git status` shows no changes outside these files, README.md and this ticket folder
   - Result:
   - Evidence:

3. Standard is complete
   - Run: read `docs/STANDARD.md` and tick each item in rd.md Behaviour: folder layout (brief, DESIGN, PLAN, brainstorms, changes, decisions); DESIGN.md front matter, D sections with Rev/Why/What/Done when/Open questions, dropped sections, unnumbered context sections; PLAN.md front matter, P phases with Goal/Appetite/Exit, build table with Covers and Ticket columns and optional Status; `Plan:` and `Design: D1@2` lines in rd.md; BOARD.md binding line; progress vocabulary pointer
   - Pass: every item is present with a fenced example; no "TBD" or empty section
   - Result:
   - Evidence:

4. Templates match the standard (parse check)
   - Run: until ticket 0003 lands, compare each template and each example in the standard by hand: front matter keys, heading pattern `## D<n> · …` and `## P<n> · …`, table header exactly `| # | Build | Size | Needs | Covers | Done when | Ticket |`. If `hooks/core/roadmap.ts` exists with `parseDesign` / `parsePlan`, run both on the templates and on the standard's examples instead
   - Pass: headings, keys and column order identical everywhere; with the parser, no parse errors and the worked D1 and P1.1 are found
   - Result:
   - Evidence:

5. Binding line does not break the board
   - Run: add the line `Design: design/DESIGN.md · Plan: design/PLAN.md` under the title of a scratch copy of `examples/demo-board/tickets/BOARD.md` and run `claude plugin test .`, or read `hooks/core/board.ts` to confirm the table parser ignores non-table lines
   - Pass: the board still parses with the same rows
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md Development layout lists `docs/STANDARD.md` and the four templates and links the standard; each link resolves; the standard describes the layout as written
   - Result:
   - Evidence:

## Not checked by automation

- Whether the standard reads clearly to someone new (a human skim of `docs/STANDARD.md`).
- The folder-name decision (`design/` vs `docs/`) is applied consistently once the person answers.

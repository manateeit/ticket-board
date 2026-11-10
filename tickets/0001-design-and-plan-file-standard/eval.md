# Eval — 0001 — Design and plan file standard

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin still validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not run it)
   - Pass: both exit 0; no test that passed before now fails
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed); `claude plugin test .` 36 pass, 0 fail (network notices for api.anthropic.com only).

2. Files exist
   - Run: `ls docs/STANDARD.md templates/design.md templates/plan.md templates/brief.md templates/change.md`
   - Pass: all five paths exist and are non-empty; `git status` shows no changes outside these files, README.md, `.gitignore` (only the `PLAN.md` line anchored to `/PLAN.md`; added to scope by the person, 2026-11-10) and this ticket folder
   - Result: PASS
   - Evidence: Re-verified 2026-11-10 after scope widening. All five paths exist and are non-empty. `git diff --stat 090086a..HEAD` lists only .gitignore, README.md, docs/STANDARD.md, templates/{brief,change,design,plan}.md. The .gitignore diff is exactly one line: `-PLAN.md` / `+/PLAN.md`. `git check-ignore -v templates/plan.md design/PLAN.md` prints nothing (rc=1); `git check-ignore -v PLAN.md` still reports `.gitignore:7:/PLAN.md` (root ignored). Worktree status clean.

3. Standard is complete
   - Run: read `docs/STANDARD.md` and tick each item in rd.md Behaviour: folder layout (brief, DESIGN, PLAN, brainstorms, changes, decisions); DESIGN.md front matter, D sections with Rev/Why/What/Done when/Open questions, dropped sections, unnumbered context sections; PLAN.md front matter, P phases with Goal/Appetite/Exit, build table with Covers and Ticket columns and optional Status; `Plan:` and `Design: D1@2` lines in rd.md; BOARD.md binding line; progress vocabulary pointer
   - Pass: every item is present with a fenced example; no "TBD" or empty section
   - Result: PASS
   - Evidence: STANDARD.md sections 1-8 each have a fenced example: layout tree (brief, DESIGN, PLAN, brainstorms, changes, decisions); DESIGN front matter, unnumbered context sections, D sections with Rev/Why/What/Done when/Open questions, dropped D7, never-reused ids; PLAN front matter, P phases with Goal/Appetite/Exit, build table with Covers/Ticket, optional Status; Plan:/Design: D1@2 lines; BOARD binding line; progress vocabulary pointing to PLAN-design-plan.md section 4. No TBD or empty sections.

4. Templates match the standard (parse check)
   - Run: until ticket 0003 lands, compare each template and each example in the standard by hand: front matter keys, heading pattern `## D<n> · …` and `## P<n> · …`, table header exactly `| # | Build | Size | Needs | Covers | Done when | Ticket |`. If `hooks/core/roadmap.ts` exists with `parseDesign` / `parsePlan`, run both on the templates and on the standard's examples instead
   - Pass: headings, keys and column order identical everywhere; with the parser, no parse errors and the worked D1 and P1.1 are found
   - Result: PASS
   - Evidence: hooks/core/roadmap.ts does not exist; compared by hand. Front matter keys (design/version/status/updated; plan/design-version/updated), `## D<n> · ` and `## P<n> · ` headings, and table header `| # | Build | Size | Needs | Covers | Done when | Ticket |` are identical in templates/design.md, templates/plan.md and the standard's examples. brief and change templates match their standard examples. Worked D1 and P1.1 present.

5. Binding line does not break the board
   - Run: add the line `Design: design/DESIGN.md · Plan: design/PLAN.md` under the title of a scratch copy of `examples/demo-board/tickets/BOARD.md` and run `claude plugin test .`, or read `hooks/core/board.ts` to confirm the table parser ignores non-table lines
   - Pass: the board still parses with the same rows
   - Result: PASS
   - Evidence: Read hooks/core/board.ts: the table finder only considers lines passing isTableLine (leading `|`) and breaks at the first non-table line after the table; the binding line `Design: design/DESIGN.md · Plan: design/PLAN.md` sits above the table and is ignored. Rows unchanged.

6. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md Development layout lists `docs/STANDARD.md` and the four templates and links the standard; each link resolves; the standard describes the layout as written
   - Result: PASS
   - Evidence: README Development layout lists docs/STANDARD.md and templates design/plan/brief/change (alignment of the plan.md comment line is slightly odd but fine); pointer sentence with link added at top of 'Using it with the super-agent router'. Links docs/STANDARD.md, ../PLAN-design-plan.md (tracked, exists), ../templates/ resolve. Standard describes the design/ layout as written.

## Not checked by automation

- Whether the standard reads clearly to someone new (a human skim of `docs/STANDARD.md`).
- The folder-name decision (`design/` vs `docs/`) is applied consistently once the person answers.

# Eval — 0025 — Tickets folder setting works everywhere

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .` exit 0: 334 pass, 0 fail, no test skipped or deleted (diff only adds tests). Network-deny notices only.


2. Run line follows the setting (fails before the fix)
   - Run: pane/core test with ticketsDir `work`: build the Run line for a ticket
   - Pass: it names `work/BOARD.md` and not `tickets/BOARD.md`; with the default it equals today's text
   - Result: PASS
   - Evidence: New tests `run lines follow the tickets folder setting (0025)` (core) and `Tickets folder "work": the Run line and the writer brief...` (pane) pass: work gives `Run ticket 0002 (board: work/BOARD.md).` and router line has `update work/BOARD.md`, no `tickets/`. With hooks/ restored from 400b67d: 331 pass, 3 fail (the core run-line test, the Run-line/writer-brief pane test, the adopt brief test); tree restored clean. Default: runLine output for 4 inputs (router and plain, single and multiple) compared byte for byte between 400b67d and HEAD query.ts: identical (cmp). Host rules: no new exported function takes `$` (routerTail and runLine do not), no local `h`, no explicit undefined prop values in the added lines.


3. Briefs follow the setting
   - Run: pane test with ticketsDir `work`: start a writer, a planner replan and an adopt; inspect the spawn prompts
   - Pass: each names `work/` paths only
   - Result: PASS
   - Evidence: Pane tests with ticketsDir `work`: writer brief has `Ticket folder: work/0004-.../` and `Board: work/BOARD.md`, no `tickets/`; replan brief and adopt brief contain `Board: work/BOARD.md` and no `tickets/`. Adopt brief now names the board (it did not before). Replan and linked-worktree resolveRoot tests also pass on the old code, so they pin existing behaviour.


4. No literal board path left in agent text
   - Run: `grep -rn "tickets/BOARD.md" skills agents .claude/agents templates hooks`
   - Pass: every remaining match is phrased as the default, not as the only path
   - Result: PASS
   - Evidence: grep matches remaining: skills (design, planning, brainstorm, ticket), agents/planner.md, .claude/agents router/worker/watchdog, and comments in hooks/*.ts, all phrased as 'the board path you were given (default `tickets/BOARD.md`)' or `<ticketsDir>/BOARD.md, default ...`. No match in templates. ROUTER_TAIL has no leftover references.


5. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
   - Result: PASS
   - Evidence: README.md Tickets folder row says Run lines name `<folder>/BOARD.md` and agents follow it; Run-line section gains the non-default text (`Run ticket 0014 (board: work/BOARD.md).`, router tail) matching the built runLine. rd.md Docs lists only README.md.

## Not checked by automation

- A live router run in a project with a non-default ticketsDir.

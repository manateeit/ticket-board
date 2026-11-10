# Eval — 0002 — Ticket board's own design and plan in the standard

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` in the repo root (tsc is not installed)
   - Pass: both exit 0
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed' (exit 0); `claude plugin test .` 36 pass, 0 fail, exit 0 (run in worktree; network notices only).

2. Files exist with the standard's front matter
   - Run: read `design/DESIGN.md` and `design/PLAN.md`; compare with `docs/STANDARD.md` and `templates/design.md`, `templates/plan.md`
   - Pass: DESIGN.md has `design`, `version: 1`, `status: draft` (or as the person decided), `updated`; PLAN.md has `plan`, `design-version: 1`, `updated`; section and phase headings use `## D<n> · …` and `## P<n> · …`
   - Result: PASS
   - Evidence: DESIGN.md front matter: design: Ticket board, version: 1, status: draft, updated: 2026-11-10. PLAN.md: plan: Ticket board, design-version: 1, updated: 2026-11-10. Headings use `## D<n> · …` and `## P<n> · …`. Matches docs/STANDARD.md.

3. Design sections complete
   - Run: list the `## D` headings in DESIGN.md
   - Pass: D1–D8 exist, each with `Rev: 1`, `Why`, `What` and at least one `Done when` line; Vision, Problem and Non-goals present and unnumbered; ids contiguous, none reused
   - Result: PASS
   - Evidence: `## D1`..`## D8` contiguous, each with Rev: 1, Why, What, Done when with 1+ bullets (EARS lines from source). Vision, Problem, Non-goals (plus Constraints) unnumbered. Open questions section absent: the source has none for these sections (optional per standard).

4. Plan maps M1–M8 to tickets 0001–0009
   - Run: read the build tables in PLAN.md
   - Pass: builds P1.1–P4.2 exist with the columns `# | Build | Size | Needs | Covers | Done when | Ticket`; tickets 0001, 0003, 0004, 0005, 0006, 0007, 0008, 0009 are the M1–M8 builds in that order, 0002 is P1.2; every ticket 0001–0009 appears exactly once; Size and Done when match `PLAN-design-plan.md` §7; each Needs agrees with the Blocked-by column of `tickets/BOARD.md`; no `TBD`
   - Result: PASS
   - Evidence: Tables have columns `# | Build | Size | Needs | Covers | Done when | Ticket`. P1.1=0001, P1.2=0002, P1.3=0003, P2.1=0004, P2.2=0005, P3.1=0006, P3.2=0007, P4.1=0008, P4.2=0009; each ticket once. Size/Done when match PLAN-design-plan.md lines 280-287 (M1-M8). Needs match BOARD.md Blocked-by (0003->P1.1; 0004->P1.3; 0005->P1.1; 0006->P1.3; 0007->P3.1; 0008->P2.2,P3.2; 0009->P4.1; 0002->P1.1). No TBD. Phases P1-P4 with Goal/Appetite/Exit.

5. Coverage is closed
   - Run: cross-check the Covers column against the D headings
   - Pass: every D1–D8 is named in at least one build's Covers; every Covers id exists in DESIGN.md; every Needs id exists in PLAN.md and no build needs itself or a later build
   - Result: PASS
   - Evidence: Covers: P1.1 D1, P1.2 D1, P1.3 D1,D2, P2.1 D3, P2.2 D4, P3.1 D5, P3.2 D6, P4.1 D7, P4.2 D8: D1-D8 all covered, all ids exist. Every Needs id exists and refers only to earlier builds.

6. Parses with the roadmap parser (only when ticket 0003 is done)
   - Run: if `hooks/core/roadmap.ts` exists, run `parseDesign` and `parsePlan` on the two files through the project's test command; otherwise mark N/A and rely on checks 2–5
   - Pass: no parse errors; 8 numbered sections and 9 builds found; `checks` reports no "section with no build", "build with no ticket" or "ticket pointing at a missing build"
   - Result: N/A
   - Evidence: hooks/core/roadmap.ts does not exist in the worktree (hooks/core has board.ts, project.ts, query.ts, ticket.ts); relied on checks 2-5.

7. Only the two files changed; BOARD.md untouched
   - Run: `git status --short` and `git diff --stat` for the worker's branch
   - Pass: changes are only `design/DESIGN.md` and `design/PLAN.md` (plus the ticket folder); `tickets/BOARD.md` is not modified; the worker's report lists the binding line `Design: design/DESIGN.md · Plan: design/PLAN.md` as a step for the router or person
   - Result: PASS
   - Evidence: `git diff --stat 090086a..HEAD`: only design/DESIGN.md (+209) and design/PLAN.md (+47); both tracked (`git ls-files design`); worktree status clean; tickets/BOARD.md not in the branch diff. Note: the worker's final report was not given to me, so the binding-line step in it is unverified by me; router should list `Design: design/DESIGN.md · Plan: design/PLAN.md` under the BOARD.md title after merge.

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: each listed doc describes the change as built (README.md and `docs/STANDARD.md` unchanged is correct per rd.md, unless a standard error was fixed and reported); `PLAN-design-plan.md` unchanged
   - Result: PASS
   - Evidence: README.md, docs/STANDARD.md and PLAN-design-plan.md unchanged by the branch (diff covers only the two design files); matches rd.md Docs section.

## Not checked by automation

- Whether DESIGN.md faithfully keeps the intent of `PLAN-design-plan.md` rather than just its headings.
- Seeing the real data in the pane's Plan and Design views after the router adds the binding line and 0006–0007 have landed.

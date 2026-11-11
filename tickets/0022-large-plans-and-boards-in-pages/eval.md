# Eval — 0022 — Large plans and boards shown in pages

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: `claude plugin validate .` printed 'Validation passed'. `claude plugin test .` 329 pass, 0 fail across 3 files (no test skipped or deleted; 20 added). Network-deny notices only.

2. Large plan draws
   - Run: pane tests with an 8-phase, 49-build plan: Plan list and timeline, desktop (every Colors × app mode) and terminal
   - Pass: no "too large" notice; serialized drawing under 95,000 characters; every phase reachable through the switcher; the current phase is shown first; choice remembered
   - Result: PASS
   - Evidence: Worker's tests (all 3 Colors x 2 app modes, desktop and terminal) pass: no notice, <95,000, all 8 phases via switcher, P4 (current) first, store key plan-phase:/repo set, timeline follows. My heavier fixture (8 phases x 7 builds = 56 builds, 4 ticket pills per build, 110-char titles, 220-char Done-when, 6 Covers, 2 Needs; every phase would be ~46K so unpaged is roughly 370K, well over 150K): every page in all 6 Colors x app modes under 95,000; LARGEST PAGE 51,566 (list, dark glass, light app); timeline max 19,982; terminal max 14,595. The 8x6x3-ticket variant max 39,754. Node count of a page: ~680 nodes, depth <=19 (limits 20,000 / 32). Single big phase (hits the 0020 notice on desktop): light builds (1 ticket, 60-char cells) fine at 30 builds (93,197 close to the edge), notice at 40; heavy builds (3 tickets, wide cells) fine at 15 (80,449), notice at 20. Terminal never hits it (49 builds: 42,311). Follow-up candidate only: a single phase of ~30+ builds (~17+ heavy) on desktop still shows the notice; not a realistic 8-phase plan, so not a fail.

3. Large board draws
   - Run: pane tests with 120 tickets, done shown and hidden, with a filter and a sort
   - Pass: no "too large" notice; under the limit; every row reachable via paging; filters/sort apply before paging; changing a filter returns to page 1
   - Result: PASS
   - Evidence: Worker's tests pass: 120 tickets, 'Rows 1-20 of 120', all 120 rows reached via Next, hide-done gives 'Rows 1-20 of 81' and returns to page 1, sort applies before paging, a filter returns to page 1 and removes the pager when one page. Stress: 120 tickets with 150-char titles, 300-char notes, 5 blockers each, stale design chips, 8-phase plan card: largest page 82,725; 400/1500-char title/notes: 82,380 (rowsPerPage adapted to 10 rows); 800/3000: 83,715 (9 rows a page); single-phase plan 78,230. Margin to 95,000 is ~11K at worst; rowsPerPage adapts as rows grow (20 -> 11 -> 10 -> 9). Terminal board 120 rows: max 30,660, every row reachable. A 2000/8000-char fixture timed out in my harness (5s test limit), not measured.

4. Small projects unchanged
   - Run: existing tests and a small-plan / small-board drawing compared with main
   - Pass: no switcher or pager on small projects; drawings unchanged
   - Result: PASS
   - Evidence: Existing 329 tests pass. Independently dumped the small p7 fixture board, plan list and timeline on desktop and terminal from main (7f4ac0f via git archive) and from the branch, with the random handle numbers normalised: byte-identical. Worker's test also asserts no switcher or pager on small projects. New Buttons set no hotkey (no collisions); keys plan-phase-<id> reuse the existing pidOf; no explicit-undefined props, no `$` passed into arrow consts, no local `h` found in the diff.

5. Docs and README updated
   - Run: read README.md
   - Pass: phase switcher, board paging and the troubleshooting row described as built
   - Result: PASS
   - Evidence: README.md diff read: Plan section 'Large plans, one phase at a time' (switcher with % and state, choice remembered per project, current phase first); Board section describes paging (20 rows a page, Previous/Next, 'Rows 21-40 of 120', terminal cap 30); Troubleshooting row for 'This view is too large for the pane to draw'; test description updated.

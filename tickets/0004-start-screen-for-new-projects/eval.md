# Eval — 0004 — Start screen for new projects

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not run it)
   - Pass: both exit 0; the test output lists the new core and pane tests below as passing
   - Result: PASS
   - Evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 82 pass, 0 fail across 3 files; the 7 new `start:` core tests and the new pane tests (blank/banner/buttons/first commit x2 surfaces, stepper x10, skip x2, unreadable .git, design+plan board) are listed as passing. Only sandbox network denials printed.
   - Round 2 evidence: `claude plugin validate .` exit 0 (Validation passed). `claude plugin test .`: 85 pass, 0 fail across 3 files (new auto-open tests included). Only sandbox network denials printed.

2. Detection unit tests (tests/core.test.ts)
   - Run: `claude plugin test .`, read the new core tests
   - Pass: tests cover no .git, git with zero commits, git with origin on GitHub, non-GitHub origin, a worktree `.git` pointer file, and the step decision for each (none of them spawns a process or uses non-file APIs)
   - Result: PASS
   - Evidence: Core tests: no .git (none, Setup); unreadable .git (unknown, does not hold Setup); zero commits stays Setup; commit + GitHub origin walks Idea, Design, Plan, Tickets; non-GitHub origin counts as set up and packed-refs counts as commit; worktree .git pointer file followed to shared refs/config; names-only helpers. Code read: readGitFacts takes a `read` function only; loadProject uses $.fs.read/$.fs.list; no process spawn anywhere in the diff.
   - Round 2 evidence: Unchanged by round 2 (diff touches only register.tsx, plugin.json, README, pane test); all core `start:` tests still pass in the 85-pass run.

3. Blank folder shows Start (terminal and desktop)
   - Run: pane test with an empty fake fs (no tickets folder, no BOARD.md, no design/plan), on both surfaces
   - Pass: the pane shows the stepper Setup, Idea, Design, Plan, Tickets and "No GitHub repository"/"not a git repo" lines, and does not show "No ticket board here yet"
   - Result: PASS
   - Evidence: Pane tests `blank folder shows Start, not the old set-up screen` pass on terminal and desktop: all five step names, 'No GitHub repository', 'not a git repo', 'What are you building?', 'Set up board only' present; 'No ticket board here yet' absent. setupView removed from views.tsx.
   - Round 2 evidence: Still pass in the 85-pass run on both surfaces; new test confirms a blank folder with no tickets/ does not auto-open and /board then shows 'Start a project'.

4. Folder with tickets shows board plus banner
   - Run: pane test with the existing fake board (tickets 0001-0003, no design/plan), both surfaces
   - Pass: the board table shows, with a banner "No design or plan yet" and a Set up button; pressing Set up opens Start; dismissing hides the banner and the dismissal is saved in the store
   - Result: PASS
   - Evidence: Pane tests `tickets but no design or plan: board plus a banner that opens Start` pass on both surfaces: board rows shown with 'No design or plan yet' banner; banner-setup opens 'Start a project'; back to board; banner-dismiss hides it; store.get('start:/repo') equals {isGithubSkipped:false,isBannerDismissed:true}; writes == [].
   - Round 2 evidence: Still pass in the 85-pass run on both surfaces (banner, Set up, dismiss saved).

5. Buttons fill the prompt and never run commands
   - Run: pane test pressing git init, create GitHub repo, first push, Brainstorm it first, Go straight to design
   - Pass: each press produces exactly one `prompt.fill` containing the request (and the typed idea for the last two); no `fs.write` happens except the board setup button and stored flags; Brainstorm/design buttons are disabled with an empty idea box
   - Result: PASS
   - Evidence: Pane tests `Start buttons only fill the prompt` (both surfaces): git init -> exactly 1 fill 'Initialise git here and make the first commit.'; GitHub button -> 1 fill containing 'gh repo create --private'; first-push test fills 'Make the first commit.'; Brainstorm/Design with empty idea fill nothing (dimmed, warning 'Type what you are building first'); with idea typed: '/brainstorm A booking app...' and '/design A booking app...' exactly one fill each; writes == [] until 'Set up board only', which writes only under tickets/. Code read: startFill/fillWithIdea call only fill() -> $.prompt.fill; the only $.fs.write in Start paths is setUp (tickets/BOARD.md + tickets/TEMPLATE/*); setStartFlag writes only $.store. Note: 'disabled' is implemented as dimColor plus a warning on press (no real disabled prop); behaviour matches (no fill).
   - Round 2 evidence: Still pass in the 85-pass run on both surfaces.

6. Stepper resumes from files
   - Run: pane tests with a repo with commits and origin, then add `design/DESIGN.md`, then `design/PLAN.md`, re-mount
   - Pass: the current step moves Setup → Design → Plan → Tickets from the files alone; with design or plan present the Start screen is no longer shown unless the person opens it from the banner
   - Result: PASS
   - Evidence: Stepper tests on both surfaces: no git -> Setup; commits+origin -> Idea; brief -> Design (button fills '/design design/brief.md'); DESIGN.md -> Plan (board + 'No plan yet' banner, Start only via banner-setup; button fills '/planning design/DESIGN.md'); design+plan -> Tickets. 'with a design and a plan the board shows: no Start, no banner' passes. Caveat noted: design+plan with NO BOARD.md still shows Start (at Tickets step offering 'Set up board'), because there is no board to show; the worker's own test asserts this. Judged consistent with rd (Start replaces the old set-up screen), flagged to the router.
   - Round 2 evidence: Still pass in the 85-pass run on both surfaces.

7. Skip is remembered
   - Run: pane test pressing Skip on the GitHub line, then re-boot with the saved store value
   - Pass: the line shows "skipped" and the stepper moves on
   - Result: PASS
   - Evidence: `Skip on the GitHub line is remembered per project`: press start-skip -> 'skipped', stepper moves Setup -> Idea, store 'start:/repo' = {isGithubSkipped:true,...}. `a saved Skip shows skipped on the next start (desktop)`: re-boot with saved store shows 'skipped', no 'No GitHub repository', '● Idea'.
   - Round 2 evidence: Still pass in the 85-pass run.

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md describes the Start screen, the banner and that buttons only fill the prompt; the intro no longer says the pane needs a board; no stale mention remains
   - Result: PASS
   - Evidence: README.md updated: new 'Start screen' section (stepper, Setup lines, Idea buttons, banner, 'The buttons never run anything', terminal layout, store flags), Quick start, pane intro (opens on Start in a project with no design/plan/tickets), Settings 'Open at start' row, 'What it remembers', Troubleshooting (no longer says the pane needs a board), hotkeys, layout, test description. PLAN-design-plan.md correctly untouched. Minor stale spot outside the listed docs: .claude-plugin/plugin.json autoOpen description still says 'in a project that has a ticket board'.
   - Round 2 evidence: README updated for the decision (intro-of-pane paragraph, Quick start step 2, Settings 'Open at start' row) and plugin.json autoOpen description now states tickets/-only auto-open (the round 1 stale spot is fixed). Start screen, banner and fill-only buttons still documented.

## Not checked by automation

- How the Start screen looks in the real desktop app (spacing, glass colours) and that pressing Enter after a filled prompt runs the command in a real session.

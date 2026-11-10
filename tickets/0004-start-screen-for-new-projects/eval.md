# Eval — 0004 — Start screen for new projects

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and all tests pass
   - Run: `claude plugin validate .` then `claude plugin test .` (tsc is not installed; do not run it)
   - Pass: both exit 0; the test output lists the new core and pane tests below as passing
   - Result:
   - Evidence:

2. Detection unit tests (tests/core.test.ts)
   - Run: `claude plugin test .`, read the new core tests
   - Pass: tests cover no .git, git with zero commits, git with origin on GitHub, non-GitHub origin, a worktree `.git` pointer file, and the step decision for each (none of them spawns a process or uses non-file APIs)
   - Result:
   - Evidence:

3. Blank folder shows Start (terminal and desktop)
   - Run: pane test with an empty fake fs (no tickets folder, no BOARD.md, no design/plan), on both surfaces
   - Pass: the pane shows the stepper Setup, Idea, Design, Plan, Tickets and "No GitHub repository"/"not a git repo" lines, and does not show "No ticket board here yet"
   - Result:
   - Evidence:

4. Folder with tickets shows board plus banner
   - Run: pane test with the existing fake board (tickets 0001-0003, no design/plan), both surfaces
   - Pass: the board table shows, with a banner "No design or plan yet" and a Set up button; pressing Set up opens Start; dismissing hides the banner and the dismissal is saved in the store
   - Result:
   - Evidence:

5. Buttons fill the prompt and never run commands
   - Run: pane test pressing git init, create GitHub repo, first push, Brainstorm it first, Go straight to design
   - Pass: each press produces exactly one `prompt.fill` containing the request (and the typed idea for the last two); no `fs.write` happens except the board setup button and stored flags; Brainstorm/design buttons are disabled with an empty idea box
   - Result:
   - Evidence:

6. Stepper resumes from files
   - Run: pane tests with a repo with commits and origin, then add `design/DESIGN.md`, then `design/PLAN.md`, re-mount
   - Pass: the current step moves Setup → Design → Plan → Tickets from the files alone; with design or plan present the Start screen is no longer shown unless the person opens it from the banner
   - Result:
   - Evidence:

7. Skip is remembered
   - Run: pane test pressing Skip on the GitHub line, then re-boot with the saved store value
   - Pass: the line shows "skipped" and the stepper moves on
   - Result:
   - Evidence:

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md
   - Pass: README.md describes the Start screen, the banner and that buttons only fill the prompt; the intro no longer says the pane needs a board; no stale mention remains
   - Result:
   - Evidence:

## Not checked by automation

- How the Start screen looks in the real desktop app (spacing, glass colours) and that pressing Enter after a filled prompt runs the command in a real session.

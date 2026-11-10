# Eval — 0017 — Explain a failed agent run

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates
   - Run: `claude plugin validate .` in the repository root
   - Pass: exit 0, no errors
   - Result:
   - Evidence:

2. Tests pass
   - Run: `claude plugin test .`
   - Pass: exit 0; unit and pane tests (terminal and desktop) all green, and the test count is higher than on main before this ticket
   - Result:
   - Evidence:

3. Failure detail on both surfaces (pane test)
   - Run: read `tests/pane.test.tsx`; a test, looped over `terminal` and `desktop`, stubs `agent.list` with one `failed` agent described "Build ticket 0001", emits a `turn.complete` for its id with `reason: 'error'` and an answer text, opens Agents (key `agents`), presses the failed agent's status, and `ui.find`s the reason line ("Stopped on an API error…"), the answer text and the ticket number. Pressing the status again (or the box's Hide) removes the box. Then run `claude plugin test .`
   - Pass: the test exists for both surfaces, passes, and fails when the detail box code is removed (the worker states how it checked this in the commit message)
   - Result:
   - Evidence:

4. Every reason and the unseen case
   - Run: read the pane tests for `turn.complete` reasons `aborted`, `refusal` (with category and explanation) and `answer`, and for a failed agent with no `turn.complete` seen
   - Pass: each case asserts the wording given in rd.md Behaviour ("Interrupted…", "The model refused" plus the refusal text, "It finished its turn but was marked failed", "The pane did not see how this run ended…"); a `killed` agent is pressable too; a `completed` or `running` agent's status is not pressable
   - Result:
   - Evidence:

5. Trying again / tried again / not retried
   - Run: read the pane tests that stub `agent.list` with (a) the failed agent plus a `running` agent on the same ticket, (b) the failed agent plus a later `completed` agent on the same ticket, (c) the failed agent alone, (d) a failed agent with no ticket and a live agent of the same name
   - Pass: the box reads "Trying again: <name> is running now" in (a) and (d), "Tried again: <name> completed" in (b), "Not retried: nothing else is working on this" in (c); all pass
   - Result:
   - Evidence:

6. Nothing written, nothing started
   - Run: `git diff main --stat` and read the new code paths for the detail box
   - Pass: pressing the status or Hide calls no file write, no `$.agent.spawn` and no prompt fill; the ticket writer's `turn.complete` toast and Notes text are unchanged (existing tests for it still pass)
   - Result:
   - Evidence:

7. End-to-end in the app
   - Run: in a session in this repo with the plugin loaded, ask Claude to start a subagent with description "Check ticket 0001" and stop it with Esc while it runs; open the pane, press **Agents**, press its red status
   - Pass: the detail box shows the ticket 0001 link with its board status, "Interrupted (stopped by you or by its spawner)", the last steps, and "Not retried: nothing else is working on this"; Hide closes it. Screenshot saved and path given
   - Result:
   - Evidence:

8. Docs and README updated
   - Run: read the files listed under `## Docs` in rd.md, and README.md (the **Agents.** paragraph under "The pane, view by view")
   - Pass: each listed doc describes the new behaviour as built (pressable failed/killed status, what the box shows, terminal too); README.md is current, or rd.md says why it needs no change
   - Result:
   - Evidence:

## Not checked by automation

- A person presses a red status with a real mouse in the Claude desktop app (pane tests press by key and cannot see hit-testing), at a narrow and a wide pane width.
- A real API-error failure (not an interrupt) reads sensibly; it is hard to cause on demand.

# Eval — 0045 — Held agents are not counted as running

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result: PASS
   - Evidence: validate exit 0 (Validation passed); plugin test on 3f34c0d: 427 pass, 0 fail across 3 files; no tests removed (diff only adds tests).

2. Held agents are not running (fails before the fix)
   - Run: pane test, desktop and terminal: `agent.list` returns one `running`
     and two `waiting` agents, main turn ended
   - Pass: heading reads `AGENTS · 1 RUNNING`; *Agents ● N* shows 1; the two
     waiting agents are listed under **Held**; the strip says
     `Waiting on 1 agent`
   - Result: PASS
   - Evidence: Tests 'held agents are not counted as running' (desktop, terminal) pass at 3f34c0d (heading AGENTS · 1 RUNNING, Agents ● 1, two held agents under HELD after the running one, strip 'Waiting on 1 agent · 2 agents held · Claude continues when it reports'). Against base hooks (1f4dae8) both fail. Tree restored to 3f34c0d.

3. Only held agents left
   - Run: pane test: `agent.list` returns two `waiting` agents only, main turn
     ended, no writer jobs
   - Pass: the strip says `2 agents held · nothing running`, without "Claude
     continues when they report"; `AGENTS · 0 RUNNING`; the tab title has no
     `● working`
   - Result: PASS
   - Evidence: Tests 'only held agents left' (desktop, terminal) pass: strip '2 agents held · nothing running', no 'Claude continues when' or 'Claude is idle', AGENTS · 0 RUNNING, tab title loses '● working' after turn ends. Both fail on base hooks.

4. Held agent with a done ticket
   - Run: pane test: a `waiting` agent described `Worker: ticket 0040` on a
     board where 0040 is `done`
   - Pass: its Held line says `ticket done: probably leftover`; a held agent
     whose ticket is not done has no such text
   - Result: PASS
   - Evidence: Tests 'held agent whose ticket is done is marked a probable leftover' (desktop, terminal) pass: exactly one note, on 0040 (done), none on 0041 (ready). Both fail on base hooks.

5. Idle and unknown statuses
   - Run: pane test: `agent.list` returns one `idle` agent and one with status
     `snoozing`
   - Pass: neither counts as running or keeps the strip up; the idle one is
     under **Recently finished**; the unknown one shows its raw word
   - Result: PASS
   - Evidence: Tests 'idle and unknown agent statuses are not running' (desktop, terminal) pass: AGENTS · 0 RUNNING, strip idle / Agents ● 0, idle agent under Recently finished, '● snoozing' shown raw, no 'Waiting on'. (These two also pass on base since idle/unknown were already uncounted; check does not require failing before.)

6. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no
     change
   - Result: PASS
   - Evidence: README Activity paragraph and Agents paragraph updated: running = pending/running, Held group, leftover note, 'N agents held · nothing running', idle under Recently finished, unknown raw. rd.md lists no other docs. Diff reviewed: no stray edits, no local named h, no new explicit undefined props, new keys unique, exported ActivityBar still a plain function, no new hotkey Buttons. Minor, not failing: held agents also get an Open transcript button.

## Not checked by automation

- In the live desktop app, a finished agent that stays `waiting` shows under
  Held, and the strip no longer says Claude is waiting on it.

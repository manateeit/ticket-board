# Eval — 0045 — Held agents are not counted as running

The checker fills in Result and Evidence for each check. It never edits the
checks themselves. ALL checks must PASS for the ticket to be done.

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted
   - Result:
   - Evidence:

2. Held agents are not running (fails before the fix)
   - Run: pane test, desktop and terminal: `agent.list` returns one `running`
     and two `waiting` agents, main turn ended
   - Pass: heading reads `AGENTS · 1 RUNNING`; *Agents ● N* shows 1; the two
     waiting agents are listed under **Held**; the strip says
     `Waiting on 1 agent`
   - Result:
   - Evidence:

3. Only held agents left
   - Run: pane test: `agent.list` returns two `waiting` agents only, main turn
     ended, no writer jobs
   - Pass: the strip says `2 agents held · nothing running`, without "Claude
     continues when they report"; `AGENTS · 0 RUNNING`; the tab title has no
     `● working`
   - Result:
   - Evidence:

4. Held agent with a done ticket
   - Run: pane test: a `waiting` agent described `Worker: ticket 0040` on a
     board where 0040 is `done`
   - Pass: its Held line says `ticket done: probably leftover`; a held agent
     whose ticket is not done has no such text
   - Result:
   - Evidence:

5. Idle and unknown statuses
   - Run: pane test: `agent.list` returns one `idle` agent and one with status
     `snoozing`
   - Pass: neither counts as running or keeps the strip up; the idle one is
     under **Recently finished**; the unknown one shows its raw word
   - Result:
   - Evidence:

6. Docs and README updated
   - Run: read README.md and the docs listed under `## Docs` in rd.md
   - Pass: they describe the change as built, or rd.md says why README needs no
     change
   - Result:
   - Evidence:

## Not checked by automation

- In the live desktop app, a finished agent that stays `waiting` shows under
  Held, and the strip no longer says Claude is waiting on it.

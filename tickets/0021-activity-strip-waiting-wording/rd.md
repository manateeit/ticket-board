# 0021 — Activity strip says "waiting for you" while agents work

Type: bug

## What

Reported 2026-11-11 (screenshot, 0.5.1, desktop): the activity strip read "Claude is waiting for you · 1 agent running" while a worker agent was building. `ActivityBar` in `hooks/desk.tsx` (~L328-350) prints "Claude is waiting for you" whenever the main turn is not busy (`S.busySince === 0`) and anything runs in the background, so it blames the person when the session is really waiting on its own agents and will continue by itself when they report.

## Behaviour

- Main turn busy: unchanged ("Claude is working · <tool> · since hh:mm").
- Main turn ended, one or more agents live (or AI ticket writers / adopt job running): "Waiting on N agent(s) · Claude continues when they report" (wording may be tightened, but it must not say the session is waiting for the person).
- Main turn ended, nothing running: the existing quiet "○ Claude is idle" (unchanged).
- Terminal: same wording rule wherever the terminal shows the activity line.
- Counts for agents and AI writers stay as today.

## Scope

IN: the wording logic, tests on both surfaces. OUT: detecting whether Claude's last message asked a question.

## Touchpoints

- `hooks/desk.tsx` — `ActivityBar`; `hooks/views.tsx` — terminal activity line if any; `tests/pane.test.tsx`.

## Docs

- README.md — where the activity strip is described: the three states.

## Open questions

- none

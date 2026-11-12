# 0032 — Notes prefixes written down

Type: chore

## What

The Notes column is described as free text, but `resultOf` (`hooks/core/query.ts:171`) derives the Merged / Failing / Blocked badge from keywords anywhere in it, and `setAiNote` (`hooks/ai.ts:100`) overwrites any note that is empty or starts with "AI ". The router is never told either rule. Decision (human, 2026-11-11): write the conventions down and match only those prefixes.

## Behaviour

- Notes conventions are defined in `templates/BOARD.md` (and this repo's board legend) and in `.claude/agents/router.md`: e.g. `merged <sha>`, `failed: …`, `blocked: …`, `AI …` (pane-owned).
- Badges come only from the defined prefix at the start of the note, not from words anywhere ("done after red tests in round 2" shows no Failing badge).
- The pane overwrites only notes with the pane prefix; router notes are never replaced.
- Existing notes on this board starting `merged <sha>` keep their Merged badge.
- Every note the pane writes uses the pane prefix, including "Answers folded in · N open questions" (`hooks/register.tsx:247`) and "Skeleton — fill in rd.md and eval.md" (`hooks/views.tsx:912`), so later AI notes ("AI enhancing…", "AI draft done") replace them instead of being skipped.
- One helper writes pane notes and decides ownership; `hooks/register.tsx:251` and `hooks/ai.ts:103` no longer each spell out the rule.

## Scope

IN: report L12 (first audit) and L6 (second audit). OUT: moving outcome state out of Notes; rewriting old notes; other leaks.

## Touchpoints

- `hooks/core/query.ts` (RESULTS ~L162-169, `resultOf` ~L171), `hooks/ai.ts` (`setAiNote` ~L100-104)
- `templates/BOARD.md:23`, `tickets/BOARD.md` legend, `.claude/agents/router.md` ~L54
- `hooks/register.tsx` ~L247-251, `hooks/views.tsx` ~L912, `hooks/ai.ts` ~L173
- Source: `tickets/audits/leaks-2026-11-11.md` L12; `tickets/audits/leaks-2026-11-11-2.md` L6

## Docs

- README.md — where badges are described: list the prefixes.

## Open questions

- none (resolved 2026-11-11; write the conventions down)

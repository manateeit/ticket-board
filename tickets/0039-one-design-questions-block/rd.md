# 0039 — One rule for where a design section's questions end

Type: bug

## What

`answerDesignQuestion` (`hooks/core/designfile.ts:33`) ends a D section's Open questions at the next `###` heading, while roadmap's reader (`hooks/core/roadmap.ts:88-117`) takes everything to the end of the section. A `### Notes` after the questions shows its bullets as open questions, blocks approval, and answering one always fails with "That question changed in DESIGN.md". The D heading regex and the `[ ]`/`[x]` strip are duplicated too (`designfile.ts:10,13` vs `roadmap.ts:61,119`).

## Behaviour

- One core function finds a D section's questions block; the reader and the answer writer both use it.
- Bullets under a later `### …` subsection are not open questions.
- Every question the pane shows can be answered from the pane.
- Design files without later subsections parse and answer exactly as today.

## Scope

IN: report L1. OUT: the DESIGN.md format; other leaks.

## Touchpoints

- `hooks/core/designfile.ts` (~L10-40)
- `hooks/core/roadmap.ts` (`parseSection` ~L88-119, D heading ~L61)
- Source: `tickets/audits/leaks-2026-11-11-2.md` L1

## Docs

- docs/STANDARD.md — the Open questions subsection ends at the next `###`.
- README.md — no change: no visible change except the fix.

## Open questions

- none

# 0030 — One parser for rd.md head fields

Type: bug

## What

The head fields (`Type:`, `Plan:`, `Design:`) live above the first `## ` and `hooks/core/ticket.ts` `headLines`/`headField` (~L49-61) parse them. `kindOf` (`hooks/core/query.ts:136`) and `setKind` (`hooks/desk.tsx:859`) scan the first 12 lines with their own regex, and `docSections` (`hooks/desk.tsx:840`) drops every line in the document starting with `type:`. A `type: module` line in a section or code block vanishes from the desktop ticket view, and a `Type:` below line 12 is ignored.

## Behaviour

- One core function reads and one writes the head fields; `kindOf`, `setKind` and `docSections` use it.
- Only the head's `Type:` line is hidden in the ticket view; `type:` lines inside sections and code fences are shown.
- A `Type:` anywhere in the head (above the first `## `) is read, regardless of line number.
- Changing Type rewrites the head line, or adds one under the title if missing; never a body line.
- Tickets with a normal short head look and classify as today.

## Scope

IN: report L8. OUT: other head-field formats; other leaks.

## Touchpoints

- `hooks/core/ticket.ts` (`headLines`, `headField`), `hooks/core/query.ts` (`kindOf` ~L136), `hooks/desk.tsx` (`docSections` ~L840, `setKind` ~L859)
- Source: `tickets/audits/leaks-2026-11-11.md` L8

## Docs

- README.md — no change unless the head-field rule is described there; docs/STANDARD.md section 4 if it mentions a line limit.

## Open questions

- none

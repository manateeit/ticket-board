// Edits the pane makes to DESIGN.md (format in docs/STANDARD.md, section 2): answering an open
// question of a D section, and approving the design. Pure text in, text out; the reading is in
// roadmap.ts (0003), the question format in ticket.ts, both reused unchanged.

import { changeSummary, parseChangeNote } from './roadmap'
import { answerQuestion, parseQuestions } from './ticket'

export class DesignEditError extends Error {}

const D_HEADING = /^##\s+(?:~~\s*)?D(\d+)\s*(?:~~\s*)?[·—–:]/i

/** A question's text as roadmap.ts shows it: without the `[ ]` / `[x]` box. */
export const questionText = (raw: string) => raw.replace(/^\[[ xX]\]\s*/, '').trim()

/**
 * Writes the person's answer under one open question of section `sectionId` (`D3`): the box is
 * ticked and `  **Resolved <date> (human): <answer>**` goes under it, the same line as on tickets.
 * `text` must still match the question (the file may have changed since it was shown).
 */
export function answerDesignQuestion(md: string, sectionId: string, text: string, answer: string, date: string): string {
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  const want = Number(sectionId.replace(/^D/i, ''))
  const head = lines.findIndex(l => {
    const m = D_HEADING.exec(l)
    return m !== null && Number(m[1]) === want
  })
  if (head === -1) throw new DesignEditError(`${sectionId} is no longer in DESIGN.md`)
  let end = lines.findIndex((l, i) => i > head && /^##\s/.test(l))
  if (end === -1) end = lines.length
  const q = lines.findIndex((l, i) => i > head && i < end && /^###\s+open questions/i.test(l))
  if (q === -1) throw new DesignEditError(`${sectionId} has no open questions section`)
  let qEnd = lines.findIndex((l, i) => i > q && i < end && /^###?\s/.test(l))
  if (qEnd === -1) qEnd = end
  // The questions as a stand-alone `## Open questions` block, so ticket.ts reads and writes them.
  const fragment = ['## Open questions', ...lines.slice(q + 1, qEnd)].join('\n')
  const found = parseQuestions(fragment).find(x => questionText(x.text) === text.trim())
  if (found === undefined || found.isResolved) throw new DesignEditError('That question changed in DESIGN.md since it was shown; look again')
  const next = answerQuestion(fragment, found.index, found.text, answer, date).split('\n')
  next[found.line] = (next[found.line] ?? '').replace(/^([-*]\s+)\[ \]/, '$1[x]')
  lines.splice(q + 1, qEnd - q - 1, ...next.slice(1))
  return lines.join(eol)
}

/** Sets `status: approved` (and `updated: <date>` when the file has that key) in the front matter. */
export function approveDesignText(md: string, date: string): string {
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  let open = 0
  while (open < lines.length && (lines[open] ?? '').trim() === '') open++
  const close = (lines[open] ?? '').trim() === '---' ? lines.findIndex((l, i) => i > open && l.trim() === '---') : -1
  if (close === -1) throw new DesignEditError('DESIGN.md has no front matter (--- … ---) to set status in')
  let hasStatus = false
  for (let i = open + 1; i < close; i++) {
    const line = lines[i] ?? ''
    if (/^\s*status\s*:/i.test(line)) {
      lines[i] = 'status: approved'
      hasStatus = true
    } else if (/^\s*updated\s*:/i.test(line)) lines[i] = `updated: ${date}`
  }
  if (!hasStatus) lines.splice(close, 0, 'status: approved')
  return lines.join(eol)
}

export type HistoryEntry = {
  name: string
  date: string
  label: string
  /** For a redesign note whose text was read: `D3 now rev 2, D9 added`; otherwise ''. */
  sections: string
}

/**
 * `design/changes/` file names, newest first: `2026-11-10-design-v3.md` → `v3`, `…-replan.md` → `Replan`.
 * `texts` holds the redesign notes' contents by file name; their changed sections and new Revs
 * (`parseChangeNote`) become `sections`.
 */
export function historyOf(names: readonly string[], texts: Readonly<Record<string, string>> = {}): HistoryEntry[] {
  return names
    .filter(n => /\.md$/i.test(n))
    .map(name => {
      const m = /^(\d{4}-\d{2}-\d{2})-?(.*)\.md$/i.exec(name)
      const date = m?.[1] ?? ''
      const rest = (m?.[2] ?? name.replace(/\.md$/i, '')).trim()
      const v = /^design-v(\d+)$/i.exec(rest)
      const label = v !== null ? `Design v${v[1]}` : /^replan$/i.test(rest) ? 'Replan' : rest.replace(/[-_]+/g, ' ')
      const text = texts[name]
      const sections = v === null || text === undefined ? '' : changeSummary(parseChangeNote(text, name))
      return { name, date, label, sections }
    })
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
}

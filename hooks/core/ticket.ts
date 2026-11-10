// Reading rd.md / eval.md: sections, open questions, the ready check.

export type Section = { name: string; key: string; body: string; start: number; end: number }

export const RD_SECTIONS = ['What', 'Behaviour', 'Scope', 'Touchpoints', 'Open questions'] as const

const sectionKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/behavior/, 'behaviour')
    .replace(/[^a-z ]/g, '')
    .trim()

/** `## ` sections of a markdown file. `start` is the heading line, `end` the line after the body. */
export function parseSections(md: string): Section[] {
  const lines = md.split(/\r?\n/)
  const out: Section[] = []
  let cur: Section | undefined
  lines.forEach((line, i) => {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m !== null && !line.startsWith('###')) {
      if (cur !== undefined) {
        cur.end = i
        cur.body = lines.slice(cur.start + 1, i).join('\n')
      }
      cur = { name: m[1]!, key: sectionKey(m[1]!), body: '', start: i, end: lines.length }
      out.push(cur)
    }
  })
  if (cur !== undefined) cur.body = lines.slice(cur.start + 1).join('\n')
  return out
}

export function findSection(md: string, name: string): Section | undefined {
  const key = sectionKey(name)
  return parseSections(md).find(s => s.key === key || s.key.startsWith(key))
}

/** `# 0004 — Title` → `Title`. */
export function parseTitle(md: string): string | undefined {
  const m = /^#\s+(?:\d{1,5}\s*[—–-]\s*)?(.+?)\s*$/m.exec(md)
  return m?.[1]
}

/** A `Design:` reference of a ticket: section id (`D3`) and the Rev it was written against, if given. */
export type DesignRef = { id: string; rev?: number }

/** The lines above the first `## ` section, where `Type:`, `Plan:` and `Design:` live. */
function headLines(rd: string): string[] {
  const lines = rd.split(/\r?\n/)
  const end = lines.findIndex(l => /^##\s/.test(l))
  return lines.slice(0, end === -1 ? Math.min(lines.length, 12) : end)
}

function headField(rd: string, key: string): string | undefined {
  const re = new RegExp(`^\\s*(?:\\*\\*)?${key}(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*(.*?)\\s*$`, 'i')
  for (const line of headLines(rd)) {
    const m = re.exec(line)
    if (m !== null) return m[1]!.replace(/\*\*/g, '').trim()
  }
  return undefined
}

/** `Plan: P1.3` → `P1.3`. No line (or `—` / `none`) means the ticket is off-plan: `undefined`. */
export function parsePlanRef(rd: string): string | undefined {
  const v = headField(rd, 'plan')
  const m = v === undefined ? null : /^`?([A-Za-z]+\d+(?:\.\d+)*)`?/.exec(v)
  return m === null ? undefined : m[1]!.toUpperCase()
}

/** `Design: D1@2, D3@1` → `[{ id: 'D1', rev: 2 }, { id: 'D3', rev: 1 }]`; a bare `D1` has no `rev`. */
export function parseDesignRefs(rd: string): DesignRef[] {
  const v = headField(rd, 'design')
  if (v === undefined) return []
  const out: DesignRef[] = []
  for (const m of v.matchAll(/\bD(\d+)(?:\s*@\s*(\d+))?/gi)) {
    const id = `D${Number(m[1])}`
    if (out.some(r => r.id === id)) continue
    out.push(m[2] === undefined ? { id } : { id, rev: Number(m[2]) })
  }
  return out
}

export type Question = {
  index: number
  text: string
  /** Lines under the bullet (answers, notes), joined. */
  detail: string
  isResolved: boolean
  /** 0-based line of the bullet. */
  line: number
  /** 0-based line after the item's last non-blank line. */
  end: number
}

const PLACEHOLDER = /^(none\b|\(none|<.*>$|n\/a$|-+$)/i

/** Open-question bullets of rd.md. Placeholders such as `- none` are not questions. */
export function parseQuestions(rd: string): Question[] {
  const sec = findSection(rd, 'Open questions')
  if (sec === undefined) return []
  const lines = rd.split(/\r?\n/)
  const items: Question[] = []
  let cur: Question | undefined
  const close = (endExclusive: number) => {
    if (cur === undefined) return
    let e = endExclusive
    while (e > cur.line + 1 && (lines[e - 1] ?? '').trim() === '') e--
    cur.end = e
    cur.detail = lines
      .slice(cur.line + 1, e)
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n')
    cur.isResolved = /\*\*\s*resolved\b/i.test(cur.detail) || /\bresolved\b.*\(human|agent\)/i.test(cur.detail) || /^~~/.test(cur.text) || /^\[x\]/i.test(cur.text)
    if (!PLACEHOLDER.test(cur.text)) items.push(cur)
    cur = undefined
  }
  for (let i = sec.start + 1; i < sec.end; i++) {
    const line = lines[i] ?? ''
    const m = /^[-*]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line)
    if (m !== null) {
      close(i)
      cur = { index: 0, text: m[1]!.trim(), detail: '', isResolved: false, line: i, end: i + 1 }
    }
  }
  close(sec.end)
  items.forEach((q, i) => (q.index = i))
  return items
}

export class QuestionEditError extends Error {}

/**
 * Writes the person's answer under question `index`, as
 * `  **Resolved <date> (human): <answer>**`. `expectText` must still match the
 * question's text (the file may have changed since it was shown).
 */
export function answerQuestion(rd: string, index: number, expectText: string, answer: string, date: string, who = 'human'): string {
  const q = parseQuestions(rd)[index]
  if (q === undefined || q.text !== expectText)
    throw new QuestionEditError('That question changed in rd.md since it was shown; look again')
  const eol = rd.includes('\r\n') ? '\r\n' : '\n'
  const lines = rd.split(/\r?\n/)
  const clean = answer.replace(/\s*\r?\n\s*/g, ' ').replace(/\*\*/g, '').trim()
  lines.splice(q.end, 0, `  **Resolved ${date} (${who}): ${clean}**`)
  return lines.join(eol)
}

export type Check = { id: string; label: string; isOk: boolean; isHard: boolean; detail?: string }

const TEMPLATE_LEFT = /^\s*[-*]?\s*<[^>]+>\s*$/m

function sectionFilled(sec: Section | undefined): boolean {
  if (sec === undefined) return false
  const body = sec.body.trim()
  return body !== '' && !TEMPLATE_LEFT.test(body)
}

export function countChecks(ev: string): number {
  const sec = findSection(ev, 'Checks')
  if (sec === undefined) return 0
  return sec.body.split(/\r?\n/).filter(l => /^\s*\d+[.)]\s+\S/.test(l) && !TEMPLATE_LEFT.test(l)).length
}

export type ReadyInput = {
  rd: string | undefined
  ev: string | undefined
  blockedBy: string[]
  /** Status of each ticket on the board, by number. */
  statusOf: (n: string) => string | undefined
}

/** The ready check shown on a ticket. Hard checks must pass before Mark ready is offered. */
export function readiness({ rd, ev, blockedBy, statusOf }: ReadyInput): Check[] {
  const out: Check[] = []
  if (rd === undefined) {
    out.push({ id: 'rd', label: 'rd.md exists', isOk: false, isHard: true })
  } else {
    const missing = RD_SECTIONS.filter(n => n !== 'Open questions' && !sectionFilled(findSection(rd, n)))
    out.push({
      id: 'sections',
      label: 'rd.md sections filled in',
      isOk: missing.length === 0 && findSection(rd, 'Open questions') !== undefined,
      isHard: true,
      detail: missing.length > 0 ? `missing or template: ${missing.join(', ')}` : undefined,
    })
    const docs = findSection(rd, 'Docs')
    out.push({
      id: 'docs',
      label: sectionFilled(docs) ? 'Docs step planned (README.md and docs to update)' : 'No Docs section: say which docs and README.md parts this changes',
      isOk: sectionFilled(docs),
      isHard: false,
    })
    const open = parseQuestions(rd).filter(q => !q.isResolved).length
    out.push({
      id: 'questions',
      label: open === 0 ? 'No open questions' : `${open} open question${open === 1 ? '' : 's'}`,
      isOk: open === 0,
      isHard: true,
    })
  }
  const checks = ev === undefined ? 0 : countChecks(ev)
  out.push({
    id: 'eval',
    label: ev === undefined ? 'eval.md exists' : `eval.md has ${checks} check${checks === 1 ? '' : 's'}`,
    isOk: checks > 0,
    isHard: true,
  })
  const unknown = blockedBy.filter(n => statusOf(n) === undefined)
  const waiting = blockedBy.filter(n => statusOf(n) !== undefined && statusOf(n) !== 'done')
  out.push({
    id: 'blockers',
    label:
      blockedBy.length === 0
        ? 'Not blocked by other tickets'
        : unknown.length > 0
          ? `Blocked by unknown ticket ${unknown.join(', ')}`
          : waiting.length > 0
            ? `Waits for ${waiting.join(', ')} (not done yet)`
            : `Blockers done (${blockedBy.join(', ')})`,
    isOk: unknown.length === 0,
    isHard: false,
  })
  return out
}

export const isReadyable = (checks: Check[]) => checks.every(c => c.isOk || !c.isHard)

/**
 * What a ticket created from the plan is missing of its docs step (0008): a `## Docs` section that
 * names README.md, and the "Docs and README updated" check in eval.md. Empty when both are there.
 */
export function docsGaps(rd: string | undefined, ev: string | undefined): string[] {
  const out: string[] = []
  const docs = rd === undefined ? undefined : findSection(rd, 'Docs')
  if (docs === undefined || !/readme/i.test(docs.body)) out.push('## Docs naming README.md')
  const checks = ev === undefined ? undefined : findSection(ev, 'Checks')
  if (checks === undefined || !/docs and readme updated/i.test(checks.body)) out.push('the "Docs and README updated" check')
  return out
}

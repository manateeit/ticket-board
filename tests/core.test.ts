import { expect, test } from 'claude-code/testing'

import { BoardEditError, addRow, parseBoard, setCells } from '../hooks/core/board'
import { kindOf, nextNumber, resultOf, query, runLine, slugify, titleFromIdea, type Item } from '../hooks/core/query'
import { answerQuestion, isReadyable, parseQuestions, readiness } from '../hooks/core/ticket'

const BOARD = `# Ticket board

Status flow: \`draft\` → \`ready\` → \`in-progress\` → \`in-check\` → \`done\`

| #    | Ticket                        | Status | Mode | Blocked by | Owner   | Notes |
|------|-------------------------------|--------|------|------------|---------|-------|
| 0001 | Health endpoint               | done   | solo | —          | —       | merged |
| 0002 | CSV export | ready | solo | 0001 | — | |
| 0003 | Dark mode for settings page   | draft  | solo | —          | —       | AI draft done · 2 open questions |

How to read this board:
- stuff
`

const RD = `# 0003 — Dark mode for settings page

## What

Settings page follows the system colour scheme.

## Behaviour

- Dark colours when the OS is dark.

## Scope

In:
- settings page

## Touchpoints

- src/settings.tsx — the page

## Open questions

- Should the toggle be remembered per device?
- Which accent colour in dark mode?
  (person decides)
`

const EVAL = `# Eval — 0003 — Dark mode

## Checks

1. Tests pass
   - Run: \`npm test\`
   - Pass: exit 0

## Not checked by automation

- none
`

test('parses the board table', () => {
  const b = parseBoard(BOARD)!
  expect(b.rows.map(r => r.number)).toEqual(['0001', '0002', '0003'])
  expect(b.rows[1]!.blockedBy).toEqual(['0001'])
  expect(b.rows[2]!.status).toBe('draft')
})

test('a status change rewrites exactly one line', () => {
  const after = setCells(BOARD, '0003', { status: 'ready' }, 'draft')
  const a = BOARD.split('\n')
  const b = after.split('\n')
  expect(b.length).toBe(a.length)
  const changed = a.filter((l, i) => l !== b[i])
  expect(changed.length).toBe(1)
  expect(parseBoard(after)!.rows[2]!.status).toBe('ready')
  expect(after.includes('| AI draft done · 2 open questions |')).toBe(true)
})

test('refuses a change when the row moved on', () => {
  expect(() => setCells(BOARD, '0003', { status: 'ready' }, 'in-progress')).toThrow(BoardEditError)
  expect(() => setCells(BOARD, '0099', { status: 'ready' })).toThrow(BoardEditError)
})

test('adds a row after the last ticket and escapes pipes', () => {
  const after = addRow(BOARD, { number: '0004', title: 'A | B', status: 'draft', mode: 'solo', blockedBy: [], owner: '—', notes: 'x' })
  const rows = parseBoard(after)!.rows
  expect(rows.map(r => r.number)).toEqual(['0001', '0002', '0003', '0004'])
  expect(after.includes('A \\| B')).toBe(true)
  expect(after.includes('How to read this board:')).toBe(true)
})

test('adds the first row to an empty table', () => {
  const empty = BOARD.split('\n').filter(l => !/^\| 000/.test(l)).join('\n')
  const after = addRow(empty, { number: '0001', title: 'First', status: 'draft', mode: 'solo', blockedBy: [], owner: '—', notes: '' })
  expect(parseBoard(after)!.rows.map(r => r.title)).toEqual(['First'])
})

test('finds open questions and records an answer under the right one', () => {
  const qs = parseQuestions(RD)
  expect(qs.length).toBe(2)
  expect(qs.every(q => !q.isResolved)).toBe(true)
  const after = answerQuestion(RD, qs[1]!.index, qs[1]!.text, 'Teal', '2026-11-09')
  const again = parseQuestions(after)
  expect(again[0]!.isResolved).toBe(false)
  expect(again[1]!.isResolved).toBe(true)
  expect(after.includes('**Resolved 2026-11-09 (human): Teal**')).toBe(true)
})

test('placeholder questions do not count', () => {
  expect(parseQuestions(RD.replace(/## Open questions[\s\S]*/, '## Open questions\n\n- none\n')).length).toBe(0)
  expect(parseQuestions(RD.replace(/## Open questions[\s\S]*/, '## Open questions\n\n- <Must be empty before this ticket can be marked ready>\n')).length).toBe(0)
})

test('ready check blocks on open questions and passes once answered', () => {
  const statusOf = () => 'done'
  expect(isReadyable(readiness({ rd: RD, ev: EVAL, blockedBy: [], statusOf }))).toBe(false)
  let rd = RD
  for (const q of parseQuestions(RD).reverse()) rd = answerQuestion(rd, q.index, q.text, 'yes', '2026-11-09')
  expect(isReadyable(readiness({ rd, ev: EVAL, blockedBy: [], statusOf }))).toBe(true)
  expect(isReadyable(readiness({ rd, ev: '# Eval\n\n## Checks\n\n', blockedBy: [], statusOf }))).toBe(false)
})

test('numbers, slugs and titles', () => {
  expect(nextNumber(['0001-a', '0007-b', 'TEMPLATE'], ['0008'])).toBe('0009')
  expect(nextNumber([])).toBe('0001')
  expect(slugify('Router run needs a continue press at the start of every session')).toBe('router-run-needs-a-continue-press-at-the-star')
  expect(titleFromIdea('let people export the board as CSV. Also more stuff')).toBe('Let people export the board as CSV')
})

test('filters and sorts', () => {
  const base = { mode: 'solo', owner: '—', notes: '', updatedMs: 0 }
  const list: Item[] = [
    { ...base, number: '0001', title: 'a', status: 'done', openQuestions: 0 },
    { ...base, number: '0002', title: 'b', status: 'ready', openQuestions: 0 },
    { ...base, number: '0003', title: 'c', status: 'draft', openQuestions: 2, kind: 'bug' },
    { ...base, number: '0004', title: 'd', status: 'blocked', openQuestions: 0, mode: 'team' },
  ]
  expect(query(list, { show: 'needs-me', sort: 'number', mode: 'any', search: '', kind: 'any', desc: false }).map(i => i.number)).toEqual(['0003', '0004'])
  expect(query(list, { show: 'not-done', sort: 'number-desc', mode: 'any', search: '', kind: 'any', desc: false }).map(i => i.number)).toEqual(['0004', '0003', '0002'])
  expect(query(list, { show: 'all', sort: 'number', mode: 'team', search: '', kind: 'any', desc: false }).map(i => i.number)).toEqual(['0004'])
  expect(query(list, { show: 'all', sort: 'number', mode: 'any', search: '0002', kind: 'any', desc: false }).map(i => i.number)).toEqual(['0002'])
  expect(query(list, { show: 'all', sort: 'number', mode: 'any', search: '', kind: 'bug', desc: false }).map(i => i.number)).toEqual(['0003'])
  expect(query(list, { show: 'all', sort: 'title', mode: 'any', search: '', kind: 'any', desc: true }).map(i => i.number)).toEqual(['0004', '0003', '0002', '0001'])
})

test('ticket types', () => {
  expect(kindOf('Fix crash when exporting')).toBe('bug')
  expect(kindOf('Rename the package')).toBe('chore')
  expect(kindOf('Dark mode for settings')).toBe('feature')
  expect(kindOf('Dark mode', '# Dark mode\n\nType: bug\n')).toBe('bug')
})

test('run lines', () => {
  expect(runLine(['0011'])).toBe('Run ticket 0011.')
  expect(runLine(['0011', '0013', '0014'])).toBe('Run tickets 0011, 0013 and 0014.')
  expect(runLine(['0011'], true)).toStartWith('Run ticket 0011 as the router. If this session is not already the router, first read .claude/agents/router.md')
})

test('result tags from board notes', () => {
  expect(resultOf('merged f681c3c (merge commit, local, no push); 3 worker rounds')?.label).toBe('Merged')
  expect(resultOf('moved from GitHub issue #2 2026-11-09')?.label).toBe('From GitHub')
  expect(resultOf('—')).toBeUndefined()
})

test('hide done works across tabs but not on the Done tab', () => {
  const it = (number: string, status: string) => ({ number, title: number, status, mode: 'solo', owner: '', notes: '', openQuestions: 0, updatedMs: 0, kind: 'feature' as const, isUnlisted: false, blockedBy: [] })
  const all = [it('0001', 'done'), it('0002', 'ready'), it('0003', 'draft')]
  const base = { show: 'all' as const, sort: 'number' as const, mode: 'any' as const, search: '', kind: 'any' as const, desc: false }
  expect(query(all, { ...base, hideDone: true }).map(i => i.number)).toEqual(['0002', '0003'])
  expect(query(all, { ...base, show: 'done', hideDone: true }).map(i => i.number)).toEqual(['0001'])
  expect(query(all, base).length).toBe(3)
})

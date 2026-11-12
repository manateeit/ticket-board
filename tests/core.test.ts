import { expect, test } from 'claude-code/testing'

import { BoardEditError, addRow, formatBlockedBy, parseBlockedBy, parseBoard, setCells } from '../hooks/core/board'
import {
  commitFromRefs,
  hasCode,
  ideaFile,
  isBlankProject,
  isSetupDone,
  originUrl,
  parseGitFile,
  parseHead,
  parseRemote,
  projectName,
  readGitFacts,
  readmeSummary,
  readmeTitle,
  startStep,
  type StartFacts,
} from '../hooks/core/project'
import { DEFAULT_FILTERS, OFF_PLAN, comparePhase, kindOf, nextNumber, resultOf, query, runLine, slugify, sortItems, titleFromIdea, type Filters, type Item, type Sort } from '../hooks/core/query'
import {
  applyProposal,
  blockedByFor,
  changeSummary,
  coveredDoneWhen,
  designLine,
  docsFollowUp,
  markProposal,
  missingNote,
  parseChangeNote,
  parseDesign,
  parsePlan,
  parseProposal,
  planBatch,
  planBrief,
  planHash,
  roadmap,
  setPlanTicket,
  staleOf,
  staleText,
  ticketRef,
  withDocsItem,
  withNoteFollowUp,
} from '../hooks/core/roadmap'
import { historyOf } from '../hooks/core/designfile'
import { answerQuestion, docsGaps, isReadyable, isResolved, parseQuestions, readiness } from '../hooks/core/ticket'
import { S, logAgentTool, toolDetail } from '../hooks/store'
import { adoptLeftOut, adoptPaths, adoptResult, bindFromBoard, parseAdopt, setBindingLine } from '../hooks/core/roadmap'
import { DEMO_ROADMAP } from './demo-roadmap'
import { ADOPT_NOTES, adoptProposal } from './adopt-fixture'

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
  const after = setCells(BOARD, '0003', { status: 'ready' }, 'draft').text
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

test('setCells reports columns the board does not have and leaves the file alone for them', () => {
  const lean = `| # | Ticket | Status |\n|---|--------|--------|\n| 0003 | Dark mode | draft |\n`
  const all = setCells(lean, '0003', { notes: 'x', mode: 'team', blockedBy: ['0001'] })
  expect([...all.skipped].sort()).toEqual(['blockedBy', 'mode', 'notes'])
  expect(all.text).toBe(lean)
  const some = setCells(lean, '0003', { status: 'blocked', notes: 'blocked: waiting' }, 'draft')
  expect(some.skipped).toEqual(['notes'])
  expect(parseBoard(some.text)!.rows[0]!.status).toBe('blocked')
  expect(some.text).not.toContain('waiting')
  // A full board writes every column and skips nothing.
  expect(setCells(BOARD, '0003', { mode: 'team', notes: 'n' }).skipped).toEqual([])
})

test('Blocked by: the board module owns the cell format, up to 5-digit numbers', () => {
  expect(formatBlockedBy(['0003', '10000'])).toBe('0003, 10000')
  expect(formatBlockedBy(['3'])).toBe('0003')
  expect(formatBlockedBy([])).toBe('—')
  expect(parseBlockedBy(formatBlockedBy(['0003', '10000']))).toEqual(['0003', '10000'])
  expect(parseBlockedBy(formatBlockedBy([]))).toEqual([])
  const one = setCells(BOARD, '0003', { blockedBy: ['0003', '10000'] }).text
  expect(parseBoard(one)!.rows[2]!.blockedBy).toEqual(['0003', '10000'])
  const none = setCells(one, '0003', { blockedBy: [] }).text
  expect(parseBoard(none)!.rows[2]!.blockedBy).toEqual([])
  expect(none.split('\n').find(l => l.startsWith('| 0003'))).toContain('| —')
  // Writing the list a row already has gives back the same bytes.
  expect(setCells(BOARD, '0002', { blockedBy: ['0001'] }).text).toBe(BOARD)
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

test('a detail line mentioning "agent)" or "(human" does not resolve a question (0024)', () => {
  const rd = RD.replace(/## Open questions[\s\S]*/, '## Open questions\n\n- Which colour?\n  ask the router (or the agent)\n  then check with (human review\n')
  const qs = parseQuestions(rd)
  expect(qs.length).toBe(1)
  expect(qs[0]!.isResolved).toBe(false)
  expect(isResolved('Which colour?', 'ask the router (or the agent)')).toBe(false)
  expect(isResolved('Which colour?', 'resolved later (human')).toBe(false)
  const check = readiness({ rd, ev: EVAL, blockedBy: [], statusOf: () => 'done' }).find(c => c.id === 'questions')
  expect(check?.isOk).toBe(false)
  expect(check?.label).toContain('1 open question')
})

test('every accepted resolved form counts as answered (0024)', () => {
  const with_ = (body: string) => RD.replace(/## Open questions[\s\S]*/, `## Open questions\n\n${body}\n`)
  const forms = [
    '- Which colour?\n  **Resolved 2026-11-11 (human): teal**',
    '- Which colour?\n  **Resolved 2026-11-11 (agent, from code: x.ts): teal**',
    '- Which colour?\n  **Resolved 2026-11-11 (agent, from code: x.ts)**: teal',
    '- [x] Which colour?',
    '- ~~Which colour?~~',
  ]
  for (const f of forms) {
    const qs = parseQuestions(with_(f))
    expect(qs.length).toBe(1)
    expect(qs[0]!.isResolved).toBe(true)
  }
  expect(parseQuestions(with_('- none')).length).toBe(0)
  expect(parseQuestions(with_('- none (resolved 2026-11-11; answers folded into the ticket)')).length).toBe(0)
  const statusOf = () => 'done'
  for (const f of [...forms, '- none', '- none (resolved 2026-11-11; answers folded into the ticket)'])
    expect(readiness({ rd: with_(f), ev: EVAL, blockedBy: [], statusOf }).find(c => c.id === 'questions')?.isOk).toBe(true)
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

test('phase filter and sort', () => {
  const base = { mode: 'solo', owner: '—', notes: '', updatedMs: 0, openQuestions: 0, status: 'ready' }
  const list: Item[] = [
    { ...base, number: '0001', title: 'a', phase: 'P10' },
    { ...base, number: '0002', title: 'b', phase: '' },
    { ...base, number: '0003', title: 'c', phase: 'P2' },
    { ...base, number: '0004', title: 'd', phase: 'P1' },
    { ...base, number: '0005', title: 'e', phase: 'P2' },
  ]
  const f = (phase: string, sort: Sort = 'number') => query(list, { ...DEFAULT_FILTERS, phase, sort }).map(i => i.number)
  // The default filters keep every phase.
  expect(DEFAULT_FILTERS.phase).toBe('any')
  expect(query(list, DEFAULT_FILTERS).map(i => i.number)).toEqual(['0001', '0002', '0003', '0004', '0005'])
  expect(f('any')).toEqual(['0001', '0002', '0003', '0004', '0005'])
  expect(f('P2')).toEqual(['0003', '0005'])
  expect(f(OFF_PLAN)).toEqual(['0002'])
  expect(f('P7')).toEqual([])
  // Filters saved before the phase filter existed have no phase: nothing is filtered out.
  const { phase: _phase, ...old } = DEFAULT_FILTERS
  expect(query(list, old as Filters).length).toBe(5)
  // With no plan bound items carry no phase and a remembered phase filter is ignored.
  const noPlan = list.map(({ phase: _p, ...i }) => i as Item)
  expect(query(noPlan, { ...DEFAULT_FILTERS, phase: 'P2' }).length).toBe(5)
  // Phase sort: numeric order (P2 before P10), off-plan last, number breaks ties; desc reverses.
  expect(f('any', 'phase')).toEqual(['0004', '0003', '0005', '0001', '0002'])
  expect(query(list, { ...DEFAULT_FILTERS, sort: 'phase', desc: true }).map(i => i.number)).toEqual(['0002', '0001', '0005', '0003', '0004'])
  expect(sortItems(noPlan, 'phase').map(i => i.number)).toEqual(['0001', '0002', '0003', '0004', '0005'])
  expect(comparePhase('P2', 'P10')).toBeLessThan(0)
  expect(comparePhase('', 'P1')).toBeGreaterThan(0)
  expect(comparePhase(undefined, '')).toBe(0)
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

test('project: origin, branch and name come from plain files', () => {
  const cfg = '[core]\n\tbare = false\n[remote "upstream"]\n\turl = git@github.com:x/y.git\n[remote "origin"]\n\turl = https://github.com/manateeit/ticket-board.git\n'
  expect(originUrl(cfg)).toBe('https://github.com/manateeit/ticket-board.git')
  expect(parseRemote('git@github.com:acme/shop.git')).toEqual({ host: 'github.com', repo: 'acme/shop', repoUrl: 'https://github.com/acme/shop' })
  expect(parseRemote('ssh://git@gitlab.com:22/g/sub/p.git').repo).toBe('g/sub/p')
  expect(parseRemote('https://git.internal/team/app').repoUrl).toBe('')
  expect(parseHead('ref: refs/heads/feature/x\n')).toBe('feature/x')
  expect(parseHead('0123456789abcdef0123456789abcdef01234567')).toBe('0123456')
  expect(parseGitFile('gitdir: /r/.git/worktrees/w\n')).toBe('/r/.git/worktrees/w')
  expect(readmeTitle('```\n# not this\n```\n# [Shop](x) ![b](y.svg)\n')).toBe('Shop')
  expect(projectName(undefined, '{"name":"@acme/shop"}', '/a/b')).toBe('@acme/shop')
  expect(projectName(undefined, undefined, '/a/b/')).toBe('b')
})

test('readiness: Docs section is a soft check', () => {
  const base = '# 1 — T\n\n## What\n\nx\n\n## Behaviour\n\n- y\n\n## Scope\n\nIn: z\n\n## Touchpoints\n\n- a.ts\n\n## Open questions\n\n- none\n'
  const ev = '# Eval\n\n## Checks\n\n1. Tests pass\n'
  const no = readiness({ rd: base, ev, blockedBy: [], statusOf: () => undefined })
  expect(no.find(c => c.id === 'docs')?.isOk).toBe(false)
  expect(isReadyable(no)).toBe(true)
  const yes = readiness({ rd: base.replace('## Open questions', '## Docs\n\n- README.md — add a CSV section\n\n## Open questions'), ev, blockedBy: [], statusOf: () => undefined })
  expect(yes.find(c => c.id === 'docs')?.isOk).toBe(true)
})

test('agent activity lines name the file or command', () => {
  S.cwd = '/repo'
  expect(toolDetail({ tool: 'Edit', file_path: '/repo/src/app.ts' })).toBe('src/app.ts')
  expect(toolDetail({ tool: 'Bash', command: 'bun test\necho done' })).toBe('bun test')
  logAgentTool('x1', { tool: 'Read', file_path: '/repo/README.md' })
  expect(S.agentLog.get('x1')?.[0]?.detail).toBe('README.md')
})

test('readme summary is the first prose paragraph, plain text', () => {
  const md = '# Acme\n\n[![ci](x.svg)](y)\n\nA **tiny** shop that sells [hats](https://h). It ships fast.\n\n## Install\n\nnpm i'
  expect(readmeSummary(md)).toBe('A tiny shop that sells hats. It ships fast.')
  expect(readmeSummary('# Only a title\n', '{"description":"From package"}')).toBe('From package')
  expect(readmeSummary(undefined)).toBe('')
})

// ---------- Start screen detection (files only: the reader is a Map, nothing else is called) ----------

const SHA = '0123456789abcdef0123456789abcdef01234567'
const reader = (files: Record<string, string>) => {
  const asked: string[] = []
  const read = async (path: string) => (asked.push(path), files[path])
  return { read, asked }
}
const facts = (git: Awaited<ReturnType<typeof readGitFacts>>, cfg: string | undefined, more: Partial<StartFacts> = {}): StartFacts => ({
  git: git.state,
  hasCommit: git.hasCommit,
  hasOrigin: parseRemote(cfg === undefined ? '' : originUrl(cfg)).repo !== '',
  isGithubSkipped: false,
  hasIdea: false,
  hasDesign: false,
  hasPlan: false,
  hasTickets: false,
  ...more,
})

test('start: no .git is "none" and the step is Setup', async () => {
  const { read, asked } = reader({})
  const git = await readGitFacts('/p', read, false)
  expect(git.state).toBe('none')
  expect(git.hasCommit).toBe(false)
  expect(asked.every(p => p.startsWith('/p/.git'))).toBe(true)
  expect(startStep(facts(git, undefined))).toBe('setup')
  expect(isBlankProject(facts(git, undefined))).toBe(true)
})

test('start: a .git that cannot be read is "unknown" and does not hold Setup up', async () => {
  const git = await readGitFacts('/p', reader({}).read, true)
  expect(git.state).toBe('unknown')
  expect(isSetupDone(facts(git, undefined))).toBe(true)
  expect(startStep(facts(git, undefined))).toBe('idea')
})

test('start: git with zero commits stays on Setup', async () => {
  const git = await readGitFacts('/p', reader({ '/p/.git/HEAD': 'ref: refs/heads/main\n', '/p/.git/config': '[core]\n' }).read, true)
  expect(git).toMatchObject({ state: 'repo', branch: 'main', hasCommit: false })
  expect(startStep(facts(git, '[core]\n'))).toBe('setup')
  // Skipping GitHub does not skip the first commit.
  expect(startStep(facts(git, '[core]\n', { isGithubSkipped: true }))).toBe('setup')
})

test('start: git with a commit and a GitHub origin moves on to Idea, then Design, Plan, Tickets', async () => {
  const cfg = '[remote "origin"]\n\turl = git@github.com:acme/app.git\n'
  const git = await readGitFacts('/p', reader({ '/p/.git/HEAD': 'ref: refs/heads/main\n', '/p/.git/config': cfg, '/p/.git/refs/heads/main': `${SHA}\n` }).read, true)
  expect(git).toMatchObject({ state: 'repo', branch: 'main', hasCommit: true })
  expect(parseRemote(originUrl(git.config ?? '')).repo).toBe('acme/app')
  const f = facts(git, cfg)
  expect(startStep(f)).toBe('idea')
  expect(startStep({ ...f, hasIdea: true })).toBe('design')
  expect(startStep({ ...f, hasIdea: true, hasDesign: true })).toBe('plan')
  expect(startStep({ ...f, hasDesign: true, hasPlan: true })).toBe('tickets')
  expect(startStep({ ...f, hasDesign: true, hasPlan: true, hasTickets: true })).toBe('done')
  expect(isBlankProject({ ...f, hasTickets: true })).toBe(false)
  // No origin: Setup until the person skips GitHub.
  expect(startStep({ ...f, hasOrigin: false })).toBe('setup')
  expect(startStep({ ...f, hasOrigin: false, isGithubSkipped: true })).toBe('idea')
})

test('start: a non-GitHub origin counts as set up; packed refs count as a commit', async () => {
  const cfg = '[remote "origin"]\n\turl = https://git.internal/team/app.git\n'
  const git = await readGitFacts(
    '/p',
    reader({ '/p/.git/HEAD': 'ref: refs/heads/trunk\n', '/p/.git/config': cfg, '/p/.git/packed-refs': `# pack-refs with: peeled\n${SHA} refs/heads/trunk\n` }).read,
    true,
  )
  expect(git.hasCommit).toBe(true)
  expect(startStep(facts(git, cfg))).toBe('idea')
})

test('start: a worktree .git pointer file is followed to the shared refs and config', async () => {
  const cfg = '[remote "origin"]\n\turl = git@github.com:acme/app.git\n'
  const files = {
    '/w/.git': 'gitdir: /main/.git/worktrees/w\n',
    '/main/.git/worktrees/w/HEAD': 'ref: refs/heads/ticket/0004\n',
    '/main/.git/worktrees/w/commondir': '../..\n',
    '/main/.git/config': cfg,
    '/main/.git/refs/heads/ticket/0004': `${SHA}\n`,
  }
  const git = await readGitFacts('/w', reader(files).read, true)
  expect(git).toMatchObject({ state: 'repo', branch: 'ticket/0004', hasCommit: true, commonDir: '/main/.git' })
  expect(startStep(facts(git, git.config))).toBe('idea')
  // Same worktree before its branch has a commit.
  const fresh = await readGitFacts('/w', reader({ ...files, '/main/.git/refs/heads/ticket/0004': '' }).read, true)
  expect(fresh.hasCommit).toBe(false)
  expect(startStep(facts(fresh, fresh.config))).toBe('setup')
})

test('start: commit presence, code detection and the idea file from names alone', () => {
  expect(commitFromRefs(SHA, undefined, undefined)).toBe(true)
  expect(commitFromRefs('ref: refs/heads/main', undefined, undefined)).toBe(false)
  expect(commitFromRefs('ref: refs/heads/main', undefined, `${SHA} refs/heads/mainline`)).toBe(false)
  expect(hasCode(['.git', 'README.md', 'LICENSE', 'tickets', 'design', '.gitignore'])).toBe(false)
  expect(hasCode(['.git', 'README.md', 'src', 'package.json'])).toBe(true)
  expect(ideaFile([{ name: 'Brief.md', kind: 'file' }], [])).toBe('design/Brief.md')
  expect(ideaFile([], [{ name: '2026-11-01-a.md', kind: 'file' }, { name: '2026-11-09-b.md', kind: 'file' }])).toBe('design/brainstorms/2026-11-09-b.md')
  expect(ideaFile([{ name: 'DESIGN.md', kind: 'file' }], [])).toBe('')
})

// ---------- Tickets from the plan (0008) ----------

const T8_DESIGN = `---
design: Salon
version: 2
status: approved
updated: 2026-11-10
---
# Salon: design

## D1 · Accounts
Rev: 1
What: Email sign-in.
Done when:
- a person can sign in

## D2 · Booking
Rev: 2
What: Book a slot.
Done when:
- a free slot can be booked
- a taken slot cannot be booked twice

## D3 · Reminders
Rev: 1
Done when:
- a reminder mail goes out a day before
`

const T8_PLAN = `---
plan: Salon
design-version: 2
updated: 2026-11-10
---
# Salon: plan

## P1 · Foundations
Goal: people can book a slot.
Appetite: 2 weeks
Exit: a booked slot shows on the calendar

| # | Build | Size | Needs | Covers | Done when | Ticket | Status |
|---|---|---|---|---|---|---|---|
| P1.1 | Accounts | S | — | D1 | sign in works | 0001 | |
| P1.2 | Booking core | M | P1.1, P1.4 | D2 | a slot is booked | — | |
| P1.3 | Calendar | S | P1.2 | D2, D3 | calendar shows bookings | — | |
| P1.4 | Slots | S | — | D2 | slots listed | | |
| P1.5 | Reminders | S | P1.4 | D3 | reminder sent | — | |
| P1.6 | Loyalty | S | — | D3 | points | — | deferred |
`

const t8 = () => roadmap(T8_DESIGN, T8_PLAN, [ticketRef({ number: '0001', status: 'done' }, '# 0001 — Accounts\n\nPlan: P1.1\n')])

test('plan batch: skips builds with a ticket, leaves out deferred, needed builds in the batch first, ids deduped', () => {
  const rm = t8()
  const b = planBatch(rm.plan, rm.links, ['P1.1', 'P1.2', 'P1.3', 'P1.4', 'P1.5', 'P1.6', 'P1.2', 'p1.3', 'P9.9'])
  expect(b.skipped.map(x => x.id)).toEqual(['P1.1'])
  expect(b.left.map(x => x.id)).toEqual(['P1.6'])
  // P1.2 needs P1.4, so P1.4 is created first; P1.3 needs P1.2.
  expect(b.create.map(x => x.id)).toEqual(['P1.4', 'P1.2', 'P1.3', 'P1.5'])
})

test('plan batch: Blocked by maps Needs to ticket numbers; a needed build with no ticket is noted, not blocked on', () => {
  const rm = t8()
  const b = planBatch(rm.plan, rm.links, ['P1.2', 'P1.3', 'P1.4', 'P1.5'])
  const created = new Map<string, string>()
  const out: Record<string, { blockedBy: string[]; missing: string[] }> = {}
  let n = 2
  for (const x of b.create) {
    out[x.id] = blockedByFor(x, rm.links, created)
    created.set(x.id, String(n++).padStart(4, '0'))
  }
  expect(created.get('P1.4')).toBe('0002')
  expect(out['P1.2']).toEqual({ blockedBy: ['0001', '0002'], missing: [] })
  expect(out['P1.3']).toEqual({ blockedBy: ['0003'], missing: [] })
  expect(out['P1.5']).toEqual({ blockedBy: ['0002'], missing: [] })
  // Only P1.2 selected: P1.4 has no ticket and is not in the batch.
  const alone = blockedByFor(planBatch(rm.plan, rm.links, ['P1.2']).create[0]!, rm.links, new Map())
  expect(alone).toEqual({ blockedBy: ['0001'], missing: ['P1.4'] })
  expect(missingNote(alone.missing)).toContain('P1.4')
  expect(missingNote([])).toBe('')
})

test('plan brief: build row, phase Goal and Exit, covered sections with Rev and Done when lines', () => {
  const rm = t8()
  const p13 = rm.plan.phases[0]!.builds.find(x => x.id === 'P1.3')!
  const brief = planBrief(rm.design, rm.plan, p13)
  for (const part of [
    'Build P1.3 · Calendar',
    'Needs: P1.2',
    'Phase P1 · Foundations',
    'Phase goal: people can book a slot.',
    'Phase exit: a booked slot shows on the calendar',
    'Plan: P1.3',
    'Design: D2@2, D3@1',
    'D2 · Booking (Rev 2)',
    '- a free slot can be booked',
    '- a taken slot cannot be booked twice',
    '- a reminder mail goes out a day before',
  ])
    expect(brief).toContain(part)
  expect(designLine(rm.design, ['D2', 'D3', 'D9'])).toBe('D2@2, D3@1, D9')
  expect(coveredDoneWhen(rm.design, p13)).toEqual(['a free slot can be booked', 'a taken slot cannot be booked twice', 'a reminder mail goes out a day before'])
})

test('plan Ticket cell: — becomes the number, an existing number gets the new one appended, other lines unchanged', () => {
  const once = setPlanTicket(T8_PLAN, 'P1.2', '0002')
  expect(once).toContain('| P1.2 | Booking core | M | P1.1, P1.4 | D2 | a slot is booked | 0002 | |')
  const twice = setPlanTicket(setPlanTicket(T8_PLAN, 'P1.1', '0016'), 'P1.4', '0003')
  expect(twice).toContain('| 0001, 0016 |')
  expect(twice).toContain('| P1.4 | Slots | S | — | D2 | slots listed | 0003 | |')
  // The same number again, or an unknown build: unchanged.
  expect(setPlanTicket(T8_PLAN, 'P1.1', '0001')).toBe(T8_PLAN)
  expect(setPlanTicket(T8_PLAN, 'P7.1', '0002')).toBe(T8_PLAN)
  const before = T8_PLAN.split('\n')
  const after = once.split('\n')
  expect(after.length).toBe(before.length)
  expect(after.filter((l, i) => l !== before[i]).length).toBe(1)
  // The roadmap reads the number back.
  expect(roadmap(T8_DESIGN, once, []).plan.phases[0]!.builds.find(x => x.id === 'P1.2')!.tickets).toEqual(['0002'])
})

test('docs gaps: a ticket from the plan needs ## Docs naming README.md and the Docs and README updated check', () => {
  const rdOk = '# 0002 — X\n\n## What\nx\n\n## Docs\n- README.md — no change: internal\n'
  const evOk = '# Eval\n\n## Checks\n1. Tests\n2. Docs and README updated\n   - Pass: current\n'
  expect(docsGaps(rdOk, evOk)).toEqual([])
  expect(docsGaps('# 0002 — X\n\n## What\nx\n', evOk)).toEqual(['## Docs naming README.md'])
  expect(docsGaps('# 0002 — X\n\n## Docs\n- docs/api.md — new route\n', evOk)).toEqual(['## Docs naming README.md'])
  expect(docsGaps(rdOk, '# Eval\n\n## Checks\n1. Tests\n')).toEqual(['the "Docs and README updated" check'])
  expect(docsGaps(undefined, undefined).length).toBe(2)
})

// ---------- Redesign notes and stale tickets (0015) ----------

const T15_DESIGN = `---
design: Salon
version: 2
status: approved
updated: 2026-11-10
---
# Salon: design

## D1 · Booking
Rev: 1

## D3 · Payments
Rev: 2
`

const T15_PLAN = `---
plan: Salon
design-version: 2
updated: 2026-11-10
---
# Salon: plan

## P1 · Foundations
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Payments | M | — | D1, D3 | a card is charged | — |
`

const t15rd = (design: string) => `# 0001 — X\n\nType: feature\nPlan: P1.1\n${design}\n\n## What\n\nx\n`

test('stale detection: D3@1 against Rev 2 is stale and counted in the alerts; D3@2 is not', () => {
  const old = ticketRef({ number: '0001', status: 'draft' }, t15rd('Design: D3@1'))
  const cur = ticketRef({ number: '0002', status: 'draft' }, t15rd('Design: D3@2'))
  const rm = roadmap(T15_DESIGN, T15_PLAN, [old, cur])
  expect(staleOf(rm.links, '0001')).toEqual([{ ticket: '0001', section: 'D3', rev: 1, now: 2 }])
  expect(staleOf(rm.links, '0002')).toEqual([])
  expect(staleText(staleOf(rm.links, '0001')[0]!)).toBe('Written against D3 rev 1, now rev 2')
  const alert = rm.checks.find(a => a.id === 'stale-tickets')!
  expect(alert.subjects).toEqual(['0001'])
  // Only D3@2: nothing stale, no alert.
  expect(roadmap(T15_DESIGN, T15_PLAN, [cur]).checks.some(a => a.id === 'stale-tickets')).toBe(false)
})

test('stale detection: done and in-progress tickets are flagged; malformed lines and unknown sections are not', () => {
  const done = ticketRef({ number: '0001', status: 'done' }, t15rd('Design: D3@1'))
  const busy = ticketRef({ number: '0002', status: 'in-progress' }, t15rd('Design: D1@1, D3@1'))
  const bad = ['Design: D3@two', 'Design: @@,, ???', 'Design: D3@', 'Design:', 'Design: D9@1', 'Design: X3@1'].map((line, n) =>
    ticketRef({ number: `00${10 + n}`, status: 'draft' }, t15rd(line)),
  )
  const rm = roadmap(T15_DESIGN, T15_PLAN, [done, busy, ...bad])
  expect(rm.links.stale.map(r => r.ticket)).toEqual(['0001', '0002'])
  expect(rm.checks.find(a => a.id === 'stale-tickets')!.subjects).toEqual(['0001', '0002'])
  for (const t of bad) expect(staleOf(rm.links, t.number)).toEqual([])
  // A missing or unreadable design never flags anything.
  expect(roadmap(undefined, T15_PLAN, [done]).links.stale).toEqual([])
  expect(roadmap('not a design', T15_PLAN, [done]).links.stale).toEqual([])
})

test('change note: changed sections with their new Revs, added and dropped ones', () => {
  const note = parseChangeNote(
    '---\nchange: design-v3\ndate: 2026-11-10\ndesign-version: 3\n---\n# Design v3\n\n## Why\nx\n\n## Changes\n- Changed D3 (Rev 1 → 2): cards only\n- Changed d4 (rev 2 -> 3): sms\n- Added D9 · Waitlist\n- Dropped D7 · Remote workers\n- Something else\n\n## Follow-ups\n- Changed D8 (Rev 1 → 5): not under Changes\n',
    '2026-11-10-design-v3.md',
  )
  expect(note.version).toBe(3)
  expect(note.date).toBe('2026-11-10')
  expect(note.changed).toEqual([
    { id: 'D3', from: 1, rev: 2 },
    { id: 'D4', from: 2, rev: 3 },
  ])
  expect(note.added).toEqual(['D9'])
  expect(note.dropped).toEqual(['D7'])
  expect(changeSummary(note)).toBe('D3 now rev 2, D4 now rev 3, D9 added, D7 dropped')
  // No front matter: version and date from the file name. Garbage never throws.
  const bare = parseChangeNote('- Changed D2 (Rev 3)\n', '2026-11-01-design-v2.md')
  expect(bare).toEqual({ version: 2, date: '2026-11-01', changed: [{ id: 'D2', rev: 3 }], added: [], dropped: [] })
  expect(parseChangeNote('}{ not a note', 'x.md')).toEqual({ version: undefined, date: '', changed: [], added: [], dropped: [] })
  expect(parseChangeNote(undefined).changed).toEqual([])
  // The History line carries the summary for redesign notes whose text was read.
  const h = historyOf(['2026-11-10-design-v3.md', '2026-11-12-replan.md'], {
    '2026-11-10-design-v3.md': '## Changes\n- Changed D3 (Rev 1 → 2): x\n',
    '2026-11-12-replan.md': '- Changed D1 (Rev 1 → 9)',
  })
  expect(h.map(e => [e.label, e.sections])).toEqual([
    ['Replan', ''],
    ['Design v3', 'D3 now rev 2'],
  ])
})

// ---------- Replan review and apply (0016) ----------

const T16_DESIGN = `---
design: Salon
version: 3
status: approved
updated: 2026-11-12
---
# Salon: design

## D1 · Accounts
Rev: 2
What: sign in with a magic link.

## D2 · Booking
Rev: 1
What: book a slot.

## D3 · Reminders
Rev: 2
What: mail and SMS reminders.

## D4 · Waitlist
Rev: 1
What: a full slot offers the waitlist.

## D5 · ~~Remote workers~~
Status: dropped in v3
`

const T16_PLAN = `---
plan: Salon
design-version: 2
updated: 2026-11-10
---
# Salon: plan

## P1 · Foundations
Goal: people can book.
Appetite: 2 weeks
Exit: a booking shows.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Accounts | S | — | D1 | sign in works | 0001 |
| P1.2 | Booking | M | P1.1 | D2 | a slot is booked | 0002 |
| P1.3 | Reminders | S | P1.2 | D3 | reminder sent | — |

## P2 · Extras
Goal: more.
Appetite: 1 week
Exit: extras ship.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Remote workers | M | — | D5 | workers run remotely | — |
`

const t16Proposal = (hash: string) => `---
change: replan
date: 2026-11-12
design-version: 3
plan-hash: ${hash}
---
# Replan for design v3

## Why
Design v3 adds D4, changes D1 and D3 and drops D5.

## Add
- [ ] | P2.2 | Waitlist | S | P1.2 | D4 | a full slot offers the waitlist |
  D4 is new in v3 and no build covers it.

## Change
- [ ] | P1.3 | Reminders | M | P1.2 | D3 | a reminder mail and an SMS go out |
  D3 rev 2 adds SMS, so the build grows.

## Drop
- [ ] P2.1 · Remote workers
  Reason: it only covers D5, dropped in v3.

## Follow-up
- [ ] P1.1 · Sign in with a magic link
  P1.1 is done (0001); D1 rev 2 adds magic links, so a new ticket does it.
- [ ] Update README/docs for design v3: Reminders
  README describes reminders.
`

test('replan proposal: groups, reasons, rows, builds and states; old headings and bad items', () => {
  const p = parseProposal(t16Proposal('0badc0de'), '2026-11-12-replan.md')
  expect(p.designVersion).toBe(3)
  expect(p.date).toBe('2026-11-12')
  expect(p.planHash).toBe('0badc0de')
  expect(p.hasGroups).toBe(true)
  expect(p.items.map(i => [i.index, i.group, i.state, i.build ?? '', i.title])).toEqual([
    [0, 'add', 'open', 'P2.2', 'P2.2 · Waitlist'],
    [1, 'change', 'open', 'P1.3', 'P1.3 · Reminders'],
    [2, 'drop', 'open', 'P2.1', 'P2.1 · Remote workers'],
    [3, 'follow-up', 'open', 'P1.1', 'Sign in with a magic link'],
    [4, 'follow-up', 'open', '', 'Update README/docs for design v3: Reminders'],
  ])
  expect(p.items[0]!.row).toEqual({ id: 'P2.2', name: 'Waitlist', size: 'S', needs: 'P1.2', covers: 'D4', doneWhen: 'a full slot offers the waitlist' })
  expect(p.items[0]!.reason).toBe('D4 is new in v3 and no build covers it.')
  expect(p.items[2]!.reason).toBe('it only covers D5, dropped in v3.')
  expect(p.items.every(i => i.problem === '')).toBe(true)
  // The planner's older layout (### headings under ## Changes), applied and dismissed boxes, `- none`, broken items.
  const old = parseProposal(
    '# Replan\n\n## Changes\n### Add build\n- [x] | P3.1 | X | S | — | D9 | x |\n### Change build\n- none\n### Drop build\n- [-] P2.2 · Gone\n- [ ] no id here\n### Follow-up ticket\n- [ ] | not | a row\n\n## Notes\n- [ ] not an item\n',
  )
  expect(old.items.map(i => [i.group, i.state])).toEqual([
    ['add', 'applied'],
    ['drop', 'dismissed'],
    ['drop', 'open'],
    ['follow-up', 'open'],
  ])
  expect(old.items[2]!.problem).toContain('name the build')
  expect(parseProposal('| not | a row |').hasGroups).toBe(false)
  expect(parseProposal('## Add\n- [ ] P2.3 · no row\n').items[0]!.problem).toContain('table row')
  // Garbage and missing text never throw.
  expect(parseProposal('}{').items).toEqual([])
  expect(parseProposal(undefined).hasGroups).toBe(false)
})

test('plan hash: stable, line-ending blind, changes with any edit', () => {
  expect(planHash(T16_PLAN)).toMatch(/^[0-9a-f]{8}$/)
  expect(planHash(T16_PLAN)).toBe(planHash(T16_PLAN.replace(/\n/g, '\r\n')))
  expect(planHash(T16_PLAN)).not.toBe(planHash(T16_PLAN.replace('reminder sent', 'reminder sent!')))
})

test('replan apply (milestone): Add row, Change edit, Drop as Status dropped, design-version; unticked items unchanged', () => {
  const p = parseProposal(t16Proposal(planHash(T16_PLAN)))
  // Tick Add, Change, Drop and the follow-up on the done build; leave the docs follow-up.
  const r = applyProposal(T16_PLAN, p, [0, 1, 2, 3], 3, '2026-11-12')
  expect(r.applied).toEqual([0, 1, 2, 3])
  expect(r.skipped).toEqual([])
  expect(r.added).toEqual(['P2.2'])
  expect(r.followUps).toEqual([{ index: 3, build: 'P1.1', title: 'Sign in with a magic link', reason: 'P1.1 is done (0001); D1 rev 2 adds magic links, so a new ticket does it.' }])
  const md = r.md
  expect(md).toContain('design-version: 3\n')
  expect(md).toContain('updated: 2026-11-12\n')
  // Change: the row's cells, Ticket kept.
  expect(md).toContain('| P1.3 | Reminders | M | P1.2 | D3 | a reminder mail and an SMS go out | — |')
  // Drop: a Status column is added to that table; the row stays.
  expect(md).toContain('| # | Build | Size | Needs | Covers | Done when | Ticket | Status |\n|---|---|---|---|---|---|---|---|\n')
  expect(md).toContain('| P2.1 | Remote workers | M | — | D5 | workers run remotely | — | dropped |')
  // Add: at the end of P2's table.
  expect(md).toContain('| P2.2 | Waitlist | S | P1.2 | D4 | a full slot offers the waitlist | — | |')
  // The P1 rows with tickets are as they were (done 0001, in-progress 0002).
  expect(md).toContain('| P1.1 | Accounts | S | — | D1 | sign in works | 0001 |\n| P1.2 | Booking | M | P1.1 | D2 | a slot is booked | 0002 |')
  const plan = parsePlan(md)
  expect(plan.designVersion).toBe(3)
  expect(plan.warnings).toEqual([])
  const b = (id: string) => plan.phases.flatMap(x => x.builds).find(x => x.id === id)!
  expect(b('P2.1').status).toBe('dropped')
  expect(b('P2.2').phase).toBe('P2')
  expect(b('P1.3').size).toBe('M')
  // The proposal marks what was applied; the unticked item stays open.
  const marked = parseProposal(markProposal(t16Proposal(planHash(T16_PLAN)), p, new Map(r.applied.map(i => [i, 'applied' as const])), planHash(md)))
  expect(marked.items.map(i => i.state)).toEqual(['applied', 'applied', 'applied', 'applied', 'open'])
  expect(marked.planHash).toBe(planHash(md))
})

test('replan apply: nothing ticked is a no-op; Drop keeps an existing Status column; unknown builds are skipped', () => {
  const p = parseProposal(t16Proposal(planHash(T16_PLAN)))
  const none = applyProposal(T16_PLAN, p, [], 3, '2026-11-12')
  expect(none.md).toBe(T16_PLAN)
  expect(none.applied).toEqual([])
  // Already applied items are never applied again.
  const done = parseProposal(t16Proposal('x').replace('- [ ] | P2.2', '- [x] | P2.2'))
  expect(applyProposal(T16_PLAN, done, [0], 3, '2026-11-12').md).toBe(T16_PLAN)
  const withStatus = T16_PLAN.replace(/(\| P2\.1 .*\| — \|)\n/, '$1 |\n').replace('## P2 · Extras\nGoal: more.\nAppetite: 1 week\nExit: extras ship.\n\n| # | Build | Size | Needs | Covers | Done when | Ticket |\n|---|---|---|---|---|---|---|', '## P2 · Extras\n\n| # | Build | Size | Needs | Covers | Done when | Ticket | Status |\n|---|---|---|---|---|---|---|---|')
  const r = applyProposal(withStatus, p, [2], 3, '')
  expect(r.md).toContain('| P2.1 | Remote workers | M | — | D5 | workers run remotely | — | dropped |')
  const odd = parseProposal('## Change\n- [ ] | P9.9 | Ghost | S | — | D1 | x |\n## Add\n- [ ] | P7.1 | No phase | S | — | D1 | x |\n- [ ] | P1.1 | Twice | S | — | D1 | x |\n')
  const s = applyProposal(T16_PLAN, odd, [0, 1, 2], 3, '2026-11-12')
  expect(s.md).toBe(T16_PLAN)
  expect(s.skipped.map(x => x.why)).toEqual(['P9.9: not in PLAN.md', 'P7.1: PLAN.md has no build table for phase P7', 'P1.1: already in PLAN.md'])
})

test('docs follow-up: one "Update README/docs" item in the proposal and one line in the change note', () => {
  const design = parseDesign(T16_DESIGN)
  const note = parseChangeNote('## Changes\n- Changed D3 (Rev 1 → 2): SMS too\n- Added D4 · Waitlist\n- Dropped D5 · Remote workers\n', '2026-11-12-design-v3.md')
  const readme = '# Salon\n\nBook a chair. Reminders go out by mail a day before.\n'
  const text = docsFollowUp(readme, design, [note])
  expect(text).toBe('Update README/docs for design v3: Reminders')
  // README mentions none of the changed sections: no follow-up.
  expect(docsFollowUp('# Salon\n\nBook a chair.\n', design, [note])).toBeUndefined()
  expect(docsFollowUp(undefined, design, [note])).toBeUndefined()
  const bare = t16Proposal('x').replace(/- \[ \] Update README[^\n]*\n[^\n]*\n/, '')
  const once = withDocsItem(bare, text!, 'README describes behaviour this redesign changes.')
  const items = parseProposal(once).items.filter(i => /Update README\/docs/.test(i.text))
  expect(items.length).toBe(1)
  expect(items[0]!.group).toBe('follow-up')
  expect(items[0]!.reason).toBe('README describes behaviour this redesign changes.')
  expect(withDocsItem(once, text!, 'again')).toBe(once)
  // `- none` under Follow-up is replaced; no Follow-up heading gets one.
  expect(withDocsItem('## Add\n- none\n\n## Follow-up\n- none\n', text!, 'r')).toBe(`## Add\n- none\n\n## Follow-up\n- [ ] ${text}\n  r\n`)
  expect(parseProposal(withDocsItem('## Add\n- none\n', text!, 'r')).items.map(i => i.group)).toEqual(['follow-up'])
  // The change note lists it once under Follow-ups.
  const noteMd = '---\nchange: design-v3\n---\n# Design v3\n\n## Changes\n- Changed D3 (Rev 1 → 2): SMS\n\n## Follow-ups\n- Replan: P1.3\n'
  const listed = withNoteFollowUp(noteMd, text!)
  expect(listed).toBe(`---\nchange: design-v3\n---\n# Design v3\n\n## Changes\n- Changed D3 (Rev 1 → 2): SMS\n\n## Follow-ups\n- Replan: P1.3\n- ${text}\n`)
  expect(withNoteFollowUp(listed, text!)).toBe(listed)
  expect(withNoteFollowUp('# Design v3\n', text!)).toBe(`# Design v3\n\n## Follow-ups\n- ${text}\n`)
})

// ---------- Adopt existing docs and the demo roadmap (0009) ----------

/** The demo's roadmap as the board computes it: every ticket's row status and rd.md. */
function demoRoadmap() {
  const board = parseBoard(DEMO_ROADMAP['tickets/BOARD.md']!)!
  const rdOf = (n: string) => Object.entries(DEMO_ROADMAP).find(([k]) => k.startsWith(`tickets/${n}-`) && k.endsWith('/rd.md'))?.[1]
  const refs = board.rows.map(r => ticketRef(r, rdOf(r.number)))
  const b = bindFromBoard(DEMO_ROADMAP['tickets/BOARD.md'], p => DEMO_ROADMAP[p])
  return { board, b, rm: roadmap(b.design, b.plan, refs), rdOf }
}

test('demo roadmap: everything parses with no warnings beyond the intended alerts', () => {
  const { board, b, rm, rdOf } = demoRoadmap()
  expect(b.isBound).toBe(true)
  expect(b.designPath).toBe('design/DESIGN.md')
  expect(b.planPath).toBe('design/PLAN.md')
  expect(b.warnings).toEqual([])
  expect(rm.design.warnings).toEqual([])
  expect(rm.plan.warnings).toEqual([])
  // 6+ tickets in mixed statuses, each with its folder.
  expect(board.rows.length).toBeGreaterThanOrEqual(6)
  expect(new Set(board.rows.map(r => r.status)).size).toBeGreaterThanOrEqual(5)
  for (const r of board.rows) {
    expect(rdOf(r.number)).toBeDefined()
    expect(Object.keys(DEMO_ROADMAP).some(k => k.startsWith(`tickets/${r.number}-`) && k.endsWith('/eval.md'))).toBe(true)
  }
  // Design: several sections, approved, one stale (D3 now Rev 2), one dropped.
  expect(rm.design.status).toBe('approved')
  expect(rm.design.sections.length).toBeGreaterThanOrEqual(5)
  expect(rm.design.sections.filter(s => s.isDropped).map(s => s.id)).toEqual(['D5'])
  // Plan: 3 phases, S/M/L sizes, Covers and Ticket cells.
  expect(rm.plan.phases.map(p => p.id)).toEqual(['P1', 'P2', 'P3'])
  const builds = rm.plan.phases.flatMap(p => p.builds)
  expect(new Set(builds.map(x => x.size))).toEqual(new Set(['S', 'M', 'L']))
  expect(builds.every(x => x.covers.length > 0)).toBe(true)
  expect(builds.filter(x => x.tickets.length > 0).length).toBe(5)
  // One change note, read as design v2.
  const notes = Object.keys(DEMO_ROADMAP).filter(k => k.startsWith('design/changes/'))
  expect(notes).toEqual(['design/changes/2026-11-02-design-v2.md'])
  const note = parseChangeNote(DEMO_ROADMAP[notes[0]!], '2026-11-02-design-v2.md')
  expect(note.version).toBe(2)
  expect(note.changed.map(c => c.id)).toEqual(['D3'])
  expect(note.dropped).toEqual(['D5'])
  // Every ticket has a Type line; the plan tickets have Plan: and Design:.
  for (const r of board.rows) expect(rdOf(r.number)).toMatch(/^Type: (feature|bug)$/m)
  expect(board.rows.filter(r => /^Plan: /m.test(rdOf(r.number)!) && /^Design: /m.test(rdOf(r.number)!)).length).toBe(5)
})

test('demo roadmap: Plan % between 0 and 100, a current phase, the stale and no-ticket alerts, one off-plan ticket', () => {
  const { rm } = demoRoadmap()
  expect(rm.progress.planPct).toBeGreaterThan(0)
  expect(rm.progress.planPct).toBeLessThan(100)
  expect(rm.progress.currentPhase).toBe('P2')
  expect(rm.checks.map(a => a.id).sort()).toEqual(['build-no-ticket', 'off-plan', 'stale-tickets'])
  expect(rm.checks.find(a => a.id === 'build-no-ticket')!.subjects).toEqual(['P3.2'])
  expect(rm.checks.find(a => a.id === 'stale-tickets')!.subjects).toEqual(['0003'])
  expect(rm.links.stale).toEqual([{ ticket: '0003', section: 'D3', rev: 1, now: 2 }])
  expect(rm.links.offPlan.map(t => t.number)).toEqual(['0006'])
  expect(rm.links.missing).toEqual([])
  expect(rm.links.mismatched).toEqual([])
})

test('adopt: the proposal reads sources, reasons, both drafts and one item per section, phase and build', () => {
  const p = parseAdopt(adoptProposal('2026-11-10'), '2026-11-10-adopt.md')
  expect(p.date).toBe('2026-11-10')
  expect(p.isApplied).toBe(false)
  expect(p.warnings).toEqual([])
  expect(p.sources).toEqual([
    { path: 'notes/salon.md', text: 'D1, D2, D3, P1, P1.1, P1.2, P2, P2.1', isLeftOut: false },
    { path: 'notes/old-standup.md', text: 'left out (meeting notes with nothing to build)', isLeftOut: true },
  ])
  expect(p.items.map(i => `${i.kind}:${i.id}`)).toEqual(['section:D1', 'section:D2', 'section:D3', 'phase:P1', 'build:P1.1', 'build:P1.2', 'phase:P2', 'build:P2.1'])
  expect(p.items.find(i => i.id === 'D1')!.reason).toBe('"Accounts (D1)" in notes/salon.md, id kept')
  expect(p.items.find(i => i.id === 'D3')!.detail).toBe('Clients book a free slot. · 1 open question')
  expect(p.items.find(i => i.id === 'P1.2')!.detail).toBe('M · needs P1.1 · covers D2, D3')
  expect(p.design).toContain('## D3 · Booking')
  expect(p.plan).toContain('| P2.1 | Waitlist |')
  // Missing or broken drafts are warnings, never a throw.
  expect(parseAdopt('# nothing').warnings).toEqual(['no ## DESIGN.md or ## PLAN.md draft'])
  expect(parseAdopt('## DESIGN.md\n\nno fence\n').warnings).toEqual(['the DESIGN.md draft is not in a fenced block'])
  expect(parseAdopt(undefined).items).toEqual([])
  expect(parseAdopt(`---\napplied: 2026-11-10\n---\n${adoptProposal('2026-11-10')}`).isApplied).toBe(true)
})

test('adopt: Apply leaves out the unticked items, keeps every other id and writes a version 1 draft', () => {
  const p = parseAdopt(adoptProposal('2026-11-01'))
  const all = adoptResult(p, new Set(), '2026-11-10')
  expect([all.sections, all.phases, all.builds]).toEqual([3, 2, 3])
  const d = parseDesign(all.design)
  expect([d.status, d.version, d.updated, d.name]).toEqual(['draft', 1, '2026-11-10', 'Salon'])
  expect(parsePlan(all.plan).designVersion).toBe(1)
  // Untick D2: the section goes, D3 stays D3 (never renumbered), D2 leaves P1.2's Covers.
  const r = adoptResult(p, new Set(['D2']), '2026-11-10')
  expect(parseDesign(r.design).sections.map(s => s.id)).toEqual(['D1', 'D3'])
  expect(r.design).not.toContain('Salon page')
  expect(r.design).toContain('## Vision')
  expect(r.plan).toContain('| P1.2 | Book a slot | M | P1.1 | D3 | a free slot is booked | — |')
  // Untick phase P2: its build goes with it; untick P1.1: P1.2 no longer needs it.
  expect([...adoptLeftOut(p, new Set(['P2']))].sort()).toEqual(['P2', 'P2.1'])
  const r2 = adoptResult(p, new Set(['P2', 'P1.1']), '2026-11-10')
  const plan = parsePlan(r2.plan)
  expect(plan.phases.map(x => x.id)).toEqual(['P1'])
  expect(plan.phases[0]!.builds.map(b => b.id)).toEqual(['P1.2'])
  expect(plan.phases[0]!.builds[0]!.needs).toEqual([])
  expect(plan.warnings).toEqual([])
  // A draft without front matter gets one.
  const bare = parseAdopt('## DESIGN.md\n~~~\n# X\n\n## D4 · Only\nRev: 1\n~~~\n')
  const made = adoptResult({ ...bare, name: 'X' }, new Set(), '2026-11-10').design!
  expect(made.startsWith('---\ndesign: X\nversion: 1\nstatus: draft\nupdated: 2026-11-10\n---\n')).toBe(true)
  expect(parseDesign(made).sections.map(s => s.id)).toEqual(['D4'])
})

test('adopt: the binding line goes under the BOARD.md title, or replaces the one there', () => {
  const board = '# Ticket board\n\nIntro.\n\n| # | Ticket | Status |\n|---|---|---|\n'
  const bound = setBindingLine(board, 'design/DESIGN.md', 'design/PLAN.md')
  expect(bound).toBe('# Ticket board\n\nDesign: design/DESIGN.md · Plan: design/PLAN.md\n\nIntro.\n\n| # | Ticket | Status |\n|---|---|---|\n')
  expect(setBindingLine(bound, 'design/DESIGN-adopted.md', 'design/PLAN.md')).toBe(bound.replace('design/DESIGN.md', 'design/DESIGN-adopted.md'))
  expect(setBindingLine('# T\nIntro\n', 'd.md', undefined)).toBe('# T\n\nDesign: d.md\n\nIntro\n')
  expect(setBindingLine(board, undefined, undefined)).toBe(board)
})

test('binding: a half binding line keeps the default for the other half', () => {
  const files = (map: Record<string, string>) => (p: string) => map[p]
  const both = { 'design/DESIGN.md': '# D\n', 'design/PLAN.md': '# P\n' }
  // Design-only line (what adopt writes with no plan draft), then design/PLAN.md appears.
  const designOnly = setBindingLine('# Ticket board\n', 'design/DESIGN.md', undefined)
  const b1 = bindFromBoard(designOnly, files(both))
  expect(b1).toEqual(expect.objectContaining({ designPath: 'design/DESIGN.md', planPath: 'design/PLAN.md', plan: '# P\n', isBound: true, warnings: [] }))
  // Plan-only line: design/DESIGN.md is bound when it exists, unbound (no warning) when it does not.
  const planOnly = '# Ticket board\n\nPlan: design/factory/plan.md\n'
  const b2 = bindFromBoard(planOnly, files({ 'design/factory/plan.md': '# F\n', 'design/design.md': '# D\n' }))
  expect(b2).toEqual(expect.objectContaining({ designPath: 'design/design.md', planPath: 'design/factory/plan.md', warnings: [] }))
  const b3 = bindFromBoard(planOnly, files({ 'design/factory/plan.md': '# F\n' }))
  expect(b3).toEqual(expect.objectContaining({ designPath: undefined, design: undefined, planPath: 'design/factory/plan.md', warnings: [] }))
  // Both halves named: the defaults are never used, and a missing named file is still a warning.
  const b4 = bindFromBoard('# B\n\nDesign: x/d.md · Plan: x/p.md\n', files(both))
  expect(b4).toEqual(expect.objectContaining({ designPath: undefined, planPath: undefined, isBlank: true }))
  expect(b4.warnings.length).toBe(2)
})

test('adopt: paths must be inside the project; empty input is an error', () => {
  expect(adoptPaths('', '/repo').error).toBe('Type one or more file or folder paths inside the project')
  expect(adoptPaths(' , \n', '/repo').error).toBe('Type one or more file or folder paths inside the project')
  expect(adoptPaths('/etc/passwd', '/repo').error).toBe('/etc/passwd is outside the project')
  expect(adoptPaths('../other/notes.md', '/repo').error).toBe('../other/notes.md is outside the project')
  expect(adoptPaths('~/notes.md', '/repo').error).toBe('~/notes.md is outside the project')
  expect(adoptPaths('/repo-old/x.md', '/repo').error).toBe('/repo-old/x.md is outside the project')
  expect(adoptPaths('notes/salon.md, ./docs/\n/repo/specs/a.md\n`notes/salon.md`', '/repo')).toEqual({ paths: ['notes/salon.md', 'docs', 'specs/a.md'] })
  expect(adoptPaths('docs/../notes.md', '/repo/')).toEqual({ paths: ['notes.md'] })
  expect(ADOPT_NOTES).toContain('(D1)')
})

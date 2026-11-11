import { expect, test, type TestBody } from 'claude-code/testing'

import { parseBoard } from '../hooks/core/board'
import { roadmap, ticketRef } from '../hooks/core/roadmap'
import { boardCols } from '../hooks/desk'
import { railSvg } from '../hooks/glass'
import { runLine } from '../hooks/core/query'
import { PLAN_COLS } from '../hooks/plan'

const BOARD = `# Ticket board

| #    | Ticket                        | Status | Mode | Blocked by | Owner   | Notes |
|------|-------------------------------|--------|------|------------|---------|-------|
| 0001 | Health endpoint               | done   | solo | —          | —       | merged |
| 0002 | CSV export of the orders list | ready  | solo | 0001       | —       | |
| 0003 | Dark mode for settings page   | draft  | solo | —          | —       | AI draft done · 1 open question |

Status flow: draft → ready → in-progress → in-check → done
`

const rd = (n: string, title: string, questions: string) => `# ${n} — ${title}

## What

Something useful.

## Behaviour

- It works.

## Scope

In:
- this

## Touchpoints

- src/x.ts — here

## Open questions

${questions}
`

const EVAL = `# Eval

## Checks

1. Tests pass
   - Run: \`npm test\`
   - Pass: exit 0

## Not checked by automation

- none
`

function fakeFs() {
  const files = new Map<string, string>([
    ['tickets/BOARD.md', BOARD],
    ['tickets/0001-health-endpoint/rd.md', rd('0001', 'Health endpoint', '- Which port should it listen on?')],
    ['tickets/0001-health-endpoint/eval.md', EVAL],
    ['tickets/0002-csv-export-of-the-orders-list/rd.md', rd('0002', 'CSV export of the orders list', '- none')],
    ['tickets/0002-csv-export-of-the-orders-list/eval.md', EVAL],
    ['tickets/0003-dark-mode-for-settings-page/rd.md', rd('0003', 'Dark mode for settings page', '- Which accent colour in dark mode?')],
    ['tickets/0003-dark-mode-for-settings-page/eval.md', EVAL],
  ])
  const mtimes = new Map<string, number>()
  let tick = 1
  // The engine hands hooks absolute paths; keep the part from tickets/ on.
  const clean = (p: string) => {
    const t = p.replace(/\/$/, '')
    const i = t.search(/(^|\/)tickets(\/|$)/)
    return i < 0 ? t : t.slice(t[i] === '/' ? i + 1 : i)
  }
  const list = (path: string) => {
    const base = clean(path)
    const names = new Map<string, 'file' | 'dir'>()
    for (const f of files.keys()) {
      if (!f.startsWith(`${base}/`)) continue
      const rest = f.slice(base.length + 1).split('/')
      names.set(rest[0]!, rest.length > 1 ? 'dir' : 'file')
    }
    return [...names].map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: kind === 'dir' ? 0 : (mtimes.get(`${base}/${name}`) ?? 1), isLink: false }))
  }
  return { files, clean, list, mtimes, tick: { n: tick } }
}

let AGENTS_OVERRIDE: any[] | undefined
let AGENTS_DENIED = false

const PANE = {
  plugin: 'ticket-board',
  component: 'Pane',
  requestId: 'ticket-board',
  props: { title: 'Tickets', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// `gate.wait`, while set, holds every fs.list: a refresh stays in flight until the test lets it go.
// `manifest`, when set, is what the plugin reads as its own .claude-plugin/plugin.json; left out, that read fails.
type BootOptions = { cwd?: string; blank?: boolean; store?: Map<string, unknown>; dirs?: string[]; gate?: { wait?: Promise<void> }; manifest?: string }

async function boot($: Parameters<TestBody>[0], on: any, surface: 'terminal' | 'desktop', extra: Record<string, string> = {}, opts: BootOptions = {}) {
  const fs = fakeFs()
  if (opts.blank === true) fs.files.clear()
  for (const [k, v] of Object.entries(extra)) fs.files.set(k, v)
  const filled: string[] = []
  const calls: string[] = []
  const writes: string[] = []
  const opened: string[] = []
  const dirs = new Set(opts.dirs ?? [])
  const store = opts.store ?? new Map<string, unknown>()
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'board' } }))
  on('ui.open', (_: unknown, e: { id: string }) => (opened.push(e.id), { value: { isPlaced: true } }))
  on('clock.every', () => ({ deny: 'no timers in tests' }))
  on('agent.list', () => AGENTS_DENIED ? { deny: 'agent.list is not available here' } : ({ value: AGENTS_OVERRIDE ?? [
    { id: 'a1', description: 'Build ticket 0002', type: 'worker', status: 'running', name: 'worker-0002' },
    { id: 'a2', description: 'Check 0001', type: 'checker', status: 'completed' },
  ] }))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => (store.set(e.key, e.value), { value: undefined }))
  on('fs.list', async (_: unknown, e: { path: string }) => {
    if (opts.gate?.wait !== undefined) await opts.gate.wait
    calls.push(`list ${e.path} -> ${fs.list(e.path).map(x => x.name).join(',')}`)
    return { value: fs.list(e.path) }
  })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: dirs.has(fs.clean(e.path)) || fs.files.has(fs.clean(e.path)) || fs.list(e.path).length > 0 }))
  on('fs.read', (_: unknown, e: { path: string }) => {
    // The plugin's own templates, for Set up board.
    const template = /\/templates\/BOARD\.md$/.test(e.path) ? BLANK_BOARD : /\/skills\/ticket\/TEMPLATE\/(rd|eval)\.md$/.test(e.path) ? '# template\n' : undefined
    const manifest = /\/\.claude-plugin\/plugin\.json$/.test(e.path) ? opts.manifest : undefined
    const text = fs.files.get(fs.clean(e.path)) ?? template ?? manifest
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_: unknown, e: { path: string; text: string }) => {
    writes.push(fs.clean(e.path))
    fs.files.set(fs.clean(e.path), e.text)
    fs.mtimes.set(fs.clean(e.path), ++fs.tick.n)
    return { value: undefined }
  })
  on('prompt.fill', (_: unknown, e: { text: string }) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await $.session.start({ cwd: opts.cwd ?? '/repo', surface, isInteractive: true })
  // Auto-open runs in the background: let it settle before reading what opened.
  await new Promise(r => setTimeout(r, 20))
  const openedAtStart = [...opened]
  const ui = await $.ui.mount({ ...PANE, surface } as any)
  return { ui, fs, filled, calls, writes, store, openedAtStart }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`board shows BOARD.md inline with every ticket (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('Health endpoint')
    expect(drawn.toLowerCase()).toContain('status flow')
    await ui.unmount()
  })

  test(`a draft can be answered and marked ready straight from the board (${surface})`, async ($, on) => {
    const { ui, fs } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await ui.press({ key: 'ans-0003' })
    await ui.input({ key: 'q-0003-0', text: 'Teal', kind: 'submit' } as any)
    await ui.press({ key: 'back' })
    await ui.press({ key: 'back' })
    await ui.press({ key: 'rdy-0003' })
    expect(fs.files.get('tickets/BOARD.md')!).toContain('| Dark mode for settings page   | ready  |')
    await ui.unmount()
  })

  test(`answering the last question lets the ticket be marked ready (${surface})`, async ($, on) => {
    const { ui, fs, calls } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await ui.press({ key: 'open-0003' })
    await ui.find({ type: 'Text', text: /open question/ })
    await ui.press({ key: 'questions' })
    await ui.input({ key: 'q-0003-0', text: 'Teal', kind: 'submit' } as any)
    const saved = fs.files.get('tickets/0003-dark-mode-for-settings-page/rd.md')!
    expect(saved).toContain('(human): Teal**')
    await ui.press({ key: 'back' })
    await ui.press({ key: 'ready' })
    expect(fs.files.get('tickets/BOARD.md')!).toContain('| Dark mode for settings page   | ready  |')
    await ui.unmount()
  })

  test(`run this ticket fills the prompt (${surface})`, async ($, on) => {
    const { ui, filled } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    if (surface === 'desktop') await ui.press({ key: 'show-all' })
    else await ui.select({ key: 'show', value: 'all' })
    await ui.press({ key: 'open-0002' })
    await ui.press({ key: 'run' })
    expect(filled).toEqual(['Run ticket 0002.'])
    await ui.unmount()
  })
}

test('desktop draws a glass container with a sortable ticket table', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).not.toContain('#0A0F1E') // follows the app by default: no painted backdrop
  expect(drawn).toContain('DEPENDS ON')
  expect(drawn).toContain('Need you')
  expect(drawn).not.toContain('isInteractive')
  await ui.press({ key: 'sort-title' })
  await ui.press({ key: 'kind-bug' })
  await ui.find({ type: 'Text', text: /No tickets match/ })
  await ui.press({ key: 'clear-empty' })
  await ui.press({ key: 'title-0002' })
  await ui.find({ type: 'Text', text: /PROPERTIES/ })
  await ui.press({ key: 'back' })
  await ui.press({ key: 'new' })
  await ui.find({ type: 'Text', text: /What happens next/ })
  await ui.unmount()
})

test('terminal keeps the plain theme look', async ($, on) => {
  const { ui } = await boot($, on, 'terminal')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).not.toContain('#0A0F1E')
  expect(drawn).not.toContain('DEPENDS ON')
  await ui.unmount()
})

test('desktop board notes join wrapped lines and label decisions', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('BOARD NOTES')
  expect(drawn).toContain('STATUS FLOW')
  await ui.unmount()
})

test('ticket page: sections as cards, no questions once done', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  await ui.press({ key: 'show-all' })
  await ui.press({ key: 'open-0003' })
  let drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('1 OPEN QUESTION')
  expect(drawn).toContain('BEHAVIOUR')
  expect(drawn).not.toContain('# 0003')
  await ui.press({ key: 'back' })
  await ui.press({ key: 'open-0001' })
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Health endpoint')
  expect(drawn).not.toContain('Which port')
  expect(drawn).not.toContain('OPEN QUESTION')
  await ui.unmount()
})

test('agents button shows what is running', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  await ui.press({ key: 'agents' })
  await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('worker-0002')
  expect(drawn).toContain('RECENTLY FINISHED')
  // Activity opens under the row, inside the pane (works where the app can't switch views).
  await ui.press({ key: 'agent-w-a1' })
  await ui.find({ type: 'Text', text: /WHAT WORKER-0002 DID/ })
  await ui.press({ key: 'agent-w-a1' })
  await ui.press({ key: 'agents-hide' })
  await ui.unmount()
})

// ---------- Agents (0012: Agents button did nothing) ----------

/** The node drawn with this key, anywhere in the tree. */
function nodeByKey(tree: unknown, key: string): any {
  if (tree === null || typeof tree !== 'object') return undefined
  const o = tree as any
  if (o.key === key || o.props?.key === key) return o
  for (const v of Object.values(o)) {
    const hit = nodeByKey(v, key)
    if (hit !== undefined) return hit
  }
  return undefined
}
const propsOf = (n: any) => n?.props ?? n

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Agents toggles the panel; pressing again or Hide closes it (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    // The button carries the running count.
    expect(await drawnText(ui)).toContain('● 1')
    expect(await drawnText(ui)).not.toContain('AGENTS · 1 RUNNING')
    await ui.press({ key: 'agents' })
    await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
    let drawn = await drawnText(ui)
    expect(drawn).toContain('worker-0002')
    expect(drawn).toContain('Dark mode for settings page') // still the board, the panel sits on it
    await ui.press({ key: 'agents' })
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('AGENTS · 1 RUNNING')
    expect(drawn).not.toContain('worker-0002')
    await ui.press({ key: 'agents' })
    await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
    await ui.press({ key: 'agents-hide' })
    expect(await drawnText(ui)).not.toContain('AGENTS · 1 RUNNING')
    await ui.unmount()
  })

  test(`Agents opens with resumed (duplicate-id) agents, each listed once (${surface})`, async ($, on) => {
    AGENTS_OVERRIDE = manyAgents()
    try {
      const { ui } = await boot($, on, surface)
      await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
      await ui.press({ key: 'agents' })
      await ui.find({ type: 'Text', text: /AGENTS · 3 RUNNING/ })
      const drawn = await drawnText(ui)
      // 'dup' was listed twice (completed, then running again): one line, the latest status.
      expect(drawn.match(/Build ticket 0001/g)?.length).toBe(1)
      if (surface === 'desktop') expect(drawn.match(/"key":"agent-dup"/g)?.length).toBe(1)
      const keys = [...drawn.matchAll(/"key":"([^"]+)"/g)].map(m => m[1]!)
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
      await ui.press({ key: 'agents-hide' })
      await ui.unmount()
    } finally {
      AGENTS_OVERRIDE = undefined
    }
  })

  test(`Agents opens an empty panel, no error, when agent.list is unavailable (${surface})`, async ($, on) => {
    AGENTS_DENIED = true
    try {
      const { ui } = await boot($, on, surface)
      await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
      await ui.press({ key: 'agents' })
      await ui.find({ type: 'Text', text: /AGENTS · 0 RUNNING/ })
      await ui.find({ type: 'Text', text: /No agents running in this session right now\./ })
      expect(await drawnText(ui)).not.toMatch(/agent\.list is not available/)
      await ui.unmount()
    } finally {
      AGENTS_DENIED = false
    }
  })

  test(`Agents opens the panel in a linked worktree session (${surface})`, async ($, on) => {
    const { ui, calls } = await boot($, on, surface, {
      '/repo/.git': 'gitdir: /main/.git/worktrees/w1\n',
      '/main/.git/worktrees/w1/HEAD': 'ref: refs/heads/ticket/0016\n',
      '/main/.git/worktrees/w1/commondir': '../..\n',
    })
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    expect(calls.some(c => c.startsWith('list /main/tickets'))).toBe(true)
    await ui.press({ key: 'agents' })
    await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
    expect(await drawnText(ui)).toContain('worker-0002')
    await ui.unmount()
  })
}

test('Show agents in the activity strip returns to the board and opens the panel (desktop)', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  await ui.press({ key: 'show-all' })
  await ui.press({ key: 'open-0002' })
  await ui.find({ type: 'Text', text: /PROPERTIES/ })
  await ui.press({ key: 'activity-agents' })
  await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
  const drawn = await drawnText(ui)
  expect(drawn).not.toContain('PROPERTIES')
  expect(drawn).not.toContain('"key":"activity-agents"') // hidden while the panel is open
  await ui.unmount()
})

test('desktop title bar: the Agents / + New ticket buttons cannot be squeezed by the text beside them', async ($, on) => {
  // A long board path is what used to push into the button group (0.4.11 fixed the same thing for the project bar).
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  const tree = await ui.drawn()
  const buttons = propsOf(nodeByKey(tree, 'title-buttons'))
  const text = propsOf(nodeByKey(tree, 'title-text'))
  expect(buttons?.flexShrink).toBe(0)
  expect(text?.flexShrink).toBe(1)
  expect(text?.minWidth).toBe(0)
  const group = JSON.stringify(nodeByKey(tree, 'title-buttons'))
  expect(group).toContain('"agents"')
  expect(group).toContain('"new"')
  expect(JSON.stringify(nodeByKey(tree, 'title-text'))).toContain('"wrap":"truncate"')
  // Same for Show agents beside the activity text.
  expect(propsOf(nodeByKey(tree, 'activity-agents-box'))?.flexShrink).toBe(0)
  await ui.unmount()
})

test('a new session starts with the Agents panel closed and no agents from the last one', async ($, on) => {
  const first = await boot($, on, 'desktop')
  await first.ui.find({ type: 'Text', text: /Dark mode/ })
  await first.ui.press({ key: 'agents' })
  await first.ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
  await first.ui.unmount()
  AGENTS_DENIED = true
  try {
    await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true } as any)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' } as any)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    const drawn = await drawnText(ui)
    expect(drawn).not.toContain('AGENTS · 1 RUNNING')
    expect(drawn).not.toContain('worker-0002')
    await ui.press({ key: 'agents' })
    await ui.find({ type: 'Text', text: /No agents running in this session right now\./ })
    await ui.unmount()
  } finally {
    AGENTS_DENIED = false
  }
})

test('activity strip animates while the session works', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  await ui.find({ type: 'Text', text: /1 agent running/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('animateTransform')
  expect(drawn).not.toContain('isInteractive')
  await ui.press({ key: 'activity-agents' })
  await ui.find({ type: 'Text', text: /AGENTS · 1 RUNNING/ })
  await ui.unmount()
})

const PROJECT_FILES = {
  '/repo/.git/config': '[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:acme/shop-app.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
  '/repo/.git/HEAD': 'ref: refs/heads/feature/csv\n',
  '/repo/README.md': '# Acme Shop\n\nThe storefront.\n\n## Install\n\nRun `npm i`.\n',
}

// The desktop app can start a session in a spare folder and move it to the project after
// session.start ran: the board follows the session's folder instead of keeping the first one.
test('board follows the session when it moves from a spare folder to the project (desktop)', async ($, on) => {
  let where = '/Users/me/.claude/spares/spare-AbCd'
  on('session.cwd', () => ({ value: where }))
  const { ui } = await boot($, on, 'desktop', PROJECT_FILES, { cwd: where })
  await ui.find({ type: 'Text', text: /Dark mode/ })
  let drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('spare-AbCd')
  expect(drawn).toContain('not a git repository')
  where = '/repo'
  await $.command.run({ command: 'board', args: '' } as any)
  await ui.find({ type: 'Text', text: /acme\/shop-app/ })
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Acme Shop')
  expect(drawn).toContain('feature/csv')
  expect(drawn).not.toContain('not a git repository')
  await ui.unmount()
})

test('desktop header names the project and repo, and opens the README', async ($, on) => {
  const { ui, filled } = await boot($, on, 'desktop', PROJECT_FILES)
  await ui.find({ type: 'Text', text: /Dark mode/ })
  let drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Acme Shop')
  expect(drawn).toContain('acme/shop-app')
  expect(drawn).toContain('feature/csv')
  await ui.press({ key: 'readme' })
  await ui.find({ type: 'Text', text: /The storefront/ })
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Install')
  await ui.press({ key: 'readme-update' })
  expect(filled.at(-1)).toContain('Update README.md')
  await ui.press({ key: 'back' })
  await ui.find({ type: 'Text', text: /Dark mode/ })
  await ui.unmount()
})

test('terminal shows the project line and README; no git falls back to the folder name', async ($, on) => {
  const { ui } = await boot($, on, 'terminal')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('repo · not a git repo')
  await ui.press({ key: 'readme' })
  await ui.find({ type: 'Text', text: /no README.md yet/ })
  await ui.unmount()
})

// ---------- README (0011: README button did nothing) ----------

/** Every Button in the drawing that answers the `o` key: more than one would fire on one press. */
const oButtons = async (ui: any) => (await ui.findAll({ type: 'Button' })).filter((b: any) => b.props.hotkey === 'o')

/** Opens a view from the board: a ticket, its questions, or the new-ticket form. */
async function openFromBoard(ui: any, surface: 'terminal' | 'desktop', view: 'board' | 'ticket' | 'questions' | 'new') {
  if (view === 'ticket') {
    if (surface === 'desktop') await ui.press({ key: 'show-all' })
    await ui.press({ key: 'open-0002' })
    await ui.find({ type: 'Text', text: /CSV export/ })
  } else if (view === 'questions') {
    await ui.press({ key: 'ans-0003' })
    await ui.find({ type: 'Text', text: /Which accent colour/ })
  } else if (view === 'new') {
    await ui.press({ key: 'new' })
    await ui.find({ key: 'create-ai' } as any)
  }
}

for (const surface of ['terminal', 'desktop'] as const) {
  for (const from of ['board', 'ticket', 'questions', 'new'] as const) {
    test(`README opens from the ${from} and toggles back to the board (${surface})`, async ($, on) => {
      const { ui } = await boot($, on, surface, PROJECT_FILES)
      await ui.find({ type: 'Text', text: /Dark mode/ })
      await openFromBoard(ui, surface, from)
      // The `o` hotkey presses this Button, and only this one: two on one key would open then close.
      const before = await oButtons(ui)
      expect(before.map((b: any) => b.key)).toEqual(['readme'])
      expect(before[0].props.label).toBe('README')
      await ui.press({ key: 'readme' })
      await ui.find({ type: 'Text', text: /The storefront/ })
      let drawn = await drawnText(ui)
      expect(drawn).not.toContain('Dark mode')
      // Still one `o` Button in the README view, now reading ‹ Board: pressing it again goes back.
      const inReadme = await oButtons(ui)
      expect(inReadme.map((b: any) => b.key)).toEqual(['readme'])
      expect(inReadme[0].props.label).toBe('‹ Board')
      await ui.press({ key: 'readme' })
      await ui.find({ type: 'Text', text: /Dark mode/ })
      drawn = await drawnText(ui)
      expect(drawn).not.toContain('The storefront')
      // The README view's own back button works too.
      await ui.press({ key: 'readme' })
      await ui.find({ type: 'Text', text: /The storefront/ })
      await ui.press({ key: 'back' })
      await ui.find({ type: 'Text', text: /Dark mode/ })
      expect(await drawnText(ui)).not.toContain('The storefront')
      await ui.unmount()
    })
  }

  test(`one README press switches the view once, also after a redraw (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, PROJECT_FILES)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await ui.press({ key: 'readme' })
    await ui.redraw()
    await new Promise(r => setTimeout(r, 20))
    const drawn = await drawnText(ui)
    expect(drawn).toContain('The storefront')
    expect(drawn).not.toContain('Dark mode')
    await ui.unmount()
  })

  test(`README opens while a refresh is still running (${surface})`, async ($, on) => {
    const gate: { wait?: Promise<void> } = {}
    const { ui } = await boot($, on, surface, PROJECT_FILES, { gate })
    await ui.find({ type: 'Text', text: /Dark mode/ })
    let release = () => undefined as void
    gate.wait = new Promise<void>(r => (release = r))
    // A refresh that cannot finish until the gate opens (the board's ↻ / Refresh button).
    const busy = ui.press({ key: 'refresh' })
    await new Promise(r => setTimeout(r, 20))
    const opened = ui.press({ key: 'readme' })
    const seen = await Promise.race([opened.then(() => 'settled'), new Promise(r => setTimeout(() => r('pending'), 200))])
    // The switch is drawn without waiting for the stuck refresh.
    const drawn = await drawnText(ui)
    gate.wait = undefined
    release()
    await busy
    await opened
    expect(seen).toBe('settled')
    expect(drawn).toContain('The storefront')
    expect(drawn).not.toContain('Dark mode')
    await ui.unmount()
  })

  test(`no README.md: README (none) opens a No README card (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode/ })
    if (surface === 'desktop') expect((await ui.find({ key: 'readme' }))?.props.label).toBe('README (none)')
    await ui.press({ key: 'readme' })
    await ui.find({ type: 'Text', text: surface === 'desktop' ? /No README/ : /no README.md yet/ })
    expect(await drawnText(ui)).not.toContain('Dark mode')
    await ui.press({ key: 'readme' })
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await ui.unmount()
  })

  test(`README opens with resumed (duplicate-id) agents listed (${surface})`, async ($, on) => {
    AGENTS_OVERRIDE = manyAgents()
    try {
      const { ui } = await boot($, on, surface, PROJECT_FILES)
      await ui.find({ type: 'Text', text: /Dark mode/ })
      if (surface === 'desktop') {
        await ui.press({ key: 'agents' })
        await ui.find({ type: 'Text', text: /AGENTS ·/ })
      }
      await ui.press({ key: 'readme' })
      await ui.find({ type: 'Text', text: /The storefront/ })
      expect(await drawnText(ui)).not.toContain('Dark mode')
      await ui.unmount()
    } finally {
      AGENTS_OVERRIDE = undefined
    }
  })
}

test('colors follow the app by default; dark and light glass are one press away', async ($, on) => {
  const { ui } = await boot($, on, 'desktop')
  await ui.find({ type: 'Text', text: /Dark mode/ })
  // Default: no painted backdrop, text in the app's own theme colors.
  let drawn = JSON.stringify(await ui.drawn())
  expect(drawn).not.toContain('#0A0F1E')
  expect(drawn).not.toContain('#EEF2FF')
  await ui.press({ key: 'scheme' })
  await ui.find({ type: 'Text', text: /Colors: dark/ })
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('#0A0F1E')
  expect(drawn).toContain('#EEF2FF')
  await ui.press({ key: 'scheme' })
  await ui.find({ type: 'Text', text: /Colors: light/ })
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('#F8FAFC')
  expect(drawn).toContain('#0F172A')
  await ui.press({ key: 'scheme' })
  await ui.find({ type: 'Text', text: /Colors: app/ })
  await ui.unmount()
})

test('in a linked worktree the board is read from the main checkout', async ($, on) => {
  const { ui, calls } = await boot($, on, 'desktop', {
    '/repo/.git': 'gitdir: /main/.git/worktrees/w1\n',
    '/main/.git/worktrees/w1/HEAD': 'ref: refs/heads/ticket/0016\n',
    '/main/.git/worktrees/w1/commondir': '../..\n',
  })
  await ui.find({ type: 'Text', text: /read from the main checkout: \/main/ })
  expect(calls.some(c => c.startsWith('list /main/tickets'))).toBe(true)
  await ui.unmount()
})

// Resumed agents can show up in agent.list twice with the same id, or with an unknown status and no name.
function manyAgents() {
  const l: any[] = []
  const types = ['worker', 'checker', 'merger', 'ticket-board:ticket-writer']
  for (let i = 0; i < 25; i++)
    l.push({ id: `g${i}`, description: i % 3 === 0 ? `Build ticket 00${10 + (i % 3)}` : `Task ${i}`, type: types[i % 4], status: i % 5 === 0 ? 'completed' : i % 7 === 0 ? 'weird-status' : 'completed', ...(i % 2 === 0 ? { name: `n${i}` } : {}) })
  l.push({ id: 'dup', description: 'Build ticket 0001', type: 'worker', status: 'completed' })
  l.push({ id: 'g3', description: 'Round 2', type: 'worker', status: 'running' })
  l.push({ id: 'dup', description: 'Build ticket 0001', type: 'worker', status: 'running' })
  l.push({ id: 'x', description: undefined, type: 'worker', status: 'running' })
  return l
}

test('agents panel with resumed (duplicate-id) agents draws with unique keys', async ($, on) => {
  AGENTS_OVERRIDE = manyAgents()
  try {
    const { ui } = await boot($, on, 'desktop')
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await ui.press({ key: 'agents' })
    await ui.find({ type: 'Text', text: /AGENTS ·/ })
    await ui.press({ key: 'agent-w-dup' })
    const drawn = JSON.stringify(await ui.drawn())
    const keys = [...drawn.matchAll(/"key":"([^"]+)"/g)].map(m => m[1]!)
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(keys.length).toBeGreaterThan(5)
    expect(dups).toEqual([])
    await ui.unmount()
  } finally {
    AGENTS_OVERRIDE = undefined
  }
})

// ---------- Start screen ----------

const BLANK_BOARD = `# Ticket board

| #    | Ticket | Status | Mode | Blocked by | Owner | Notes |
|------|--------|--------|------|------------|-------|-------|

Status flow: draft → ready → in-progress → in-check → done
`
const SHA = '0123456789abcdef0123456789abcdef01234567'
const GIT_NO_COMMIT = { '/repo/.git/HEAD': 'ref: refs/heads/main\n', '/repo/.git/config': '[core]\n\tbare = false\n' }
const GIT_READY = {
  '/repo/.git/HEAD': 'ref: refs/heads/main\n',
  '/repo/.git/config': '[remote "origin"]\n\turl = git@github.com:acme/salon.git\n',
  '/repo/.git/refs/heads/main': `${SHA}\n`,
}
const drawnText = async (ui: any) => JSON.stringify(await ui.drawn())

for (const surface of ['terminal', 'desktop'] as const) {
  test(`blank folder shows Start, not the old set-up screen (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, {}, { blank: true })
    await ui.find({ type: 'Text', text: /Start a project/ })
    const drawn = await drawnText(ui)
    for (const step of ['Setup', 'Idea', 'Design', 'Plan', 'Tickets']) expect(drawn).toContain(step)
    expect(drawn).toContain('No GitHub repository')
    expect(drawn).toContain('not a git repo')
    expect(drawn).toContain('What are you building?')
    expect(drawn).toContain('Set up board only')
    expect(drawn).not.toContain('No ticket board here yet')
    await ui.unmount()
  })

  test(`tickets but no design or plan: board plus a banner that opens Start (${surface})`, async ($, on) => {
    const { ui, store, writes } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    let drawn = await drawnText(ui)
    expect(drawn).toContain('No design or plan yet')
    await ui.press({ key: 'banner-setup' })
    await ui.find({ type: 'Text', text: /Start a project/ })
    await ui.press({ key: 'back' })
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    await ui.press({ key: 'banner-dismiss' })
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('No design or plan yet')
    expect(store.get('start:/repo')).toEqual({ isGithubSkipped: false, isBannerDismissed: true })
    expect(writes).toEqual([])
    await ui.unmount()
  })

  test(`Start buttons only fill the prompt (${surface})`, async ($, on) => {
    const { ui, filled, writes, fs } = await boot($, on, surface, { '/repo/src/app.ts': 'export {}\n' }, { blank: true })
    await ui.find({ type: 'Text', text: /Start a project/ })
    await ui.press({ key: 'start-git' })
    expect(filled).toEqual(['Initialise git here and make the first commit.'])
    await ui.press({ key: 'start-github' })
    expect(filled.length).toBe(2)
    expect(filled[1]).toContain('gh repo create --private')
    // Empty idea: brainstorm and design are disabled (dimmed, and pressing them fills nothing).
    await ui.press({ key: 'start-brainstorm' })
    await ui.press({ key: 'start-design' })
    expect(filled.length).toBe(2)
    await ui.find({ type: 'Text', text: /Type what you are building first/ })
    // The code button needs no text.
    await ui.press({ key: 'start-code' })
    expect(filled.length).toBe(3)
    expect(filled[2]).toContain('/ticket-board:design Draft a design from the existing code')
    await ui.input({ key: 'start-idea', text: 'A booking app for small salons', kind: 'submit' } as any)
    await ui.press({ key: 'start-brainstorm' })
    expect(filled[3]).toBe('/ticket-board:brainstorm whole A booking app for small salons')
    await ui.press({ key: 'start-design' })
    expect(filled[4]).toBe('/ticket-board:design A booking app for small salons')
    expect(filled.length).toBe(5)
    expect(writes).toEqual([])
    // Set up board only: the one button that writes, then the board.
    await ui.press({ key: 'setup-board-only' })
    expect(writes).toContain('tickets/BOARD.md')
    expect(writes.every(w => w.startsWith('tickets/'))).toBe(true)
    expect(fs.files.get('tickets/BOARD.md')).toContain('| #')
    expect(await drawnText(ui)).not.toContain('Start a project')
    await ui.unmount()
  })

  test(`first commit button fills the prompt (${surface})`, async ($, on) => {
    const { ui, filled, writes } = await boot($, on, surface, GIT_NO_COMMIT, { blank: true })
    await ui.find({ type: 'Text', text: /main · 0 commits/ })
    await ui.press({ key: 'start-push' })
    expect(filled).toEqual(['Make the first commit.'])
    expect(writes).toEqual([])
    await ui.unmount()
  })
}

const STAGES: { name: string; files: Record<string, string>; step: string; start: boolean }[] = [
  { name: 'no git', files: { 'tickets/BOARD.md': BLANK_BOARD }, step: 'Setup', start: true },
  { name: 'commits and origin', files: { ...GIT_READY, 'tickets/BOARD.md': BLANK_BOARD }, step: 'Idea', start: true },
  { name: 'a brief', files: { ...GIT_READY, 'tickets/BOARD.md': BLANK_BOARD, '/repo/design/brief.md': '# Brief\n' }, step: 'Design', start: true },
  { name: 'a design', files: { ...GIT_READY, 'tickets/BOARD.md': BLANK_BOARD, '/repo/design/DESIGN.md': '# D\n\n## D1 · X\n' }, step: 'Plan', start: false },
  { name: 'design and plan, no board yet', files: { ...GIT_READY, '/repo/design/DESIGN.md': '# D\n', '/repo/design/PLAN.md': '# P\n' }, step: 'Tickets', start: true },
]

for (const surface of ['terminal', 'desktop'] as const)
  for (const stage of STAGES)
    test(`stepper resumes from the files: ${stage.name} → ${stage.step} (${surface})`, async ($, on) => {
      const { ui, filled } = await boot($, on, surface, stage.files, { blank: true })
      if (stage.start) {
        await ui.find({ type: 'Text', text: /Start a project/ })
      } else {
        // A design or plan exists: the board shows, and Start opens only from the banner.
        await ui.find({ type: 'Text', text: /No plan yet/ })
        expect(await drawnText(ui)).not.toContain('Start a project')
        await ui.press({ key: 'banner-setup' })
        await ui.find({ type: 'Text', text: /Start a project/ })
      }
      const drawn = await drawnText(ui)
      expect(drawn).toMatch(new RegExp(`● ${stage.step}`))
      if (stage.step === 'Design') {
        await ui.press({ key: 'start-from-idea' })
        expect(filled).toEqual(['/ticket-board:design design/brief.md'])
      }
      if (stage.step === 'Plan') {
        await ui.press({ key: 'start-plan' })
        expect(filled).toEqual(['/ticket-board:planning'])
      }
      await ui.unmount()
    })

test('with a design and a plan the board shows: no Start, no banner', async ($, on) => {
  const files = { ...GIT_READY, 'tickets/BOARD.md': BLANK_BOARD, '/repo/design/DESIGN.md': '# D\n', '/repo/design/PLAN.md': '# P\n' }
  const { ui } = await boot($, on, 'terminal', files, { blank: true })
  await ui.find({ type: 'Text', text: /The board has no tickets/ })
  const drawn = await drawnText(ui)
  expect(drawn).not.toContain('Start a project')
  expect(drawn).not.toContain('yet →')
  await ui.unmount()
})

test('Skip on the GitHub line is remembered per project', async ($, on) => {
  const store = new Map<string, unknown>()
  const { ui } = await boot($, on, 'terminal', { ...GIT_READY, '/repo/.git/config': '[core]\n' }, { blank: true, store })
  await ui.find({ type: 'Text', text: /No GitHub repository/ })
  expect(await drawnText(ui)).toMatch(/● Setup/)
  await ui.press({ key: 'start-skip' })
  await ui.find({ type: 'Text', text: /skipped/ })
  expect(await drawnText(ui)).toMatch(/● Idea/)
  expect(store.get('start:/repo')).toEqual({ isGithubSkipped: true, isBannerDismissed: false })
  await ui.unmount()
})

test('a saved Skip shows "skipped" on the next start (desktop)', async ($, on) => {
  const store = new Map<string, unknown>([['start:/repo', { isGithubSkipped: true, isBannerDismissed: false }]])
  const { ui } = await boot($, on, 'desktop', { ...GIT_READY, '/repo/.git/config': '[core]\n' }, { blank: true, store })
  await ui.find({ type: 'Text', text: /skipped/ })
  const drawn = await drawnText(ui)
  expect(drawn).not.toContain('No GitHub repository')
  expect(drawn).toMatch(/● Idea/)
  await ui.unmount()
})

test('an unreadable .git shows "git status unknown"', async ($, on) => {
  const { ui } = await boot($, on, 'terminal', { '/repo/.git/objects/x': 'x' }, { blank: true })
  await ui.find({ type: 'Text', text: /git status unknown/ })
  await ui.unmount()
})

// ---------- Auto-open: only where a tickets/ folder exists ----------

test('a blank folder with no tickets/ does not auto-open, and /board there still shows Start', async ($, on) => {
  const { ui, openedAtStart } = await boot($, on, 'terminal', {}, { blank: true })
  expect(openedAtStart).toEqual([])
  await $.command.run({ command: 'board', args: '' } as any)
  await ui.find({ type: 'Text', text: /Start a project/ })
  await ui.unmount()
})

test('an empty tickets/ folder (no BOARD.md) auto-opens on Start', async ($, on) => {
  const { ui, openedAtStart } = await boot($, on, 'desktop', {}, { blank: true, dirs: ['tickets'] })
  expect(openedAtStart).toEqual(['ticket-board'])
  await ui.find({ type: 'Text', text: /Start a project/ })
  await ui.unmount()
})

test('a folder with a board still auto-opens', async ($, on) => {
  const { ui, openedAtStart } = await boot($, on, 'terminal')
  expect(openedAtStart).toEqual(['ticket-board'])
  await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
  await ui.unmount()
})

test('tickets/ with a ticket folder but no BOARD.md auto-opens on Start', async ($, on) => {
  const { ui, openedAtStart } = await boot($, on, 'terminal', { 'tickets/0001-health-endpoint/rd.md': '# 0001 — Health endpoint\n' }, { blank: true })
  expect(openedAtStart).toEqual(['ticket-board'])
  await ui.find({ type: 'Text', text: /Start a project/ })
  await ui.unmount()
})

// ---------- Plan progress on the board (roadmap fixture) ----------

const RM_DESIGN = `---
design: Salon
version: 3
status: approved
updated: 2026-11-01
---
# Salon: design

## D1 · Booking
Rev: 2
What: book a slot.

## D2 · Accounts
Rev: 1

## D3 · Payments
Rev: 2

## D4 · Reminders
Rev: 1

### Open questions
- [ ] SMS or email?

## D5 · Reports
Rev: 1

## D6 · Staff
Rev: 1

## D7 · Waitlist
Rev: 1
`

const RM_PLAN = `---
plan: Salon
design-version: 2
updated: 2026-11-02
---
# Salon: plan

## P1 · Foundations
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Accounts | S | — | D2 | sign in works | |
| P1.2 | Booking core | M | P1.1 | D1 | a slot can be booked | |

## P2 · Booking
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Payments | M | P1.2 | D3 | a card is charged | |
| P2.2 | One Accept per intent | S | P2.3 | D1, D3 | one accept | |
| P2.3 | Reminders | S | — | D4 | a reminder is sent | |
| P2.4 | Calendar sync | S | P2.1 | D1 | synced | |

## P3 · Reports
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P3.1 | Reports | M | P2.1 | D5 | a report shows | |

## P4 · Staff
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P4.1 | Staff rota | L | P3.1 | D6 | a rota shows | |
`

const RM_BOARD = `# Salon board

Design: design/DESIGN.md · Plan: design/PLAN.md

| #    | Ticket          | Status      | Mode | Blocked by | Owner | Notes |
|------|-----------------|-------------|------|------------|-------|-------|
| 0001 | Accounts        | done        | solo | —          | —     | merged |
| 0002 | Booking core    | done        | solo | —          | —     | merged |
| 0003 | Payments        | done        | solo | —          | —     | merged |
| 0004 | Accept once     | in-progress | solo | —          | —     | |
| 0005 | Calendar sync   | draft       | solo | —          | —     | |
| 0006 | Fix typo        | ready       | solo | —          | —     | |
| 0007 | Lost build      | draft       | solo | —          | —     | |

Status flow: draft → ready → in-progress → in-check → done
`

const rmRd = (n: string, title: string, head: string) => `# ${n} — ${title}

Type: feature
${head}

## What

Something.

## Open questions

- none
`

const RM_TICKETS: [string, string, string, string][] = [
  ['0001', 'accounts', 'Accounts', 'Plan: P1.1\nDesign: D2'],
  ['0002', 'booking-core', 'Booking core', 'Plan: P1.2\nDesign: D1@2'],
  ['0003', 'payments', 'Payments', 'Plan: P2.1\nDesign: D3@2'],
  ['0004', 'accept-once', 'Accept once', 'Plan: P2.2\nDesign: D1@2, D3@1'],
  ['0005', 'calendar-sync', 'Calendar sync', 'Plan: P2.4'],
  ['0006', 'fix-typo', 'Fix typo', ''],
  ['0007', 'lost-build', 'Lost build', 'Plan: P9.9'],
]

function roadmapFiles(plan = RM_PLAN): Record<string, string> {
  const out: Record<string, string> = { ...GIT_READY, 'tickets/BOARD.md': RM_BOARD, '/repo/design/DESIGN.md': RM_DESIGN, '/repo/design/PLAN.md': plan }
  for (const [n, slug, title, head] of RM_TICKETS) {
    out[`tickets/${n}-${slug}/rd.md`] = rmRd(n, title, head)
    out[`tickets/${n}-${slug}/eval.md`] = EVAL
  }
  return out
}

/** What hooks/core/roadmap.ts computes for the fixture: the pane must show these numbers. */
function fixtureRoadmap() {
  const status: Record<string, string> = { '0001': 'done', '0002': 'done', '0003': 'done', '0004': 'in-progress', '0005': 'draft', '0006': 'ready', '0007': 'draft' }
  const refs = RM_TICKETS.map(([n, , title, head]) => ticketRef({ number: n, status: status[n]! }, rmRd(n, title, head)))
  return roadmap(RM_DESIGN, RM_PLAN, refs)
}

const RM_ALL = ['0001', '0002', '0003', '0004', '0005', '0006', '0007']
/** Ticket rows in the order they are drawn. */
const rowOrder = (drawn: string) =>
  RM_ALL.filter(n => drawn.includes(`row-${n}`))
    .map(n => [n, drawn.indexOf(`row-${n}`)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([n]) => n)

for (const surface of ['terminal', 'desktop'] as const)
  test(`plan bound: Plan % from progress(), not ticket Done % (${surface})`, async ($, on) => {
    const rm = fixtureRoadmap()
    const p = rm.progress
    expect(p.currentPhase).toBe('P2')
    const cur = p.phases.find(x => x.id === 'P2')!
    expect(p.planPct).toBe(33)
    expect(cur.pct).toBe(50)
    const { ui } = await boot($, on, surface, roadmapFiles(), { blank: true })
    await ui.find({ type: 'Text', text: /Accept once/ })
    const drawn = await drawnText(ui)
    if (surface === 'desktop') {
      expect(drawn).toContain(`"${p.planPct}%"`)
      expect(drawn).toContain('"Plan"')
      expect(drawn).not.toContain('"Done"')
      expect(drawn).toContain(`P2 of 4 · D ${rm.coverage.built}/${rm.coverage.counted} · tickets 43%`)
    } else {
      expect(drawn).toContain(`Plan ${p.planPct}% · P2 ${cur.pct}% · design v3 (plan behind) · tickets 43%`)
      expect(drawn).toContain('⚠ Plan is behind design v3')
    }
    await ui.unmount()
  })

for (const surface of ['terminal', 'desktop'] as const)
  test(`no plan: the tile stays Done with ticket %, no phase column or filter (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    const drawn = await drawnText(ui)
    if (surface === 'desktop') {
      expect(drawn).toContain('"Done"')
      expect(drawn).toContain('"33%"')
      expect(drawn).toContain('1 of 3')
      expect(drawn).not.toContain('PHASE')
      expect(drawn).not.toContain('ROADMAP')
    } else {
      expect(drawn).not.toMatch(/Plan \d+%/)
    }
    expect(drawn).not.toContain('Off-plan')
    expect(drawn).not.toContain('"Phase"')
    await ui.unmount()
  })

test('Roadmap card: rail, Now line, next up and warnings above Board notes (desktop)', async ($, on) => {
  const rm = fixtureRoadmap()
  const { ui } = await boot($, on, 'desktop', roadmapFiles(), { blank: true })
  await ui.find({ type: 'Text', text: /Accept once/ })
  const drawn = await drawnText(ui)
  expect(drawn).toContain('ROADMAP')
  expect(drawn.indexOf('ROADMAP')).toBeLessThan(drawn.indexOf('BOARD NOTES'))
  // The rail is one static SVG: no script, no animation, not interactive.
  expect(drawn).toContain('viewBox=\\"0 0 640 14\\"') // the rail
  expect(drawn).not.toContain('isInteractive')
  const rail = railSvg([{ pct: 100 }, { pct: 50 }, { pct: 0 }, { pct: 0 }], '#3B82F6')
  expect(drawn).toContain('<path d=') // the check mark on the finished phase
  expect(rail).not.toMatch(/<animate|<script|onclick/i)
  const p2 = rm.progress.phases.find(x => x.id === 'P2')!
  expect(rm.progress.nextUp).toBe('P2.3')
  expect(drawn).toContain(`Now: P2 · Booking · ${p2.built} of ${p2.counted} builds built · next up P2.3 (no ticket)`)
  expect(drawn).toContain('Plan is behind design v3')
  expect(drawn).toContain('D7 has no build')
  expect(rm.links.offPlan.length).toBe(1)
  expect(drawn).toContain('1 off-plan')
  expect(drawn).toContain('Open design questions in D4')
  expect(drawn).toContain('3 builds have no ticket: P2.3, P3.1, P4.1')
  expect(drawn).toContain('1 stale ticket: 0004')
  // Not drawn until the Plan view and the flows land (0007, 0008).
  expect(drawn).not.toContain('Open plan')
  expect(drawn).not.toContain('Replan')
  // A rail link sets the phase filter; pressing it again clears it.
  await ui.press({ key: 'rail-P1' })
  expect(rowOrder(await drawnText(ui))).toEqual(['0001', '0002'])
  await ui.press({ key: 'rail-P1' })
  expect(rowOrder(await drawnText(ui))).toEqual(RM_ALL)
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const)
  test(`a plan that cannot be read leaves the board drawn with one warning line (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, roadmapFiles('this is not a plan\n\nno phases, no tables\n'), { blank: true })
    await ui.find({ type: 'Text', text: /Accept once/ })
    const drawn = await drawnText(ui)
    expect(drawn.split('showing tickets only').length - 1).toBe(1)
    expect(drawn).not.toContain('ROADMAP')
    expect(drawn).not.toMatch(/Plan \d+%/)
    if (surface === 'desktop') expect(drawn).toContain('"Done"')
    await ui.unmount()
  })

test('phase column and filter: P2, Off-plan, Clear filters, sort by phase (desktop)', async ($, on) => {
  const store = new Map<string, unknown>()
  const { ui } = await boot($, on, 'desktop', roadmapFiles(), { blank: true, store })
  await ui.find({ type: 'Text', text: /Accept once/ })
  expect(await drawnText(ui)).toContain('PHASE')
  expect(rowOrder(await drawnText(ui))).toEqual(RM_ALL)
  await ui.select({ key: 'phase', value: 'P2' } as any)
  expect(rowOrder(await drawnText(ui))).toEqual(['0003', '0004', '0005'])
  expect((store.get('filters:/repo') as any).phase).toBe('P2')
  await ui.select({ key: 'phase', value: 'off-plan' } as any)
  expect(rowOrder(await drawnText(ui))).toEqual(['0006'])
  await ui.press({ key: 'clear' })
  expect(rowOrder(await drawnText(ui))).toEqual(RM_ALL)
  expect((store.get('filters:/repo') as any).phase).toBe('any')
  await ui.press({ key: 'sort-phase' })
  // P1, P2, P9 (the phase the missing build's id names), then off-plan.
  expect(rowOrder(await drawnText(ui))).toEqual(['0001', '0002', '0003', '0004', '0005', '0007', '0006'])
  await ui.press({ key: 'sort-phase' })
  expect(rowOrder(await drawnText(ui))).toEqual(['0006', '0007', '0005', '0004', '0003', '0002', '0001'])
  await ui.unmount()
})

test('phase filter in the terminal', async ($, on) => {
  const { ui } = await boot($, on, 'terminal', roadmapFiles(), { blank: true })
  await ui.find({ type: 'Text', text: /Accept once/ })
  await ui.select({ key: 'phase', value: 'P1' } as any)
  const drawn = await drawnText(ui)
  expect(drawn).toContain('Booking core')
  expect(drawn).not.toContain('Accept once')
  await ui.unmount()
})

test('board columns total 100% with and without the Phase column', () => {
  for (const hasPlan of [false, true]) {
    const cols = boardCols(hasPlan)
    expect(cols.reduce((s, c) => s + Number(c.width.replace('%', '')), 0)).toBe(100)
    expect(cols.some(c => c.id === 'phase')).toBe(hasPlan)
  }
})

test('ticket Properties: Plan item, Design chips, stale notice, off-plan, missing build (desktop)', async ($, on) => {
  const { ui } = await boot($, on, 'desktop', roadmapFiles(), { blank: true })
  await ui.find({ type: 'Text', text: /Accept once/ })
  await ui.press({ key: 'open-0004' })
  await ui.find({ type: 'Text', text: /PROPERTIES/ })
  let drawn = await drawnText(ui)
  expect(drawn).toContain('PLAN ITEM')
  expect(drawn).toContain('P2.2 · One Accept per intent')
  expect(drawn).toContain(' D1@2 ')
  expect(drawn).toContain('D3@1 · stale')
  expect(drawn).not.toContain('D1@2 · stale')
  expect(drawn).toContain('Written against D3 rev 1, now rev 2 — Review')
  await ui.press({ key: 'back' })
  await ui.press({ key: 'open-0006' })
  drawn = await drawnText(ui)
  expect(drawn).toContain('Off-plan')
  expect(drawn).not.toContain('Written against')
  await ui.press({ key: 'back' })
  await ui.press({ key: 'open-0007' })
  drawn = await drawnText(ui)
  expect(drawn).toContain('P9.9 — not in the plan')
  await ui.unmount()
})

test('ticket view lists the plan item and design chips as text (terminal)', async ($, on) => {
  const { ui } = await boot($, on, 'terminal', roadmapFiles(), { blank: true })
  await ui.find({ type: 'Text', text: /Accept once/ })
  await ui.press({ key: 'open-0004' })
  const drawn = await drawnText(ui)
  expect(drawn).toContain('Plan item: P2.2 · One Accept per intent')
  expect(drawn).toContain('Design: D1@2, D3@1 (stale)')
  expect(drawn).toContain('Written against D3 rev 1, now rev 2')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const)
  test(`no plan: the ticket page shows no plan item or design chips (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    await ui.press({ key: 'open-0003' })
    const drawn = await drawnText(ui)
    expect(drawn).not.toContain('PLAN ITEM')
    expect(drawn).not.toContain('Plan item')
    expect(drawn).not.toContain('Off-plan')
    await ui.unmount()
  })

// ---------- New ticket (0010: + New ticket did nothing) ----------

for (const surface of ['terminal', 'desktop'] as const) {
  test(`+ New ticket opens the form; Back returns to the board (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    expect(await drawnText(ui)).toContain('Dark mode for settings page')
    await ui.press({ key: 'new' })
    await ui.find({ type: 'Text', text: /New ticket/ })
    await ui.find({ key: 'new-idea' } as any)
    await ui.find({ key: 'create-ai' } as any)
    let drawn = await drawnText(ui)
    expect(drawn).not.toContain('Health endpoint')
    expect(drawn).not.toContain('Dark mode for settings page')
    await ui.press({ key: 'back' })
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('create-ai')
    await ui.unmount()
  })

  test(`New ticket: Create skeleton writes the next ticket and shows it (${surface})`, async ($, on) => {
    const { ui, fs } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    await ui.press({ key: 'new' })
    await ui.input({ key: 'new-idea', text: 'Export button does nothing', kind: 'submit' } as any)
    // Submitting the idea starts Create + AI on the terminal; on desktop it only saves the draft.
    if (!fs.files.has('tickets/0004-export-button-does-nothing/rd.md')) await ui.press({ key: 'create-plain' })
    expect(fs.files.has('tickets/0004-export-button-does-nothing/rd.md')).toBe(true)
    expect(fs.files.get('tickets/BOARD.md')!).toContain('0004')
    await ui.find({ type: 'Text', text: /Export button does nothing/ })
    await ui.unmount()
  })

  test(`/board new <idea> opens the form with the idea filled in (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    await $.command.run({ command: 'board', args: 'new foo' } as any)
    await ui.find({ key: 'new-idea' } as any)
    const drawn = await drawnText(ui)
    expect(drawn).toMatch(/"value":"foo"/)
    expect(drawn).not.toContain('Dark mode for settings page')
    await ui.unmount()
  })

  test(`+ New ticket opens the form with resumed (duplicate-id) agents listed (${surface})`, async ($, on) => {
    AGENTS_OVERRIDE = manyAgents()
    try {
      const { ui } = await boot($, on, surface)
      await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
      // The Agents panel (desktop) draws one row per agent: the 0013 duplicate keys showed up there.
      if (surface === 'desktop') {
        await ui.press({ key: 'agents' })
        await ui.find({ type: 'Text', text: /AGENTS ·/ })
      }
      await ui.press({ key: 'new' })
      await ui.find({ key: 'create-ai' } as any)
      expect(await drawnText(ui)).not.toContain('Dark mode for settings page')
      await ui.unmount()
    } finally {
      AGENTS_OVERRIDE = undefined
    }
  })

  test(`+ New ticket opens the form on a plan-bound board with a roadmap (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, roadmapFiles(), { blank: true })
    await ui.find({ type: 'Text', text: /Accept once/ })
    await ui.press({ key: 'new' })
    await ui.find({ key: 'create-ai' } as any)
    expect(await drawnText(ui)).not.toContain('Accept once')
    await ui.unmount()
  })
}

test('an empty desktop board: + Create the first ticket opens the form', async ($, on) => {
  const { ui } = await boot($, on, 'desktop', { ...GIT_READY, 'tickets/BOARD.md': BLANK_BOARD, '/repo/design/DESIGN.md': RM_DESIGN, '/repo/design/PLAN.md': RM_PLAN }, { blank: true })
  await ui.find({ type: 'Text', text: /No tickets yet/ })
  await ui.press({ key: 'new-empty' })
  await ui.find({ key: 'create-ai' } as any)
  await ui.find({ type: 'Text', text: /What happens next/ })
  await ui.unmount()
})

// ---------- 0014: the plugin version on the board ----------

{
  /**
   * Tests cannot read files themselves, but the engine reads .claude-plugin/plugin.json to load the
   * plugin and hands its name and version to `plugin.register`. Those are what the plugin then reads
   * back as its own manifest here, so the label checked is the real manifest's version.
   */
  const fromManifest = (on: any) => {
    const seen = { version: '', opts: {} as BootOptions }
    on('plugin.register', (_: unknown, e: { name: string; version?: string }) => {
      if (e.name === 'ticket-board') {
        seen.version = e.version ?? ''
        seen.opts.manifest = JSON.stringify({ name: e.name, version: e.version })
      }
      return { allow: true as const }
    })
    return seen
  }
  const BUTTONS = ['new', 'refresh', 'agents', 'readme']

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the board shows the running version from the manifest (${surface})`, async ($, on) => {
      const m = fromManifest(on)
      const { ui } = await boot($, on, surface, {}, m.opts)
      expect(m.version).toMatch(/^\d+\.\d+\.\d+/)
      await ui.find({ type: 'Text', text: /Dark mode/ })
      const drawn = JSON.stringify(await ui.drawn())
      expect(drawn).toContain(`ticket-board ${m.version}`)
      for (const key of BUTTONS) await ui.find({ key })
      await ui.unmount()
    })

    test(`Show version off hides the label (${surface})`, { options: { showVersion: false } }, async ($, on) => {
      const m = fromManifest(on)
      const { ui } = await boot($, on, surface, {}, m.opts)
      expect(m.version).not.toBe('')
      await ui.find({ type: 'Text', text: /Dark mode/ })
      const drawn = JSON.stringify(await ui.drawn())
      expect(drawn).not.toContain(m.version)
      expect(drawn).not.toContain('ticket-board ')
      expect(drawn).toContain('Health endpoint')
      for (const key of BUTTONS) await ui.find({ key })
      await ui.unmount()
    })

    const unreadable: [string, string | undefined][] = [
      ['missing', undefined],
      ['not JSON', '{ not json'],
      ['without a version', '{"name":"ticket-board"}'],
      ['not a version', '{"version":"<b>9</b> and a very long string that is no version"}'],
    ]
    for (const [why, bad] of unreadable) {
      test(`a manifest ${why} draws the board without a version label (${surface})`, async ($, on) => {
        const { ui } = await boot($, on, surface, {}, bad === undefined ? {} : { manifest: bad })
        await ui.find({ type: 'Text', text: /Dark mode/ })
        const drawn = JSON.stringify(await ui.drawn())
        expect(drawn).toContain('Health endpoint')
        expect(drawn).not.toContain('ticket-board ')
        for (const key of BUTTONS) await ui.find({ key })
        await ui.unmount()
      })
    }
  }
}

// ---------- Plan and Design (0007) ----------

const P7_DESIGN = `---
design: Salon
version: 2
status: draft
updated: 2026-11-08
---
# Salon: design

## Vision
Book a salon without phone tag.

## D1 · Accounts
Rev: 1
Why: People sign in.
What: Email sign-in.
Done when:
- a person can sign in

## D2 · Booking
Rev: 1
What: Book a slot.

## D3 · Payments
Rev: 1
Why: Owners want deposits.
What: Take a card deposit at booking.
Done when:
- a deposit is charged

### Open questions
- [ ] Stripe or Adyen? [Stripe · Adyen]

## D4 · Reminders
Rev: 1

### Open questions
- [ ] SMS or email?
- [x] Should reminders be optional?
  **Resolved 2026-11-01 (human): yes**

## D5 · ~~Loyalty~~
Status: dropped in v2
`

const P7_PLAN = `---
plan: Salon
design-version: 2
updated: 2026-11-09
---
# Salon: plan

## P1 · Foundations
Appetite: 1 week
Exit: a person can sign in and see the calendar

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Accounts | S | — | D1 | sign in works | 0001 |
| P1.2 | Booking core | M | P1.1 | D2, D3 | a slot is booked | 0007 |

## P2 · Payments
Appetite: 2 weeks
Exit: a deposit is charged

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Card form | S | P1.1 | D3 | form shows | 0002 |
| P2.2 | Charge | M | P2.1, GitHub origin | D3 | charged | 0003 |
| P2.3 | Refunds | S | P2.1, P2.2 | D3 | refunded | 0004 |
| P2.4 | Receipts | S | — | D3 | receipt sent | 0005 |

## P3 · Reminders
| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P3.1 | Reminder mails | L | P2.3 | D4 | a reminder is sent | |
`

const P7_BOARD = `# Salon board

Design: design/DESIGN.md · Plan: design/PLAN.md

| #    | Ticket        | Status | Mode | Blocked by | Owner | Notes |
|------|---------------|--------|------|------------|-------|-------|
| 0001 | Accounts      | done   | solo | —          | —     | merged |
| 0002 | Card form     | ready  | solo | 0001       | —     | |
| 0003 | Charge        | ready  | solo | —          | —     | |
| 0004 | Refunds       | ready  | solo | 0005       | —     | |
| 0005 | Receipts      | draft  | solo | —          | —     | |
| 0007 | Booking core  | draft  | solo | —          | —     | |
`

const P7_TICKETS: [string, string, string, string][] = [
  ['0001', 'accounts', 'Accounts', 'Plan: P1.1\nDesign: D1'],
  ['0002', 'card-form', 'Card form', 'Plan: P2.1\nDesign: D3'],
  ['0003', 'charge', 'Charge', 'Plan: P2.2\nDesign: D3'],
  ['0004', 'refunds', 'Refunds', 'Plan: P2.3'],
  ['0005', 'receipts', 'Receipts', 'Plan: P2.4'],
  ['0007', 'booking-core', 'Booking core', 'Plan: P1.2\nDesign: D2, D3@1'],
]

const P7_CHANGES = ['2026-11-01-design-v1.md', '2026-11-08-design-v2.md', '2026-11-09-replan.md']

function p7Files(opts: { design?: string | null; plan?: string | null; router?: boolean; changes?: boolean } = {}): Record<string, string> {
  const out: Record<string, string> = { ...GIT_READY, 'tickets/BOARD.md': P7_BOARD }
  if (opts.design !== null) out['/repo/design/DESIGN.md'] = opts.design ?? P7_DESIGN
  if (opts.plan !== null) out['/repo/design/PLAN.md'] = opts.plan ?? P7_PLAN
  if (opts.router === true) out['/repo/.claude/agents/router.md'] = '# router\n'
  if (opts.changes !== false) for (const c of P7_CHANGES) out[`/repo/design/changes/${c}`] = `# ${c}\n`
  for (const [n, slug, title, head] of P7_TICKETS) {
    out[`tickets/${n}-${slug}/rd.md`] = rmRd(n, title, head)
    out[`tickets/${n}-${slug}/eval.md`] = EVAL
  }
  return out
}

/** What hooks/core/roadmap.ts computes for this fixture. */
function p7Roadmap(design = P7_DESIGN) {
  const status: Record<string, string> = { '0001': 'done', '0002': 'ready', '0003': 'ready', '0004': 'ready', '0005': 'draft', '0007': 'draft' }
  return roadmap(design, P7_PLAN, P7_TICKETS.map(([n, , title, head]) => ticketRef({ number: n, status: status[n]! }, rmRd(n, title, head))))
}

const hotkeyed = async (ui: any, key: string) => (await ui.findAll({ type: 'Button' })).filter((b: any) => b.props.hotkey === key).map((b: any) => b.key)
const count = (text: string, part: string) => text.split(part).length - 1

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Plan and Design: tabs, ticket pill, Design chip and Back each step (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    // p and d each press exactly one Button.
    expect(await hotkeyed(ui, 'p')).toEqual(['tab-plan'])
    expect(await hotkeyed(ui, 'd')).toEqual(['tab-design'])
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D1' })
    await ui.press({ key: 'tab-board' })
    await ui.find({ key: 'tab-plan' })
    expect(await drawnText(ui)).not.toContain('sec-D1')
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'phase-toggle-P1' })
    expect(await hotkeyed(ui, 'p')).toEqual(['tab-plan'])
    expect(await hotkeyed(ui, 'd')).toEqual(['tab-design'])
    await ui.press({ key: 'pill-P1.2-0007' })
    await ui.find({ key: 'brainstorm' })
    expect(await drawnText(ui)).toContain('Booking core')
    expect((await ui.find({ key: 'back' })).props.label).toBe('‹ Plan')
    await ui.press({ key: 'chip-D3' })
    await ui.find({ key: 'brainstorm-section' })
    let drawn = await drawnText(ui)
    expect(drawn.toLowerCase()).toContain('d3 · payments')
    expect(drawn).toContain('Take a card deposit at booking.')
    expect((await ui.find({ key: 'back' })).props.label).toBe('‹ 0007')
    await ui.press({ key: 'back' })
    await ui.find({ key: 'brainstorm' })
    await ui.press({ key: 'back' })
    await ui.find({ key: 'phase-toggle-P1' })
    expect((await ui.find({ key: 'back' })).props.label).toBe('‹ Board')
    await ui.press({ key: 'back' })
    await ui.find({ type: 'Text', text: /Card form/ })
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('phase-toggle-P1')
    // The ticket's Plan item opens the Plan at its build.
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'pill-P1.2-0007' })
    await ui.press({ key: 'plan-item' })
    await ui.find({ key: 'phase-toggle-P1' })
    if (surface === 'terminal') expect(await drawnText(ui)).toContain('› P1.2')
    await ui.unmount()
  })

  test(`Plan list: phases with %, builds with Size / Needs / Covers / Ticket / State (${surface})`, async ($, on) => {
    const rm = p7Roadmap()
    const { ui } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'phase-toggle-P3' })
    const drawn = await drawnText(ui)
    for (const p of rm.progress.phases) expect(drawn).toContain(`${p.pct}%`)
    expect(drawn).toContain(`${rm.progress.planPct}%`)
    expect(drawn).toContain('Appetite 2 weeks')
    expect(drawn).toContain('Exit: a deposit is charged')
    for (const h of rm.hill) expect(drawn).toContain(h.side === 'uphill' ? '⛰ uphill' : h.side === 'top' ? 'at the top' : 'over the hill')
    // A build row: id, name, size, needs (the non-build need too), covers chips, ticket pills, state.
    expect(drawn).toContain('Charge')
    expect(drawn).toContain('P2.1, GitHub origin')
    for (const key of ['dchip-P2.2-D3', 'pill-P2.2-0003', 'dchip-P1.2-D2', 'pill-P1.1-0001']) await ui.find({ key })
    expect(drawn).toContain(surface === 'desktop' ? '0003 Ready' : '0003 ready')
    expect(drawn).toContain(surface === 'desktop' ? '0001 Done' : '0001 done')
    expect(rm.progress.states['P1.1']).toBe('built')
    expect(rm.progress.states['P3.1']).toBe('not-started')
    expect(drawn).toContain('not started')
    expect(drawn).toContain('built')
    expect(drawn).toContain('no ticket')
    // Create ticket (0008) only on the build with no ticket; phases with every build ticketed have no Create tickets.
    await ui.find({ key: 'build-create-P3.1' })
    await ui.find({ key: 'phase-create-P3' })
    for (const id of ['P1.1', 'P1.2', 'P2.1', 'P2.2', 'P2.3', 'P2.4']) expect(drawn).not.toContain(`build-create-${id}`)
    for (const id of ['P1', 'P2']) expect(drawn).not.toContain(`phase-create-${id}`)
    if (surface === 'desktop') {
      for (const h of ['SIZE', 'NEEDS', 'COVERS', 'TICKET', 'STATE']) expect(drawn).toContain(h)
      expect(PLAN_COLS.reduce((s, c) => s + Number(c.width.replace('%', '')), 0)).toBe(100)
    }
    // Collapsible.
    await ui.press({ key: 'phase-toggle-P2' })
    expect(await drawnText(ui)).not.toContain('pill-P2.2-0003')
    await ui.press({ key: 'phase-toggle-P2' })
    await ui.find({ key: 'pill-P2.2-0003' })
    await ui.unmount()
  })

  test(`Plan timeline: lanes, Needs arrows, hill dots, remembered (${surface})`, async ($, on) => {
    const rm = p7Roadmap()
    const store = new Map<string, unknown>()
    const { ui } = await boot($, on, surface, p7Files(), { blank: true, store })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'plan-timeline' })
    await ui.find({ key: 'tl-P3.1' })
    expect(store.get('plan-mode:/repo')).toBe('timeline')
    let drawn = await drawnText(ui)
    const pairs = rm.plan.phases.flatMap(p => p.builds).flatMap(b => b.needs.map(n => `${n}>${b.id}`))
    expect(pairs.length).toBe(6)
    if (surface === 'desktop') {
      expect(count(drawn, 'class=\\"lane\\"')).toBe(rm.plan.phases.length)
      expect(count(drawn, 'class=\\"dep\\"')).toBe(pairs.length)
      for (const p of pairs) expect(drawn).toContain(`data-need=\\"${p}\\"`)
      expect(count(drawn, 'class=\\"hill-dot\\"')).toBe(rm.plan.phases.length)
      // Static: no script, no animation, not interactive (so no scroll capture).
      const svgs = (await ui.findAll({ type: 'Svg' })).filter((x: any) => /class="(lane|hill-dot)"/.test(x.props.source))
      expect(svgs.length).toBe(2)
      for (const svg of svgs) {
        expect(svg.props.source).not.toMatch(/<animate|<script|onclick/i)
        expect(svg.props.isInteractive).toBeUndefined()
      }
    } else {
      for (const p of rm.plan.phases) expect(drawn).toContain(`${p.id.padEnd(4)} │`)
      expect(drawn).toContain('P2.1+P2.2 → P2.3')
      expect(drawn).toContain('Hill: P1')
    }
    // A link button under the timeline per build.
    for (const b of rm.plan.phases.flatMap(p => p.builds)) await ui.find({ key: `tl-${b.id}` })
    // Reopening keeps Timeline.
    await ui.press({ key: 'tab-board' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'tl-P1.1' })
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('phase-toggle-P1')
    await ui.unmount()
  })

  test(`Plan timeline is remembered across sessions (${surface})`, async ($, on) => {
    const store = new Map<string, unknown>([['plan-mode:/repo', 'timeline']])
    const { ui } = await boot($, on, surface, p7Files(), { blank: true, store })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'tl-P1.1' })
    await ui.press({ key: 'plan-list' })
    await ui.find({ key: 'phase-toggle-P1' })
    expect(store.get('plan-mode:/repo')).toBe('list')
    await ui.unmount()
  })

  test(`Run for a phase and a build fills the board's run line, ready tickets only (${surface})`, async ($, on) => {
    const { ui, filled, writes } = await boot($, on, surface, p7Files({ router: true }), { blank: true })
    await ui.find({ key: 'tab-plan' })
    // The board's own Run ready, for comparison: same rule, same text.
    await ui.press({ key: 'runall' })
    expect(filled).toEqual([runLine(['0002', '0003'], true)])
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'phase-run-P2' })
    expect((await ui.find({ key: 'phase-run-P2' })).props.label).toBe('▶ Run ready (2)')
    await ui.press({ key: 'phase-run-P2' })
    // 0002 (blocker 0001 done, outside the phase) and 0003; not 0004 (waits on 0005) or 0005 (draft).
    expect(filled[1]).toBe(runLine(['0002', '0003'], true))
    expect(filled[1]).toContain('as the router')
    await ui.press({ key: 'build-run-P2.2' })
    expect(filled[2]).toBe(runLine(['0003'], true))
    // A ready ticket that waits on another: the build's Run is disabled and says why.
    const blocked = await ui.find({ key: 'build-run-P2.3' })
    expect(blocked.props.dimColor).toBe(true)
    await ui.press({ key: 'build-run-P2.3' })
    expect(filled.length).toBe(3)
    expect(await drawnText(ui)).toContain('0004 waits on 0005')
    // A phase with nothing ready: disabled, with the reason beside it.
    const none = await ui.find({ key: 'phase-run-P3' })
    expect(none.props.label).toBe('▶ Run ready (0)')
    expect(none.props.dimColor).toBe(true)
    expect(await drawnText(ui)).toContain('No tickets in P3 yet')
    await ui.press({ key: 'phase-run-P3' })
    expect(filled.length).toBe(3)
    // No build Run where the build has no ready ticket.
    expect(await drawnText(ui)).not.toContain('build-run-P2.4')
    expect(writes).toEqual([])
    await ui.unmount()
  })

  test(`Run without a router project file fills the plain run line (${surface})`, async ($, on) => {
    const { ui, filled } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'phase-run-P2' })
    expect(filled).toEqual([runLine(['0002', '0003'], false)])
    expect(filled[0]).toBe('Run tickets 0002 and 0003.')
    await ui.unmount()
  })

  test(`Brainstorm: ticket page, design section and phase fill the prompt (${surface})`, async ($, on) => {
    const { ui, filled, writes } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'pill-P1.2-0007' })
    expect(await hotkeyed(ui, 'b')).toEqual(['brainstorm'])
    await ui.press({ key: 'brainstorm' })
    expect(filled).toEqual(['/ticket-board:brainstorm 0007'])
    await ui.press({ key: 'chip-D3' })
    await ui.press({ key: 'brainstorm-section' })
    await ui.press({ key: 'redesign-section' })
    expect(filled.slice(1)).toEqual(['/ticket-board:brainstorm D3', '/ticket-board:design D3'])
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'phase-brainstorm-P2' })
    expect(filled[3]).toBe('/ticket-board:brainstorm P2')
    expect(writes).toEqual([])
    await ui.unmount()
  })

  test(`Design view: coverage, inline answers, approve gate, history (${surface})`, async ($, on) => {
    const rm = p7Roadmap()
    const { ui, fs, filled, writes } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-design' })
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D1' })
    let drawn = await drawnText(ui)
    expect(drawn).toContain(`Design ${rm.coverage.designPct}%`)
    for (const c of rm.coverage.sections) expect(drawn).toContain(`${c.id} ${c.title}`)
    for (const st of new Set(rm.coverage.sections.map(c => c.state))) expect(drawn).toContain(st)
    expect(drawn).toContain('D5 Loyalty')
    expect(drawn).toContain('dropped')
    // History, newest first.
    expect(drawn).toContain('Design v2')
    expect(drawn.indexOf('2026-11-09-replan.md')).toBeLessThan(drawn.indexOf('2026-11-08-design-v2.md'))
    expect(drawn.indexOf('2026-11-08-design-v2.md')).toBeLessThan(drawn.indexOf('2026-11-01-design-v1.md'))
    // Approve is disabled while two questions are open.
    expect((await ui.find({ key: 'approve-design' })).props.dimColor).toBe(true)
    await ui.press({ key: 'approve-design' })
    expect(writes).toEqual([])
    expect(filled).toEqual([])
    expect(await drawnText(ui)).toContain('Answer the 2 open questions first (D3, D4)')
    // Answer D3's question inline.
    await ui.press({ key: 'sec-D3' })
    await ui.input({ key: 'dq-D3-0', text: 'Stripe', kind: 'submit' } as any)
    let md = fs.files.get('/repo/design/DESIGN.md')!
    expect(md).toMatch(/- \[x\] Stripe or Adyen\? \[Stripe · Adyen\]\n {2}\*\*Resolved \d{4}-\d{2}-\d{2} \(human\): Stripe\*\*/)
    expect((await ui.find({ key: 'approve-design' })).props.dimColor).toBe(true)
    await ui.press({ key: 'sec-D4' })
    await ui.input({ key: 'dq-D4-0', text: 'Email first', kind: 'submit' } as any)
    md = fs.files.get('/repo/design/DESIGN.md')!
    expect(md).toContain('(human): Email first**')
    // Both answered: Approve sets status: approved and fills /planning.
    expect((await ui.find({ key: 'approve-design' })).props.dimColor).toBeUndefined()
    await ui.press({ key: 'approve-design' })
    md = fs.files.get('/repo/design/DESIGN.md')!
    expect(md).toContain('status: approved')
    expect(md).not.toContain('status: draft')
    expect(filled).toEqual(['/ticket-board:planning'])
    expect([...new Set(writes)]).toEqual(['/repo/design/DESIGN.md'])
    // Approved: the gate is gone.
    expect(await drawnText(ui)).not.toContain('approve-design')
    await ui.unmount()
  })

  test(`Design view without design/changes/ lists no history (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, p7Files({ changes: false }), { blank: true })
    await ui.find({ key: 'tab-design' })
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D1' })
    const drawn = await drawnText(ui)
    expect(drawn).not.toContain('History')
    expect(drawn).not.toContain('Design v2')
    await ui.unmount()
  })

  test(`no plan and no design: no tabs; /board plan and /board design show empty states (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    expect(await drawnText(ui)).not.toContain('tab-plan')
    await $.command.run({ command: 'board', args: 'plan' } as any)
    await ui.find({ key: 'empty-start' })
    expect(await drawnText(ui)).toContain('No plan yet')
    await $.command.run({ command: 'board', args: 'design' } as any)
    await ui.find({ key: 'empty-start' })
    expect(await drawnText(ui)).toContain('No design yet')
    await ui.press({ key: 'tab-board' })
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    if (surface === 'desktop') await ui.press({ key: 'show-all' })
    await ui.press({ key: 'open-0003' })
    await ui.find({ key: 'brainstorm' })
    await ui.unmount()
  })

  test(`design only: Plan tab shows an empty state pointing to /planning (${surface})`, async ($, on) => {
    const { ui, filled } = await boot($, on, surface, p7Files({ plan: null }), { blank: true })
    await ui.find({ key: 'tab-plan' })
    expect((await ui.find({ key: 'tab-plan' })).props.dimColor).toBe(true)
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'empty-planning' })
    expect(await drawnText(ui)).toContain('No plan yet. Plan the builds from the design with /ticket-board:planning.')
    await ui.press({ key: 'empty-planning' })
    expect(filled).toEqual(['/ticket-board:planning'])
    // The Design view still works without a plan.
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D1' })
    expect(await drawnText(ui)).toContain('unplanned')
    await ui.unmount()
  })

  test(`plan only: Design tab shows an empty state pointing to Start (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, p7Files({ design: null }), { blank: true })
    await ui.find({ key: 'tab-design' })
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'empty-start' })
    expect(await drawnText(ui)).toContain('No design yet. Write one with /design, or open Start.')
    await ui.press({ key: 'empty-start' })
    await ui.find({ type: 'Text', text: /Start a project/ })
    await ui.unmount()
  })

  test(`a malformed PLAN.md: the Plan tab warns, the board still works (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, p7Files({ plan: 'not a plan\n\nno phases\n', design: '## not a design\n' }), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'empty-start' })
    expect(await drawnText(ui)).toContain('⚠ design/PLAN.md has no phases or builds the board can read')
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'design-none' })
    const drawn = await drawnText(ui)
    expect(drawn).toContain('⚠ design: no front matter')
    expect(drawn).toContain('No numbered sections')
    await ui.press({ key: 'tab-board' })
    await ui.find({ type: 'Text', text: /Card form/ })
    await ui.unmount()
  })

  test(`a ready ticket keeps d for Back to draft: the Design tab has no hotkey there (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, p7Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.press({ key: 'pill-P2.2-0003' })
    await ui.find({ key: 'brainstorm' })
    expect(await hotkeyed(ui, 'd')).toEqual(['draft'])
    expect(await hotkeyed(ui, 'p')).toEqual(['tab-plan'])
    await ui.unmount()
  })
}

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

// Five builds: P1.1 already has ticket 0001; P1.2 needs P1.1 and P1.4; P1.3 needs P1.2; P1.5 needs P1.4.
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

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Accounts | S | — | D1 | sign in works | 0001 |
| P1.2 | Booking core | M | P1.1, P1.4 | D2 | a slot is booked | — |
| P1.3 | Calendar | S | P1.2 | D2, D3 | calendar shows bookings | — |
| P1.4 | Slots | S | — | D2 | slots listed | — |
| P1.5 | Reminders | S | P1.4 | D3 | reminder sent | — |
`

const T8_BOARD = `# Salon board

Design: design/DESIGN.md · Plan: design/PLAN.md

| #    | Ticket   | Status | Mode | Blocked by | Owner | Notes  |
|------|----------|--------|------|------------|-------|--------|
| 0001 | Accounts | done   | solo | —          | —     | merged |
`

function t8Files(): Record<string, string> {
  return {
    ...GIT_READY,
    'tickets/BOARD.md': T8_BOARD,
    '/repo/design/DESIGN.md': T8_DESIGN,
    '/repo/design/PLAN.md': T8_PLAN,
    'tickets/0001-accounts/rd.md': rmRd('0001', 'Accounts', 'Plan: P1.1\nDesign: D1@1'),
    'tickets/0001-accounts/eval.md': EVAL,
  }
}

type Spawned = { prompt: string; description: string; agentId: string }

/**
 * A fake agent spawner: records each writer start, counts live jobs, denies descriptions matching
 * `deny`. A spawn the pane starts gets no id back in tests, so each writer is also listed by
 * agent.list (as the pane finds it there).
 */
function fakeWriter(on: any, deny?: RegExp) {
  const spawned: Spawned[] = []
  const toasts: string[] = []
  const live = new Set<string>()
  const peak = { n: 0 }
  const listed: any[] = []
  AGENTS_OVERRIDE = listed
  on('agent.spawn', (_: unknown, e: { prompt: string; description: string }) => {
    if (deny !== undefined && deny.test(e.description)) return { deny: 'no agents left today' }
    const agentId = `w${spawned.length + 1}`
    spawned.push({ prompt: e.prompt, description: e.description, agentId })
    listed.push({ id: agentId, description: e.description, type: 'ticket-board:ticket-writer', status: 'running' })
    live.add(agentId)
    peak.n = Math.max(peak.n, live.size)
    return { model: 'sonnet', agentId }
  })
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.toast', (_: unknown, e: unknown) => (toasts.push(JSON.stringify(e)), { value: undefined }))
  /** The writer `agentId` finishes (or fails, with another reason). */
  const finish = async ($: any, agentId: string, reason = 'answer') => {
    live.delete(agentId)
    const a = listed.find(x => x.id === agentId)
    if (a !== undefined) a.status = reason === 'answer' ? 'completed' : 'failed'
    await $.turn.complete({ reason, answer: reason === 'answer' ? 'Wrote the ticket.' : '', isAborted: reason !== 'answer', agentId, turnId: `t-${agentId}`, durationMs: 1 } as any)
  }
  const done = () => {
    AGENTS_OVERRIDE = undefined
  }
  return { spawned, toasts, live, peak, finish, done }
}

async function until(check: () => boolean | Promise<boolean>, what: string, ms = 3000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error(`timed out waiting for ${what}`)
}

const rowsOf = (fs: { files: Map<string, string> }) => parseBoard(fs.files.get('tickets/BOARD.md')!)!.rows
const t8Row = (fs: { files: Map<string, string> }, n: string) => rowsOf(fs).find(r => r.number === n)!
const t8Folder = (fs: { files: Map<string, string> }, n: string) => [...fs.files.keys()].find(k => k.startsWith(`tickets/${n}-`) && k.endsWith('/rd.md'))!.replace(/\/rd\.md$/, '')

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Create tickets for a phase: 4 skeletons, Blocked by from Needs, Plan cells, 3 writers at a time (${surface})`, async ($, on) => {
    const w = fakeWriter(on)
    const { ui, fs } = await boot($, on, surface, t8Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'phase-create-P1' })
    // Every build without a ticket offers Create ticket; the one with a ticket does not.
    for (const id of ['P1.2', 'P1.3', 'P1.4', 'P1.5']) await ui.find({ key: `build-create-${id}` })
    expect(await drawnText(ui)).not.toContain('build-create-P1.1')
    await ui.press({ key: 'phase-create-P1' })
    await until(async () => (await drawnText(ui)).includes('build-queued-P1.5'), 'the 4th build to show queued')
    for (const id of ['P1.2', 'P1.3', 'P1.4']) await ui.find({ key: `build-writing-${id}` })
    // Keys stay unique with the queued and writing states drawn.
    const keys = [...(await drawnText(ui)).matchAll(/"key":"([^"]+)"/g)].map(m => m[1]!)
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])

    // 4 skeleton folders and 4 draft rows; the existing ticket is skipped and the toast says so.
    const made = ['0002', '0003', '0004', '0005']
    for (const n of made) {
      expect(fs.files.has(`${t8Folder(fs, n)}/eval.md`)).toBe(true)
      expect(t8Row(fs, n).status).toBe('draft')
      expect(t8Row(fs, n).mode).toBe('solo')
    }
    expect(rowsOf(fs).length).toBe(5)
    // Needed builds in the batch come first: P1.4 → 0002, P1.2 → 0003, P1.3 → 0004, P1.5 → 0005.
    expect(t8Row(fs, '0002').title).toBe('Slots')
    expect(t8Row(fs, '0003').title).toBe('Booking core')
    expect(t8Row(fs, '0003').blockedBy).toEqual(['0001', '0002'])
    expect(t8Row(fs, '0004').blockedBy).toEqual(['0003'])
    expect(t8Row(fs, '0005').blockedBy).toEqual(['0002'])
    expect(t8Row(fs, '0005').notes).toContain('AI queued')
    const plan = fs.files.get('/repo/design/PLAN.md')!
    for (const [id, n] of [['P1.4', '0002'], ['P1.2', '0003'], ['P1.3', '0004'], ['P1.5', '0005']])
      expect(plan.split('\n').find(l => l.startsWith(`| ${id} |`))!.trim().endsWith(`| ${n} |`)).toBe(true)
    expect(plan).toContain('| P1.1 | Accounts | S | — | D1 | sign in works | 0001 |')
    let drawn = await drawnText(ui)
    expect(drawn).toContain('Created 4 draft tickets from P1 (0002–0005)')
    expect(drawn).toContain('skipped 1 build that already has a ticket')
    // The Plan view shows the new ticket numbers.
    for (const [id, n] of [['P1.4', '0002'], ['P1.2', '0003'], ['P1.3', '0004'], ['P1.5', '0005']]) await ui.find({ key: `pill-${id}-${n}` })
    // The draft rows are on the board.
    await ui.press({ key: 'tab-board' })
    await ui.find({ type: 'Text', text: /Reminders/ })
    for (const title of ['Slots', 'Booking core', 'Calendar']) expect(await drawnText(ui)).toContain(title)
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'build-queued-P1.5' })

    // Never more than 3 writers live; the 4th waits until one ends.
    expect(w.spawned.length).toBe(3)
    expect(w.peak.n).toBe(3)
    expect(w.spawned.map(s => s.description)).toEqual(['Write ticket 0002 (P1.4)', 'Write ticket 0003 (P1.2)', 'Write ticket 0004 (P1.3)'])
    // The brief: covered sections' Done when lines, phase Goal and Exit, Plan and Design lines.
    const brief = w.spawned[2]!.prompt
    for (const part of ['Phase goal: people can book a slot.', 'Phase exit: a booked slot shows on the calendar', '- a free slot can be booked', '- a reminder mail goes out a day before', 'Plan: P1.3', 'Design: D2@2, D3@1', 'Docs and README updated', 'README.md'])
      expect(brief).toContain(part)

    // The writer for 0002 finishes with a complete ticket: the 4th build starts.
    await w.finish($, 'w1')
    await until(() => w.spawned.length === 4, 'the 4th writer to start')
    expect(w.spawned[3]!.description).toBe('Write ticket 0005 (P1.5)')
    expect(w.peak.n).toBe(3)
    await until(async () => (await drawnText(ui)).includes('build-writing-P1.5'), 'P1.5 to show writing')
    expect(t8Row(fs, '0002').notes).toContain('AI draft done')
    expect(t8Row(fs, '0002').notes).not.toContain('missing')
    drawn = await drawnText(ui)
    expect(drawn).not.toContain('build-queued-')
    // Nothing became ready.
    expect(rowsOf(fs).filter(r => r.status === 'ready')).toEqual([])
    w.done()
    await ui.unmount()
  })

  test(`a plan ticket's files: Plan and Design lines, one check per Done when, docs gaps reported (${surface})`, async ($, on) => {
    const w = fakeWriter(on)
    const { ui, fs } = await boot($, on, surface, t8Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'build-create-P1.3' })
    await ui.press({ key: 'build-create-P1.3' })
    await until(() => w.spawned.length === 1, 'the writer to start')
    const folder = t8Folder(fs, '0002')
    const rd = fs.files.get(`${folder}/rd.md`)!
    expect(rd).toContain('# 0002 — Calendar')
    expect(rd).toContain('Type: feature\nPlan: P1.3\nDesign: D2@2, D3@1\n')
    expect(rd).toContain('## Docs\n- README.md')
    const ev = fs.files.get(`${folder}/eval.md`)!
    expect(ev).toContain('1. a free slot can be booked')
    expect(ev).toContain('2. a taken slot cannot be booked twice')
    expect(ev).toContain('3. a reminder mail goes out a day before')
    expect(ev).toContain('4. Docs and README updated')
    expect(ev.match(/- Run: /g)?.length).toBe(3)
    expect(ev.match(/- Pass: /g)?.length).toBe(3)
    // The writer drops ## Docs and the docs check: the pane reports both in the row Notes and the toast.
    fs.files.set(`${folder}/rd.md`, rd.replace(/## Docs\n[^#]*/, ''))
    fs.files.set(`${folder}/eval.md`, '# Eval — 0002 — Calendar\n\n## Checks\n1. a free slot can be booked\n   - Run: `npm test`\n   - Pass: exit 0\n')
    fs.mtimes.set(`${folder}/rd.md`, 900)
    fs.mtimes.set(`${folder}/eval.md`, 901)
    await w.finish($, 'w1')
    const notes = t8Row(fs, '0002').notes
    expect(notes).toContain('missing ## Docs naming README.md')
    expect(notes).toContain('Docs and README updated')
    expect(w.toasts.join(' ')).toContain('missing ## Docs naming README.md')
    expect(await drawnText(ui)).toContain('missing ## Docs naming README.md')
    expect(t8Row(fs, '0002').status).toBe('draft')
    w.done()
    await ui.unmount()
  })

  test(`one build whose needed build is not selected; a failed writer can be created again (${surface})`, async ($, on) => {
    const w = fakeWriter(on)
    const { ui, fs } = await boot($, on, surface, t8Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'build-create-P1.2' })
    await ui.press({ key: 'build-create-P1.2' })
    await until(() => w.spawned.length === 1, 'the writer to start')
    // P1.2 needs P1.1 (ticket 0001) and P1.4 (no ticket, not selected).
    const row = t8Row(fs, '0002')
    expect(row.blockedBy).toEqual(['0001'])
    expect(row.notes).toContain('needs P1.4')
    expect(fs.files.get('/repo/design/PLAN.md')!).toContain('| P1.4 | Slots | S | — | D2 | slots listed | — |')
    // The writer fails: the build shows the reason and offers Create again on the same ticket.
    await w.finish($, 'w1', 'error')
    await until(async () => (await drawnText(ui)).includes('failed: error'), 'the failure to show')
    expect(t8Row(fs, '0002').notes).toContain('needs P1.4')
    await ui.find({ key: 'build-retry-P1.2' })
    await ui.press({ key: 'build-retry-P1.2' })
    await until(() => w.spawned.length === 2, 'the writer to start again')
    expect(w.spawned[1]!.description).toBe('Write ticket 0002 (P1.2)')
    await until(async () => (await drawnText(ui)).includes('build-writing-P1.2'), 'P1.2 to show writing')
    expect(await drawnText(ui)).not.toContain('failed: error')
    // Still one ticket for the build, never ready.
    expect(rowsOf(fs).length).toBe(2)
    expect(rowsOf(fs).filter(r => r.status === 'ready')).toEqual([])
    w.done()
    await ui.unmount()
  })

  test(`a writer that cannot start shows why; Create tickets for all not started (${surface})`, async ($, on) => {
    const w = fakeWriter(on, /P1\.4/)
    const { ui, fs } = await boot($, on, surface, t8Files(), { blank: true })
    await ui.find({ key: 'tab-plan' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'plan-create-all' })
    expect(await drawnText(ui)).toContain('Create tickets for all not started (4)')
    await ui.press({ key: 'plan-create-all' })
    await until(async () => (await drawnText(ui)).includes('failed: no agents left today'), 'the start failure to show')
    await ui.find({ key: 'build-retry-P1.4' })
    // The denied one does not hold a slot: the other three all start.
    expect(w.spawned.map(s => s.description)).toEqual(['Write ticket 0003 (P1.2)', 'Write ticket 0004 (P1.3)', 'Write ticket 0005 (P1.5)'])
    expect(t8Row(fs, '0002').notes).toContain('failed')
    expect(rowsOf(fs).filter(r => r.status === 'draft').length).toBe(4)
    expect(await drawnText(ui)).not.toContain('plan-create-all')
    w.done()
    await ui.unmount()
  })
}

test('the plan queue survives a redraw and a trip to the board and back (desktop)', async ($, on) => {
  const w = fakeWriter(on)
  const { ui } = await boot($, on, 'desktop', t8Files(), { blank: true })
  await ui.find({ key: 'tab-plan' })
  await ui.press({ key: 'tab-plan' })
  await ui.press({ key: 'phase-create-P1' })
  await until(async () => (await drawnText(ui)).includes('build-queued-P1.5'), 'the 4th build to show queued')
  await ui.press({ key: 'tab-board' })
  await ui.find({ type: 'Text', text: /Booking core/ })
  await ui.press({ key: 'tab-plan' })
  await ui.find({ key: 'build-queued-P1.5' })
  await w.finish($, 'w2')
  await until(() => w.spawned.length === 4, 'the queued writer to start')
  w.done()
  await ui.unmount()
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
What: book a slot.

## D3 · Payments
Rev: 2
What: charge a card.
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
| P1.1 | Payments | M | — | D1, D3 | a card is charged | 0001, 0002, 0003, 0004, 0005 |
`

const T15_BOARD = `# Salon board

Design: design/DESIGN.md · Plan: design/PLAN.md

| #    | Ticket          | Status      | Mode | Blocked by | Owner | Notes |
|------|-----------------|-------------|------|------------|-------|-------|
| 0001 | Old payments    | done        | solo | —          | —     | merged |
| 0002 | New payments    | draft       | solo | —          | —     | |
| 0003 | Refunds         | in-progress | solo | —          | —     | |
| 0004 | Odd design line | draft       | solo | —          | —     | |
| 0005 | Unknown section | draft       | solo | —          | —     | |

Status flow: draft → ready → in-progress → in-check → done
`

const T15_NOTE = `---
change: design-v2
date: 2026-11-10
design-version: 2
---
# Design v2

## Why
Cards only.

## Changes
- Changed D3 (Rev 1 → 2): cards only, no invoices

## Follow-ups
- Replan: P1.1
`

const T15_TICKETS: [string, string, string, string][] = [
  ['0001', 'old-payments', 'Old payments', 'Plan: P1.1\nDesign: D1@1, D3@1'],
  ['0002', 'new-payments', 'New payments', 'Plan: P1.1\nDesign: D3@2'],
  ['0003', 'refunds', 'Refunds', 'Plan: P1.1\nDesign: D3@1'],
  ['0004', 'odd-design-line', 'Odd design line', 'Plan: P1.1\nDesign: D3@two, @@,, ???'],
  ['0005', 'unknown-section', 'Unknown section', 'Plan: P1.1\nDesign: D9@1'],
]

function t15Files(): Record<string, string> {
  const out: Record<string, string> = {
    ...GIT_READY,
    'tickets/BOARD.md': T15_BOARD,
    '/repo/design/DESIGN.md': T15_DESIGN,
    '/repo/design/PLAN.md': T15_PLAN,
    '/repo/design/changes/2026-11-10-design-v2.md': T15_NOTE,
  }
  for (const [n, slug, title, head] of T15_TICKETS) {
    out[`tickets/${n}-${slug}/rd.md`] = rmRd(n, title, head)
    out[`tickets/${n}-${slug}/eval.md`] = EVAL
  }
  return out
}

const T15_CHIP = 'Written against D3 rev 1, now rev 2 — Review'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`stale chip on the board rows and the alert; Review opens the ticket page only (${surface})`, async ($, on) => {
    const spawned: string[] = []
    on('agent.spawn', (_: unknown, e: { description: string }) => (spawned.push(e.description), { deny: 'no agents in this test' }))
    const { ui, fs, writes, filled } = await boot($, on, surface, t15Files(), { blank: true })
    await ui.find({ type: 'Text', text: /Old payments/ })
    const before = new Map(fs.files)
    let drawn = await drawnText(ui)
    // D3@1 against Rev 2 is stale (the done and the in-progress ticket too); D3@2 is not.
    expect(drawn).toContain('stale-0001-D3')
    expect(drawn).toContain('stale-0003-D3')
    expect(drawn).not.toContain('stale-0002')
    expect(drawn).toContain(T15_CHIP)
    // A malformed Design: line and an unknown section give no flag.
    expect(drawn).not.toContain('stale-0004')
    expect(drawn).not.toContain('stale-0005')
    // The stale tickets count in the board alerts: the only roadmap warning here.
    expect(drawn).toContain('⚠ 2 stale tickets: 0001, 0003')
    // Review on the done ticket's row opens its ticket page.
    await ui.press({ key: 'stale-0001-D3' })
    await ui.find({ key: 'review-D3' })
    drawn = await drawnText(ui)
    expect(drawn).toContain(T15_CHIP)
    expect(drawn).not.toContain('stale-0001-D3')
    // Review on the ticket page stays on the ticket page.
    await ui.press({ key: 'review-D3' })
    await ui.find({ key: 'review-D3' })
    // No job, no prompt, no file written: the done ticket's files and board row are byte-identical.
    expect(spawned).toEqual([])
    expect(filled).toEqual([])
    expect(writes).toEqual([])
    expect([...fs.files]).toEqual([...before])
    expect(fs.files.get('tickets/0001-old-payments/rd.md')).toBe(rmRd('0001', 'Old payments', 'Plan: P1.1\nDesign: D1@1, D3@1'))
    expect(fs.files.get('tickets/BOARD.md')).toBe(T15_BOARD)
    await ui.unmount()
  })

  test(`ticket pages: D3@2 and malformed Design: lines show no stale chip (${surface})`, async ($, on) => {
    const { ui, writes } = await boot($, on, surface, t15Files(), { blank: true })
    await ui.find({ type: 'Text', text: /Old payments/ })
    for (const n of ['0002', '0004', '0005']) {
      await ui.press({ key: `open-${n}` })
      await ui.find({ key: 'back' })
      const drawn = await drawnText(ui)
      expect(drawn).not.toContain('Written against')
      expect(drawn).not.toContain('review-D')
      await ui.press({ key: 'back' })
    }
    await ui.press({ key: 'open-0003' })
    await ui.find({ key: 'review-D3' })
    expect(await drawnText(ui)).toContain(T15_CHIP)
    expect(writes).toEqual([])
    await ui.unmount()
  })

  test(`Design history reads the redesign note's changed sections and new Revs (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface, t15Files(), { blank: true })
    await ui.find({ key: 'tab-design' })
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D3' })
    expect(await drawnText(ui)).toContain('Design v2 · 2026-11-10 · D3 now rev 2  2026-11-10-design-v2.md')
    await ui.unmount()
  })
}

// ---------- 0018: contrast in every color scheme ----------
//
// The model of what the desktop draws:
// - Text in a raw color is drawn in that color over every backgroundColor above it (rgba composited).
// - Text in a theme key, and every native control (a non-primary Button, whatever its children say;
//   a Link), is drawn in the APP's colors. Those read only where the ground under them is the app's
//   own (the app's backdrop with see-through washes, or a plate in `inverseText`, the app's opposite
//   of its text color). On a painted glass backdrop they are unknown, so they fail.
// - A primary Button is the host's filled button: its own fill and label, readable anywhere.
// The app itself can be in light or dark mode: every pair is checked in both.
const APP = {
  light: { ground: '#FFFFFF', inverseText: '#FFFFFF' },
  dark: { ground: '#262624', inverseText: '#000000' },
} as const
const SCHEME_BASE: Record<string, string> = { dark: '#0A0F1E', light: '#F8FAFC' }
const THEME_KEYS = new Set(['text', 'inverseText', 'inactive', 'subtle', 'suggestion', 'remember', 'success', 'error', 'warning', 'merged', 'claude', 'permission', 'planMode', 'autoAccept', 'promptBorder', 'bashBorder', 'ide'])

type Rgba = [number, number, number, number]
function parseColor(c: string): Rgba | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map(x => x + x).join('') : hex[1]!
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(c.replace(/\s+/g, ''))
  if (m) {
    const p = m[1]!.split(',').map(Number)
    return [p[0]!, p[1]!, p[2]!, p[3] ?? 1]
  }
  return undefined
}
const over = (top: Rgba, under: Rgba): Rgba => [0, 1, 2].map(i => top[i]! * top[3] + under[i]! * (1 - top[3])).concat(1) as Rgba
const lum = (c: Rgba) => {
  const ch = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
}
const ratio = (a: Rgba, b: Rgba) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

/** The ground under a node: its composited color, and whether it is still the app's own ground. */
type Ground = { rgb: Rgba | undefined; isApp: boolean }
function paint(g: Ground, bg: unknown, mode: keyof typeof APP): Ground {
  if (typeof bg !== 'string' || bg === '') return g
  if (bg === 'inverseText') return { rgb: parseColor(APP[mode].inverseText), isApp: true }
  if (THEME_KEYS.has(bg)) return { rgb: undefined, isApp: false }
  const c = parseColor(bg)
  if (c === undefined || g.rgb === undefined) return { rgb: undefined, isApp: false }
  // A see-through wash keeps the app's ground; a solid paint replaces it.
  return { rgb: over(c, g.rgb), isApp: g.isApp && c[3] <= 0.2 }
}

/** Every Text, Button and Link in a drawn tree that does not reach its contrast floor. */
function contrastFailures(tree: unknown, scheme: string): string[] {
  const out: string[] = []
  for (const mode of ['light', 'dark'] as const) {
    const base = SCHEME_BASE[scheme]
    const start: Ground = base === undefined ? { rgb: parseColor(APP[mode].ground), isApp: true } : { rgb: parseColor(base), isApp: false }
    type Style = { color?: string; size?: string; weight?: string; dim?: boolean }
    const textOf = (n: any): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(textOf).join('') : n?.children ? textOf(n.children) : '')
    const visit = (n: any, g: Ground, st: Style): void => {
      if (n === null || n === undefined || typeof n === 'boolean') return
      if (Array.isArray(n)) return n.forEach(c => visit(c, g, st))
      if (typeof n === 'string') {
        if (n.trim() === '') return
        const where = `${scheme}/app-${mode}: "${n.slice(0, 40)}"`
        const c = st.color
        if (c === undefined || THEME_KEYS.has(c)) {
          if (!g.isApp) out.push(`${where} in app color ${c ?? '(none)'} on painted glass`)
          return
        }
        const fg = parseColor(c)
        if (fg === undefined || g.rgb === undefined) return void out.push(`${where} color ${c} on an unknown background`)
        const small = st.size === 'caption' || st.size === 'footnote'
        const large = st.size === 'heading' || st.size === 'title'
        const bold = st.weight === 'bold' || st.weight === 'semibold'
        const floor = large || (bold && !small) || st.dim === true ? 3 : 4.5
        const r = ratio(over(fg, g.rgb), g.rgb)
        if (r < floor) out.push(`${where} ${c} is ${r.toFixed(2)}:1, needs ${floor}:1`)
        return
      }
      const p = n.props ?? {}
      if (n.type === 'Button' || n.type === 'Link') {
        const isFilled = n.type === 'Button' && p.variant === 'primary' && p.plain !== true
        if (!isFilled && !g.isApp) out.push(`${scheme}/app-${mode}: ${n.type} "${p.label ?? textOf(n)}" (key ${p.key ?? '-'}) is drawn in the app's colors on painted glass`)
        return
      }
      if (n.type === 'Box') return visit(n.children, paint(g, p.backgroundColor, mode), st)
      if (n.type === 'Text') {
        const next: Style = {
          color: p.color ?? st.color,
          size: p.size ?? st.size,
          weight: p.weight ?? (p.bold === true ? 'semibold' : st.weight),
          dim: p.dimColor === true || st.dim,
        }
        return visit(n.children, paint(g, p.backgroundColor, mode), next)
      }
      // Svg, Input, Select: drawn by their own rules.
    }
    visit(tree, start, {})
  }
  return [...new Set(out)]
}

test('contrast floor: the reproduction model catches app-colored controls on painted glass', () => {
  const tree = { type: 'Box', props: {}, children: [{ type: 'Button', props: { key: 'x', label: 'Plan', variant: 'secondary' } }, { type: 'Text', props: { color: '#EEF2FF' }, children: ['pale'] }] }
  expect(contrastFailures(tree, 'light').length).toBe(4)
  const plated = { type: 'Box', props: { backgroundColor: 'inverseText' }, children: [{ type: 'Button', props: { key: 'x', label: 'Plan' } }] }
  expect(contrastFailures(plated, 'light')).toEqual([])
  expect(contrastFailures({ type: 'Button', props: { key: 'n', label: 'New', variant: 'primary' } }, 'light')).toEqual([])
})

/** A README with every markdown part the glass reader draws: code, a table, a quote, a callout, a list, `status` pills. */
const CONTRAST_README = `# Salon

Book a chair at a small salon, with \`ready\` and \`blocked\` work and \`npm test\` inline.

## Install

\`\`\`
npm install
\`\`\`

| Name | Value |
|------|-------|
| a | **b** |
| c | *d* |

> A quoted line.

Decision 2026-11-10 (human): keep it simple.

Note: a lead line.

(an aside)

- [x] done item
- [ ] open item
- a [link](https://example.com)
`

for (const scheme of ['auto', 'dark', 'light'] as const) {
  const checker = () => {
    const failures: string[] = []
    const check = async (ui: any, view: string) => {
      for (const f of contrastFailures(await ui.drawn(), scheme)) failures.push(`[${view}] ${f}`)
    }
    return { failures, check }
  }
  const store = () => new Map<string, unknown>([['colors', scheme]])

  test(`every Button, tab, chip and Text is readable in the ${scheme} scheme: board, ticket, Plan, Design, new, README (desktop)`, async ($, on) => {
    const { failures, check } = checker()
    const { ui } = await boot($, on, 'desktop', { ...p7Files(), '/repo/README.md': CONTRAST_README }, { blank: true, store: store() })
    await ui.find({ key: 'tab-plan' })
    expect(JSON.stringify(await ui.drawn())).toContain(scheme === 'auto' ? 'Colors: app' : `Colors: ${scheme}`)
    await check(ui, 'board')
    await ui.press({ key: 'open-0005' })
    await ui.find({ key: 'back' })
    await check(ui, 'ticket')
    await ui.press({ key: 'back' })
    await ui.press({ key: 'tab-plan' })
    await ui.find({ key: 'phase-toggle-P1' })
    await check(ui, 'plan')
    await ui.press({ key: 'tab-design' })
    await ui.find({ key: 'sec-D1' })
    await check(ui, 'design')
    await ui.press({ key: 'tab-board' })
    await ui.press({ key: 'new' })
    await ui.find({ type: 'Text', text: /What happens next/ })
    await check(ui, 'new')
    await ui.press({ key: 'back' })
    await ui.press({ key: 'readme' })
    await check(ui, 'readme')
    await ui.unmount()
    expect(failures).toEqual([])
  })

  test(`every Button and Text is readable in the ${scheme} scheme: questions (desktop)`, async ($, on) => {
    const { failures, check } = checker()
    const { ui } = await boot($, on, 'desktop', {}, { store: store() })
    await ui.find({ type: 'Text', text: /Dark mode/ })
    await check(ui, 'board')
    await ui.press({ key: 'ans-0003' })
    await check(ui, 'questions')
    await ui.unmount()
    expect(failures).toEqual([])
  })

  test(`every Button and Text is readable in the ${scheme} scheme: Start (desktop)`, async ($, on) => {
    const { failures, check } = checker()
    const { ui } = await boot($, on, 'desktop', { '/repo/src/app.ts': 'export {}\n' }, { blank: true, store: store() })
    await ui.find({ type: 'Text', text: /Start a project/ })
    await check(ui, 'start')
    await ui.unmount()
    expect(failures).toEqual([])
  })
}

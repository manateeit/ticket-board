import { expect, test, type TestBody } from 'claude-code/testing'

import { roadmap, ticketRef } from '../hooks/core/roadmap'
import { boardCols } from '../hooks/desk'
import { railSvg } from '../hooks/glass'

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

const PANE = {
  plugin: 'ticket-board',
  component: 'Pane',
  requestId: 'ticket-board',
  props: { title: 'Tickets', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// `gate.wait`, while set, holds every fs.list: a refresh stays in flight until the test lets it go.
type BootOptions = { blank?: boolean; store?: Map<string, unknown>; dirs?: string[]; gate?: { wait?: Promise<void> } }

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
  on('agent.list', () => ({ value: AGENTS_OVERRIDE ?? [
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
    const text = fs.files.get(fs.clean(e.path)) ?? template
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
  await $.session.start({ cwd: '/repo', surface, isInteractive: true })
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
    expect(filled[2]).toContain('/design Draft a design from the existing code')
    await ui.input({ key: 'start-idea', text: 'A booking app for small salons', kind: 'submit' } as any)
    await ui.press({ key: 'start-brainstorm' })
    expect(filled[3]).toBe('/brainstorm A booking app for small salons')
    await ui.press({ key: 'start-design' })
    expect(filled[4]).toBe('/design A booking app for small salons')
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
        expect(filled).toEqual(['/design design/brief.md'])
      }
      if (stage.step === 'Plan') {
        await ui.press({ key: 'start-plan' })
        expect(filled).toEqual(['/planning design/DESIGN.md'])
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
  expect(drawn).toContain('Written against D3 rev 1, now rev 2')
  expect(drawn).not.toContain('Review')
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

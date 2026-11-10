import { expect, test, type TestBody } from 'claude-code/testing'

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

type BootOptions = { blank?: boolean; store?: Map<string, unknown> }

async function boot($: Parameters<TestBody>[0], on: any, surface: 'terminal' | 'desktop', extra: Record<string, string> = {}, opts: BootOptions = {}) {
  const fs = fakeFs()
  if (opts.blank === true) fs.files.clear()
  for (const [k, v] of Object.entries(extra)) fs.files.set(k, v)
  const filled: string[] = []
  const calls: string[] = []
  const writes: string[] = []
  const store = opts.store ?? new Map<string, unknown>()
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'board' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ deny: 'no timers in tests' }))
  on('agent.list', () => ({ value: AGENTS_OVERRIDE ?? [
    { id: 'a1', description: 'Build ticket 0002', type: 'worker', status: 'running', name: 'worker-0002' },
    { id: 'a2', description: 'Check 0001', type: 'checker', status: 'completed' },
  ] }))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => (store.set(e.key, e.value), { value: undefined }))
  on('fs.list', (_: unknown, e: { path: string }) => {
    calls.push(`list ${e.path} -> ${fs.list(e.path).map(x => x.name).join(',')}`)
    return { value: fs.list(e.path) }
  })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: fs.files.has(fs.clean(e.path)) || fs.list(e.path).length > 0 }))
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
  const ui = await $.ui.mount({ ...PANE, surface } as any)
  return { ui, fs, filled, calls, writes, store }
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

import { expect, test, type TestBody } from 'claude-code/testing'

const BOARD = `# Ticket board

| #    | Ticket                        | Status | Mode | Blocked by | Owner   | Notes |
|------|-------------------------------|--------|------|------------|---------|-------|
| 0001 | Health endpoint               | done   | solo | —          | —       | merged |
| 0002 | CSV export of the orders list | ready  | solo | 0001       | —       | |
| 0003 | Dark mode for settings page   | draft  | solo | —          | —       | AI draft done · 1 open question |
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
    ['tickets/0001-health-endpoint/rd.md', rd('0001', 'Health endpoint', '- none')],
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

const PANE = {
  plugin: 'ticket-board',
  component: 'Pane',
  requestId: 'ticket-board',
  props: { title: 'Tickets', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

async function boot($: Parameters<TestBody>[0], on: any, surface: 'terminal' | 'desktop') {
  const fs = fakeFs()
  const filled: string[] = []
  const calls: string[] = []
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'board' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ deny: 'no timers in tests' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.list', (_: unknown, e: { path: string }) => {
    calls.push(`list ${e.path} -> ${fs.list(e.path).map(x => x.name).join(',')}`)
    return { value: fs.list(e.path) }
  })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: fs.files.has(fs.clean(e.path)) || fs.list(e.path).length > 0 }))
  on('fs.read', (_: unknown, e: { path: string }) => {
    const text = fs.files.get(fs.clean(e.path))
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_: unknown, e: { path: string; text: string }) => {
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
  return { ui, fs, filled, calls }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`board lists tickets that need the person (${surface})`, async ($, on) => {
    const { ui } = await boot($, on, surface)
    await ui.find({ type: 'Text', text: /Dark mode for settings page/ })
    expect(JSON.stringify(await ui.drawn())).not.toContain('Health endpoint')
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
    await ui.select({ key: 'show', value: 'all' })
    await ui.press({ key: 'open-0002' })
    await ui.press({ key: 'run' })
    expect(filled).toEqual(['Run ticket 0002.'])
    await ui.unmount()
  })
}

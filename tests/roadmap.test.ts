import { expect, test } from 'claude-code/testing'

import { STATUSES, parseBoard } from '../hooks/core/board'
import {
  allBuilds,
  bindFromBoard,
  buildState,
  checks,
  coverage,
  hill,
  linkTickets,
  parseDesign,
  parsePlan,
  progress,
  roadmap,
  ticketRef,
  type Build,
  type TicketRef,
} from '../hooks/core/roadmap'
import { parseDesignRefs, parsePlanRef } from '../hooks/core/ticket'
import { answerDesignQuestion } from '../hooks/core/designfile'

// ── Fixtures ──────────────────────────────────────────────────────────────

const DESIGN = `---
design: Shop
version: 3              # bumped by every redesign
status: approved
updated: 2026-11-10
---
# Shop: design

## Vision
Sell hats online.

## Non-goals
- No shoes

## D1 · Catalogue
Rev: 1
Why: People need to see the hats.
What: A list of hats
with prices.
Done when:
- WHEN the page opens THE SYSTEM SHALL list every hat
- Prices show

## D2 — Cart
Rev: 1
Why: People buy several hats.
What: A cart.
Done when:
- Adding a hat shows it in the cart

## d3: Checkout
Rev: 2
Why: Money.
What: A checkout form and payment.
Done when:
- An order is paid

### Open questions
- [ ] Which payment provider?
- [x] Guest checkout?
  **Resolved 2026-11-09 (human): yes**

## D4 · Accounts
Rev: 1
Why: Returning buyers.
What: Sign in.

## D5 · ~~Gift cards~~
Status: dropped in v3 (see changes/2026-11-10-design-v3.md)

## D6 · Search
What: Find a hat by name.

## D7 · Reviews
Rev: 1
What: Stars and comments.
`

const PLAN = `---
plan: Shop
design-version: 3
updated: 2026-11-10
---
# Shop: plan

## P1 · Basics
Goal: people can fill a cart.
Appetite: 1 week
Exit: a cart holds two hats.

| # | Build | Size | Needs | Covers | Done when | Ticket | Status |
|---|---|---|---|---|---|---|---|
| P1.1 | Catalogue page | S | — | D1 | list shows | 0001 | |
| P1.2 | Cart | M | P1.1 | D2 | add works | 0002 | |
| P1.3 | Gift cards | M | — | D5 | not applicable | — | dropped |
| P1.4 | Wishlist | L | — | D2 | later | — | deferred |

## P2 · Checkout
Goal: people can pay.
Appetite: 2 weeks
Exit: a real order is paid.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Checkout form | L | P1.2 | D3 | form submits | 0003 |
| P2.2 | Payment | M | P2.1 | D3 | card charged | 0004 |
| P2.3 | Receipts | | P1.2 | D3 | email sent | 0005 |
| P2.4 | Search index | S | — | D6 | index built | 0006, 0007 |
| P2.5 | Search UI | M | P2.4 | D6 | box works | — |
| P2.6 | Search ranking | S | — | D6 | best first | — |

## P3 · Polish
Goal: people trust the shop.
Appetite: 1 week
Exit: reviews show.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P3.1 | Reviews | M | P2.1 | D7 | stars show | 0009 |
`

const BOARD = `# Ticket board

Design: design/DESIGN.md · Plan: design/PLAN.md

| #    | Ticket   | Status      | Mode | Blocked by | Owner | Notes |
|------|----------|-------------|------|------------|-------|-------|
| 0001 | A        | done        | solo | —          | —     | |
| 0002 | B        | done        | solo | —          | —     | |
| 0003 | C        | in-progress | solo | —          | —     | |
| 0004 | D        | blocked     | solo | 0003       | —     | |
| 0005 | E        | ready       | solo | —          | —     | |
| 0006 | F        | done        | solo | —          | —     | |
| 0007 | G        | draft       | solo | —          | —     | |
| 0008 | H        | done        | solo | —          | —     | |
| 0009 | I        | ready       | solo | —          | —     | |
| 0010 | J        | draft       | solo | —          | —     | |
`

const rd = (n: string, head: string) => `# ${n} — Ticket\n\nType: feature\n${head}\n\n## What\n\nPlan: not this one\n`

const RDS: Record<string, string> = {
  '0001': rd('0001', 'Plan: P1.1\nDesign: D1@1'),
  '0002': rd('0002', ''),
  '0003': rd('0003', 'Plan: P2.1\nDesign: D3@1'),
  '0004': rd('0004', 'Plan: P2.2\nDesign: D3@2'),
  '0005': rd('0005', 'Plan: P2.3\nDesign: D3@2'),
  '0006': rd('0006', ''),
  '0007': rd('0007', 'Plan: P2.4'),
  '0008': rd('0008', 'Plan: P2.6\nDesign: D6'),
  '0009': rd('0009', 'Plan: P3.1\nDesign: D7@1'),
  '0010': rd('0010', 'Type: bug'),
}

const ticketsOf = (board: string, rds: Record<string, string | undefined>): TicketRef[] =>
  parseBoard(board)!.rows.map(r => ticketRef(r, rds[r.number]))

const full = () => {
  const design = parseDesign(DESIGN)
  const plan = parsePlan(PLAN)
  const links = linkTickets(plan, design, ticketsOf(BOARD, RDS))
  return { design, plan, links }
}

// ── Blank project ─────────────────────────────────────────────────────────

test('roadmap: blank project gives empty results and no checks', () => {
  const empty = '# Ticket board\n\n| # | Ticket | Status | Mode | Blocked by | Owner | Notes |\n|---|---|---|---|---|---|---|\n'
  const bind = bindFromBoard(empty, () => undefined)
  expect(bind.isBlank).toBe(true)
  expect(bind.isBound).toBe(false)
  expect(bind.designPath).toBeUndefined()
  expect(bind.warnings).toEqual([])
  const design = parseDesign(bind.design)
  const plan = parsePlan(bind.plan)
  expect(design.sections).toEqual([])
  expect(design.warnings).toEqual([])
  expect(plan.phases).toEqual([])
  expect(plan.warnings).toEqual([])
  const links = linkTickets(plan, design, ticketsOf(empty, {}))
  const p = progress(plan, links)
  expect(p.planPct).toBe(0)
  expect(p.countedWeight).toBe(0)
  expect(p.phases).toEqual([])
  expect(p.currentPhase).toBeUndefined()
  expect(p.nextUp).toBeUndefined()
  const c = coverage(design, plan, links)
  expect(c.sections).toEqual([])
  expect(c.designPct).toBe(0)
  expect(hill(design, plan, links)).toEqual([])
  expect(checks(design, plan, links)).toEqual([])
  const all = roadmap(undefined, undefined, [])
  expect(all.isBlank).toBe(true)
  expect(all.checks).toEqual([])
  expect(parseDesign('').sections).toEqual([])
  expect(parsePlan('   \n').phases).toEqual([])
})

// ── Where a section's Open questions end (0039) ───────────────────────────

const NOTES_AFTER = `## D3 · Payments
Rev: 1
What: Take a deposit.

### Open questions
- [ ] Stripe or Adyen?

### Notes
- Adyen has a sandbox
- Ask the owner about fees

## D4 · Reminders
Rev: 1
`

test('roadmap: a ### subsection after Open questions ends them, reader and writer agree (0039)', () => {
  const d3 = parseDesign(NOTES_AFTER).sections[0]!
  expect(d3.questions).toEqual([{ text: 'Stripe or Adyen?', isResolved: false }])
  const after = answerDesignQuestion(NOTES_AFTER, 'D3', d3.questions[0]!.text, 'Stripe', '2026-11-12')
  expect(after).toContain('- [x] Stripe or Adyen?\n  **Resolved 2026-11-12 (human): Stripe**\n\n### Notes\n- Adyen has a sandbox')
  expect(parseDesign(after).sections[0]!.questions).toEqual([{ text: 'Stripe or Adyen?', isResolved: true }])
  // Without a later subsection the block still runs to the end of the section.
  const plain = NOTES_AFTER.replace('### Notes\n- Adyen has a sandbox\n- Ask the owner about fees\n\n', '')
  expect(parseDesign(plain).sections[0]!.questions).toEqual([{ text: 'Stripe or Adyen?', isResolved: false }])
  expect(answerDesignQuestion(plain, 'D3', 'Stripe or Adyen?', 'Adyen', '2026-11-12')).toContain('- [x] Stripe or Adyen?\n  **Resolved 2026-11-12 (human): Adyen**\n\n## D4')
})

// ── Full fixture ──────────────────────────────────────────────────────────

test('roadmap: design sections, revs, dropped and questions', () => {
  const d = parseDesign(DESIGN)
  expect(d.name).toBe('Shop')
  expect(d.version).toBe(3)
  expect(d.status).toBe('approved')
  expect(d.updated).toBe('2026-11-10')
  expect(d.sections.map(s => s.id)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'])
  const [d1, d2, d3, , d5, d6] = d.sections
  expect(d1!.title).toBe('Catalogue')
  expect(d1!.what).toBe('A list of hats with prices.')
  expect(d1!.doneWhen.length).toBe(2)
  expect(d2!.title).toBe('Cart')
  expect(d3!.rev).toBe(2)
  expect(d3!.questions).toEqual([
    { text: 'Which payment provider?', isResolved: false },
    { text: 'Guest checkout?', isResolved: true },
  ])
  expect(d5!.isDropped).toBe(true)
  expect(d5!.title).toBe('Gift cards')
  expect(d6!.rev).toBe(1)
  expect(d.warnings).toEqual([])
  const struck = parseDesign('## ~~D9 · Old~~\n')
  expect(struck.sections[0]!.isDropped).toBe(true)
})

test('roadmap: plan phases, columns, multi-ticket cells and status', () => {
  const p = parsePlan(PLAN)
  expect(p.designVersion).toBe(3)
  expect(p.phases.map(x => x.id)).toEqual(['P1', 'P2', 'P3'])
  expect(p.phases[0]!.goal).toBe('people can fill a cart.')
  expect(p.phases[0]!.appetite).toBe('1 week')
  expect(p.phases[0]!.exit).toBe('a cart holds two hats.')
  const b = Object.fromEntries(allBuilds(p).map(x => [x.id, x]))
  expect(b['P1.3']!.status).toBe('dropped')
  expect(b['P1.4']!.status).toBe('deferred')
  expect(b['P2.4']!.tickets).toEqual(['0006', '0007'])
  expect(b['P2.5']!.tickets).toEqual([])
  expect(b['P2.3']!.size).toBe('')
  expect(b['P2.2']!.needs).toEqual(['P2.1'])
  expect(b['P1.1']!.needs).toEqual([])
  expect(p.warnings).toEqual([])
  // Columns are found by name: no Covers, no Ticket, different order.
  const narrow = parsePlan('## P1 · X\n\n| Ticket | # | Size | Build |\n|---|---|---|---|\n| 0001 | P1.1 | S | One |\n')
  expect(allBuilds(narrow)[0]).toEqual(expect.objectContaining({ id: 'P1.1', name: 'One', size: 'S', covers: [], tickets: ['0001'] }))
})

test('roadmap: every build state, weights, excluded builds, Plan % and phase %', () => {
  const { plan, links } = full()
  const p = progress(plan, links)
  expect(p.states).toEqual({
    'P1.1': 'built',
    'P1.2': 'built',
    'P1.3': 'dropped',
    'P1.4': 'deferred',
    'P2.1': 'building',
    'P2.2': 'stuck',
    'P2.3': 'queued',
    'P2.4': 'shaping',
    'P2.5': 'not-started',
    'P2.6': 'built',
    'P3.1': 'queued',
  })
  // P1: S(1) + M(3); the dropped M and deferred L are left out.
  expect(p.phases[0]).toEqual(expect.objectContaining({ id: 'P1', countedWeight: 4, builtWeight: 4, pct: 100, counted: 2 }))
  // P2: L(8) + M(3) + unsized(3) + S(1) + M(3) + S(1) = 19; built: P2.6 S(1).
  expect(p.phases[1]).toEqual(expect.objectContaining({ id: 'P2', countedWeight: 19, builtWeight: 1, pct: 5 }))
  expect(p.phases[2]).toEqual(expect.objectContaining({ id: 'P3', countedWeight: 3, builtWeight: 0, pct: 0 }))
  // 5 of 26, rounded down.
  expect(p.countedWeight).toBe(26)
  expect(p.builtWeight).toBe(5)
  expect(p.planPct).toBe(19)
  expect(p.currentPhase).toBe('P2')
  expect(p.nextUp).toBe('P2.1')
})

test('roadmap: stuck wins, all done is built, mixed done and ready is queued', () => {
  const plan = parsePlan('## P1 · X\n\n| # | Build | Size | Needs | Ticket |\n|---|---|---|---|---|\n| P1.1 | A | S | — | 0001, 0002 |\n| P1.2 | B | S | P1.1 | — |\n')
  const t = (n: string, status: string): TicketRef => ({ number: n, status, plan: undefined, design: [] })
  const state = (a: string, b: string) => progress(plan, linkTickets(plan, parseDesign(undefined), [t('0001', a), t('0002', b)])).states['P1.1']
  expect(state('draft', 'blocked')).toBe('stuck')
  expect(state('done', 'done')).toBe('built')
  expect(state('done', 'ready')).toBe('queued')
  expect(state('in-check', 'ready')).toBe('building')
  const done = progress(plan, linkTickets(plan, parseDesign(undefined), [t('0001', 'done'), t('0002', 'done')]))
  expect(done.nextUp).toBe('P1.2')
  expect(done.planPct).toBe(50)
})

test('roadmap: all done means no current phase and no next up', () => {
  const plan = parsePlan('## P1 · X\n\n| # | Build | Size | Needs | Ticket |\n|---|---|---|---|---|\n| P1.1 | A | L | — | 0001 |\n')
  const p = progress(plan, linkTickets(plan, parseDesign(undefined), [{ number: '0001', status: 'done', plan: undefined, design: [] }]))
  expect(p.planPct).toBe(100)
  expect(p.currentPhase).toBeUndefined()
  expect(p.nextUp).toBeUndefined()
})

test('roadmap: coverage per section, stale wins, Design %', () => {
  const { design, plan, links } = full()
  const c = coverage(design, plan, links)
  expect(c.sections.map(s => [s.id, s.state])).toEqual([
    ['D1', 'built'],
    ['D2', 'built'],
    ['D3', 'stale'],
    ['D4', 'unplanned'],
    ['D6', 'building'],
    ['D7', 'planned'],
  ])
  expect(c.sections.find(s => s.id === 'D3')!.staleTickets).toEqual(['0003'])
  expect(c.sections.find(s => s.id === 'D2')!.builds).toEqual(['P1.2'])
  expect(c.counted).toBe(6)
  expect(c.designPct).toBe(33)
  expect(links.stale).toEqual([{ ticket: '0003', section: 'D3', rev: 1, now: 2 }])
  // Without the stale ticket D3 is building (P2.1 building, P2.2 stuck, P2.3 queued).
  const fresh = linkTickets(plan, design, ticketsOf(BOARD, { ...RDS, '0003': rd('0003', 'Plan: P2.1\nDesign: D3@2') }))
  expect(coverage(design, plan, fresh).sections.find(s => s.id === 'D3')!.state).toBe('building')
})

test('roadmap: hill position per phase', () => {
  const { design, plan, links } = full()
  const h = hill(design, plan, links)
  expect(h.map(x => [x.phase, x.side, x.position])).toEqual([
    ['P1', 'downhill', 100],
    // P2.1, P2.2, P2.3 and P2.6 have ready-or-later tickets: 4 of 6 → 33 of the 50 uphill.
    ['P2', 'uphill', 33],
    ['P3', 'top', 50],
  ])
  expect(h[1]!.reasons).toEqual(['open questions on D3', 'draft tickets on P2.4', 'no ticket for P2.5'])
  // Halfway down when half the weight is built.
  const plan2 = parsePlan('## P1 · X\n\n| # | Build | Size | Ticket |\n|---|---|---|---|\n| P1.1 | A | M | 0001 |\n| P1.2 | B | M | 0002 |\n')
  const t = (n: string, status: string): TicketRef => ({ number: n, status, plan: undefined, design: [] })
  const h2 = hill(parseDesign(undefined), plan2, linkTickets(plan2, parseDesign(undefined), [t('0001', 'done'), t('0002', 'in-progress')]))
  expect(h2[0]).toEqual({ phase: 'P1', side: 'downhill', position: 75, reasons: [] })
})

test('roadmap: links by Ticket cell or Plan line, off-plan tickets', () => {
  const { links } = full()
  expect(links.byBuild['P2.4']!.map(t => t.number)).toEqual(['0006', '0007'])
  expect(links.byBuild['P2.6']!.map(t => t.number)).toEqual(['0008'])
  expect(links.byBuild['P1.2']!.map(t => t.number)).toEqual(['0002'])
  expect(links.offPlan.map(t => t.number)).toEqual(['0010'])
  expect(links.missing).toEqual([])
  expect(links.mismatched).toEqual([])
})

test('roadmap: checks on the full fixture', () => {
  const { design, plan, links } = full()
  const a = checks(design, plan, links)
  expect(a.map(x => [x.id, x.subjects])).toEqual([
    ['section-no-build', ['D4']],
    ['build-no-ticket', ['P2.5']],
    ['open-questions', ['D3']],
    ['stale-tickets', ['0003']],
    ['off-plan', ['0010']],
  ])
  expect(a.every(x => ['error', 'warn', 'info'].includes(x.severity) && x.message !== '')).toBe(true)
})

// Clean: one section, one build, one ticket, everything agrees.
const CLEAN_DESIGN = '---\ndesign: X\nversion: 1\nstatus: approved\nupdated: 2026-11-10\n---\n# X: design\n\n## D1 · One\nRev: 1\nWhat: one.\n'
const CLEAN_PLAN = '---\nplan: X\ndesign-version: 1\nupdated: 2026-11-10\n---\n# X: plan\n\n## P1 · One\nGoal: g\n\n| # | Build | Size | Needs | Covers | Done when | Ticket |\n|---|---|---|---|---|---|---|\n| P1.1 | One | S | — | D1 | ok | 0001 |\n'
const T1: TicketRef = { number: '0001', status: 'ready', plan: 'P1.1', design: [{ id: 'D1', rev: 1 }] }
const ids = (designMd: string, planMd: string, tickets: TicketRef[]) => roadmap(designMd, planMd, tickets).checks.map(a => a.id)

test('roadmap: each check fires once on its crafted case and not on a clean one', () => {
  expect(ids(CLEAN_DESIGN, CLEAN_PLAN, [T1])).toEqual([])
  expect(ids(CLEAN_DESIGN.replace('version: 1', 'version: 2'), CLEAN_PLAN, [T1])).toEqual(['plan-behind'])
  expect(ids(`${CLEAN_DESIGN}\n## D2 · Two\nRev: 1\n`, CLEAN_PLAN, [T1])).toEqual(['section-no-build'])
  const row2 = (covers: string, ticket: string) => `${CLEAN_PLAN}| P1.2 | Two | S | — | ${covers} | ok | ${ticket} |\n`
  const T2: TicketRef = { number: '0002', status: 'ready', plan: 'P1.2', design: [] }
  expect(ids(CLEAN_DESIGN, row2('—', '0002'), [T1, T2])).toEqual(['build-no-section'])
  expect(ids(CLEAN_DESIGN, row2('D1', '—'), [T1])).toEqual(['build-no-ticket'])
  expect(ids(CLEAN_DESIGN, CLEAN_PLAN, [T1, { ...T2, plan: 'P9.9' }])).toEqual(['ticket-missing-build'])
  expect(ids(`${CLEAN_DESIGN}\n### Open questions\n- [ ] Which?\n`, CLEAN_PLAN, [T1])).toEqual(['open-questions'])
  expect(ids(CLEAN_DESIGN.replace('Rev: 1', 'Rev: 2'), CLEAN_PLAN, [T1])).toEqual(['stale-tickets'])
  expect(ids(CLEAN_DESIGN, CLEAN_PLAN, [T1, { ...T2, plan: undefined }])).toEqual(['off-plan'])
  expect(ids(CLEAN_DESIGN, row2('D1', '0002'), [T1, { ...T2, plan: 'P1.1' }])).toEqual(['plan-mismatch'])
  // A resolved question does not fire.
  expect(ids(`${CLEAN_DESIGN}\n### Open questions\n- [x] Which?\n  **Resolved 2026-11-10 (human): this**\n`, CLEAN_PLAN, [T1])).toEqual([])
})

// ── 0033: build states come from STATUSES ─────────────────────────────────

test('roadmap: every status in STATUSES maps to its build state; unknown words are ignored (0033)', () => {
  const build: Build = { id: 'P1.1', phase: 'P1', name: 'A', size: 'S', needs: [], needsOther: [], covers: [], doneWhen: '', tickets: [], status: '' }
  const t = (status: string): TicketRef => ({ number: '0001', status, plan: undefined, design: [] })
  const expected: Record<string, string> = { draft: 'shaping', ready: 'queued', 'in-progress': 'building', 'in-check': 'building', done: 'built', blocked: 'stuck' }
  expect([...STATUSES].sort()).toEqual(Object.keys(expected).sort())
  for (const s of STATUSES) expect(buildState(build, [t(s)])).toBe(expected[s])
  for (const word of ['unlisted', 'toString', 'constructor', '']) expect(buildState(build, [t(word)])).toBe('not-started')
  expect(buildState(build, [t('toString'), t('ready')])).toBe('queued')
  // Precedence is unchanged: stuck, then shaping, then building, then queued, then built.
  expect(buildState(build, [t('done'), t('ready'), t('in-check'), t('draft'), t('blocked')])).toBe('stuck')
  expect(buildState(build, [t('done'), t('ready'), t('in-check'), t('draft')])).toBe('shaping')
  expect(buildState(build, [t('done'), t('ready'), t('in-progress')])).toBe('building')
  expect(buildState(build, [t('done'), t('ready')])).toBe('queued')
  expect(buildState({ ...build, status: 'deferred' }, [t('ready')])).toBe('deferred')
})

// ── Factory plan shape ────────────────────────────────────────────────────

// Copy of the shape of thalix-sdlc-factory's design/factory/plan.md: F ids, no phases,
// no Covers/Ticket columns, a non-build "Self-hosting point" row.
const FACTORY = `# Thalix SDLC Factory: build plan

Date: 2026-11-08. Read \`vision.md\` first. Builds run in this order. Sizes: S (a day or
less), M (a few days), L (a week or more).

Checks for every build: \`bun run typecheck\`, \`bun run lint\`, \`bun test\`.

| # | Build | Size | Needs | Done when |
|---|---|---|---|---|
| F1 | Rename to thalix-sdlc-factory: package name, \`bin/\` command | M | — | No user-facing "kanban-web" except the alias |
| F2 | Router agent definitions in the repo | S | F1 | Definitions exist |
| F3 | Run API for an external router | M | F1 | Spec tests drive a fake router |
| F4 | Option A spike: a run mode \`router\` | L | F2, F3 | A dry-run board intent runs end to end |
| F5 | AI checker layer | M | F4 | A story that fails a criterion is sent back |
| — | **Self-hosting point.** File the remaining builds as GitHub issues on this repo | — | F4, F5, GitHub origin | First intent on this repo built by the factory |
| F6 | One run per intent, one branch, one pull request | L | F4 | Runs can only start at an intent |
| F7 | One Accept per intent | L | F5, F6 | Accept completes all stories |
| F8 | \`type:\` label (code, doc, design, mockup) | M | F5 | A \`type:doc\` story lands |
| F9 | Clearance on the run | M | F4 | Tester can do signed-in checks |
| F10 | Option B, step 1: diagnostician becomes a router subagent | M | F4 | Failed-run diagnosis runs inside the router |
| F11 | Option B, step 2: auditors become router subagents | M | F10 | Same |
| F12 | Option B, step 3: planner and breakdown become router subagents | L | F11 | Same |
| F13 | Option B, step 4: triage, enhance, review readers | L | F12 | \`src/claude.ts\` only starts routers |
| F14 | Intent commands on the finished branch + merge guard | M | F7 | As in design/card-flow |
| F15 | Remote worker readiness | M | F13 | A router started in another folder completes a run |

Phase 2 (not planned here): rename thalix-sdlc → thalix-sdlc-planner.
`

test('roadmap: factory plan shape parses as one implicit phase', () => {
  const p = parsePlan(FACTORY)
  expect(p.name).toBe('Thalix SDLC Factory')
  expect(p.phases.length).toBe(1)
  const ph = p.phases[0]!
  expect(ph.isImplicit).toBe(true)
  expect(ph.builds.map(b => b.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15'])
  const b = Object.fromEntries(ph.builds.map(x => [x.id, x]))
  expect(b.F1!.needs).toEqual([])
  expect(b.F4!.needs).toEqual(['F2', 'F3'])
  expect(b.F7!.needs).toEqual(['F5', 'F6'])
  expect(b.F2!.size).toBe('S')
  expect(b.F1!.covers).toEqual([])
  expect(b.F1!.tickets).toEqual([])
  expect(ph.markers.length).toBe(1)
  expect(ph.markers[0]!.name.startsWith('Self-hosting point.')).toBe(true)
  expect(ph.markers[0]!.needs).toEqual(['F4', 'F5'])
  expect(ph.markers[0]!.needsOther).toEqual(['GitHub origin'])
  expect(p.warnings).toEqual([])
  const r = roadmap(undefined, FACTORY, [])
  // 9 M (27) + 1 S (1) + 5 L (40); the self-hosting row is not counted.
  expect(r.progress.countedWeight).toBe(68)
  expect(r.progress.planPct).toBe(0)
  expect(r.progress.phases.length).toBe(1)
  expect(r.progress.currentPhase).toBe('')
  expect(r.progress.nextUp).toBe('F1')
  expect(r.checks.map(a => a.id)).toEqual(['build-no-ticket'])
  // Done tickets linked by their Plan: line move the needle.
  const done = (n: string, plan: string): TicketRef => ({ number: n, status: 'done', plan, design: [] })
  const r2 = roadmap(undefined, FACTORY, [done('0001', 'F1'), done('0002', 'F2'), done('0003', 'F3')])
  expect(r2.progress.builtWeight).toBe(7)
  expect(r2.progress.planPct).toBe(10)
  expect(r2.progress.nextUp).toBe('F4')
})

// ── Ticket lines and binding ──────────────────────────────────────────────

test('roadmap: Plan and Design lines in rd.md', () => {
  const head = '# 0007 — Run API\n\nType: feature\nPlan: P1.3\nDesign: D1@2, D3@1\n\n## What\n\nx\n'
  expect(parsePlanRef(head)).toBe('P1.3')
  expect(parseDesignRefs(head)).toEqual([{ id: 'D1', rev: 2 }, { id: 'D3', rev: 1 }])
  expect(parseDesignRefs('# 1 — T\n\nDesign: D1\n')).toEqual([{ id: 'D1' }])
  expect(parseDesignRefs('# 1 — T\n\n**Design:** d4@3, D1\n')).toEqual([{ id: 'D4', rev: 3 }, { id: 'D1' }])
  expect(parsePlanRef('# 1 — T\n\nType: bug\n\n## What\n\nPlan: P1.1 is in the body, not the head\n')).toBeUndefined()
  expect(parseDesignRefs('# 1 — T\n\nType: bug\n')).toEqual([])
  expect(parsePlanRef('# 1 — T\n\nPlan: —\n')).toBeUndefined()
  expect(parsePlanRef('# 1 — T\n\nPlan: f4\n')).toBe('F4')
  const t = ticketRef({ number: '0007', status: 'Ready' }, head)
  expect(t).toEqual({ number: '0007', status: 'ready', plan: 'P1.3', design: [{ id: 'D1', rev: 2 }, { id: 'D3', rev: 1 }] })
  expect(ticketRef({ number: '0008', status: 'draft' }, undefined).plan).toBeUndefined()
})

test('roadmap: binding from BOARD.md', () => {
  const files = (map: Record<string, string>) => (p: string) => map[p]
  // The binding line names the files.
  const b1 = bindFromBoard(BOARD, files({ 'design/DESIGN.md': DESIGN, 'design/PLAN.md': PLAN }))
  expect(b1).toEqual(expect.objectContaining({ designPath: 'design/DESIGN.md', planPath: 'design/PLAN.md', isBound: true, isBlank: false }))
  expect(b1.design).toBe(DESIGN)
  // Lower-case file names on disk, another folder.
  const board2 = '# Ticket board\n\nDesign: `design/factory/DESIGN.md` · Plan: design/factory/PLAN.md\n\n| # | Ticket | Status |\n|---|---|---|\n'
  const b2 = bindFromBoard(board2, files({ 'design/factory/design.md': DESIGN, 'design/factory/plan.md': FACTORY }))
  expect(b2.designPath).toBe('design/factory/design.md')
  expect(b2.planPath).toBe('design/factory/plan.md')
  expect(b2.plan).toBe(FACTORY)
  // Line says lower case, file is upper case.
  const b3 = bindFromBoard('# B\n\nPlan: design/plan.md\n', files({ 'design/PLAN.md': PLAN }))
  expect(b3).toEqual(expect.objectContaining({ designPath: undefined, planPath: 'design/PLAN.md', isBound: true, isBlank: false }))
  // No line: the default design/ files.
  const b4 = bindFromBoard('# Ticket board\n\nNo binding here.\n', files({ 'design/DESIGN.md': DESIGN, 'design/PLAN.md': PLAN }))
  expect(b4).toEqual(expect.objectContaining({ designPath: 'design/DESIGN.md', planPath: 'design/PLAN.md', isBound: false, isBlank: false }))
  // No board at all and the default files in lower case.
  expect(bindFromBoard(undefined, files({ 'design/design.md': DESIGN })).designPath).toBe('design/design.md')
  // Blank: nothing anywhere, no error.
  const b5 = bindFromBoard('# Ticket board\n', files({}))
  expect(b5).toEqual(expect.objectContaining({ isBlank: true, isBound: false, warnings: [] }))
  // A bound file that is missing is a warning, not a throw; a throwing reader is survived.
  const b6 = bindFromBoard(BOARD, () => {
    throw new Error('ENOENT')
  })
  expect(b6.isBlank).toBe(true)
  expect(b6.warnings.length).toBe(2)
})

// ── Malformed input and the standard's own files ─────────────────────────

test('roadmap: malformed input never throws and reports warnings', () => {
  const d = parseDesign('---\nversion: two\n---\n## D1 · A\nRev: x\n## D1 · Again\n### Open questions\n- [ ]\n')
  expect(d.sections.length).toBe(1)
  expect(d.warnings.length).toBe(3)
  const p = parsePlan('## P1 · A\n\n| # | Build | Size | Status |\n|---|---|---|---|\n| P1.1 | A | XL | done |\n| P1.1 | dup | S | |\n| broken row\n')
  expect(allBuilds(p).length).toBe(1)
  expect(allBuilds(p)[0]!.size).toBe('')
  expect(p.warnings.length).toBe(3)
  expect(() => roadmap('## D', '| # |\n|', [{ number: '1', status: '?', plan: 'X', design: [{ id: 'D9', rev: 1 }] }])).not.toThrow()
})

// Copies of templates/design.md and templates/plan.md (ticket 0001): they must parse.
const TEMPLATE_DESIGN = `---
design: <Project name>
version: 1
status: draft
updated: <YYYY-MM-DD>
---
# <Project name>: design

## Vision
<One paragraph: what this is and who it is for.>

## Non-goals
- <What this will not do.>

## D1 · <Section title>
Rev: 1
Why: <The reason this section exists.>
What: <What is being built, in plain words.>
Done when:
- WHEN <trigger> THE SYSTEM SHALL <observable result>
- <A plain observable condition>

### Open questions
- [ ] <A question that must be answered before approval.>
`

const TEMPLATE_PLAN = `---
plan: <Project name>
design-version: 1
updated: <YYYY-MM-DD>
---
# <Project name>: plan

## P1 · <Phase title>
Goal: <One sentence: what is true when this phase is done.>
Appetite: <e.g. 2 weeks>
Exit: <The observable condition that ends the phase.>

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | <Build name> | M | — | D1 | <how you know it is finished> | — |
`

test('roadmap: the templates from the standard parse', () => {
  const d = parseDesign(TEMPLATE_DESIGN)
  expect(d.version).toBe(1)
  expect(d.status).toBe('draft')
  expect(d.sections.map(s => [s.id, s.rev, s.doneWhen.length])).toEqual([['D1', 1, 2]])
  expect(d.warnings).toEqual([])
  const p = parsePlan(TEMPLATE_PLAN)
  expect(p.designVersion).toBe(1)
  expect(allBuilds(p).map(b => [b.id, b.size, b.covers])).toEqual([['P1.1', 'M', ['D1']]])
  expect(p.warnings).toEqual([])
})

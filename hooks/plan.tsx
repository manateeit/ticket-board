// The Plan and Design views (0007): the roadmap from the bound PLAN.md (phases, builds, list and
// timeline) and the bound DESIGN.md (sections, coverage, open questions, the approve gate), plus
// the Board / Plan / Design tabs. Every number comes from hooks/core/roadmap.ts (0003); nothing is
// recomputed here. Buttons only fill the prompt, except answering a design question and Approve,
// which write DESIGN.md, and Create tickets (0008), which makes draft tickets from builds.
import type { EngineInterface, RenderChildren } from 'claude-code'

import { applyReplan, createPlanTickets, dismissReplan, isCreatable, planJobOf, retryPlanBuild, stampProposal, startReplan } from './ai'
import { historyOf } from './core/designfile'
import { runLine } from './core/query'
import { REPLAN_GROUPS, allBuilds, type Build, type BuildState, type Hill, type Phase, type ReplanItem, type Roadmap } from './core/roadmap'
import { Card, Pill, Toast, hexOf, statusName } from './desk'
import { G, HUE, STATUS_HEX, hillSvg, needsPlate, phaseBarSvg, timelineSvg, tint, wash } from './glass'
import { S, approveDesign, fullRoadmap, latestProposal, redraw, roadmapView, rowOf, saveDesignAnswer, say, setPlanMode, setPlanPhase, statusOf, type LatestProposal, type View } from './store'
import { blockersOpen, drawnSize, fail, fill, go, runnable, type UI } from './views'

type $ = EngineInterface
type PlanView = Extract<View, { kind: 'plan' }>
type DesignView = Extract<View, { kind: 'design' }>
type ReplanView = Extract<View, { kind: 'replan' }>

const RUN_NOTE = 'Run line is in your prompt box — press Enter to send it'
const START_NOTE = 'In your prompt box — press Enter to start'

// ---------- Navigation ----------

/** What Back reads: the name of the view the person came from. */
export function viewName(v: View | undefined): string {
  if (v === undefined) return 'Board'
  switch (v.kind) {
    case 'plan':
      return 'Plan'
    case 'design':
      return 'Design'
    case 'ticket':
      return v.number
    case 'questions':
      return `${v.number} questions`
    case 'readme':
      return 'README'
    case 'new':
      return 'New ticket'
    case 'replan':
      return 'Replan review'
    case 'start':
      return 'Start'
    case 'adopt':
      return 'Adopt'
    default:
      return 'Board'
  }
}

export const backOf = (v: { from?: View }): View => v.from ?? { kind: 'board' }

export function openPlan($: $, focus?: string) {
  go($, focus === undefined ? { kind: 'plan', from: S.view } : { kind: 'plan', focus, from: S.view })
}

export function openDesign($: $, section?: string) {
  go($, section === undefined ? { kind: 'design', from: S.view } : { kind: 'design', section, from: S.view })
}

export function openTicket($: $, number: string) {
  go($, { kind: 'ticket', number, tab: 'rd', from: S.view })
}

/** Which tabs to draw: none on a board with neither a plan nor a design (unless one is open via /board plan). */
export function tabsShown(): { plan: boolean; design: boolean } | undefined {
  const b = S.snap?.binding
  const plan = b?.plan !== undefined
  const design = b?.design !== undefined
  const inside = S.view.kind === 'plan' || S.view.kind === 'design' || S.view.kind === 'replan'
  if (!plan && !design && !inside) return undefined
  return { plan, design }
}

/**
 * Board / Plan / Design. `p` and `d` press Plan and Design, except where the view already gives
 * `d` to another Button (a ready ticket's Back to draft): one Button per hotkey per view.
 */
export function Tabs($: $, ui: UI, isDesktop: boolean): RenderChildren {
  const t = tabsShown()
  if (t === undefined) return null
  const { Box, Button } = ui
  const v = S.view
  const at = v.kind === 'plan' || v.kind === 'replan' ? 'plan' : v.kind === 'design' ? 'design' : 'board'
  const dTaken = v.kind === 'ticket' && statusOf(v.number) === 'ready'
  const tab = (id: 'board' | 'plan' | 'design', label: string, hotkey: string | undefined, isBound: boolean, onPress: () => void) => (
    <Button
      key={`tab-${id}`}
      label={label}
      {...(hotkey === undefined ? {} : { hotkey })}
      variant={at === id ? 'primary' : 'secondary'}
      {...(isBound ? {} : { dimColor: true })}
      onPress={onPress}
    />
  )
  return (
    <Box key="view-tabs" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
      {tab('board', 'Board', undefined, true, () => (at === 'board' ? undefined : go($, { kind: 'board' })))}
      {tab('plan', isDesktop ? 'Plan' : 'Plan (p)', 'p', t.plan, () => (v.kind === 'plan' ? undefined : openPlan($)))}
      {tab('design', isDesktop ? 'Design' : 'Design (d)', dTaken ? undefined : 'd', t.design, () => (at === 'design' ? undefined : openDesign($)))}
    </Box>
  )
}

// ---------- Shared data ----------

const pidOf = (p: Pick<Phase, 'id'>) => (p.id === '' ? 'plan' : p.id)
const phaseLabel = (p: Pick<Phase, 'id' | 'title'>) => (p.id === '' ? p.title || 'Plan' : `${p.id} · ${p.title}`)
export const stateName = (s: BuildState | undefined) => (s ?? 'not-started').replace('-', ' ')

export function hillLabel(hl: Hill | undefined): string {
  if (hl === undefined) return ''
  return hl.side === 'uphill' ? '⛰ uphill' : hl.side === 'top' ? '⛰ at the top' : '⛰ over the hill'
}

/** A build's tickets with their board status. */
export function ticketsOf(rm: Roadmap, buildId: string): { number: string; status: string }[] {
  return (rm.links.byBuild[buildId] ?? []).map(t => ({ number: t.number, status: statusOf(t.number) ?? t.status }))
}

/** The ready tickets of some builds that can run now: the same rule as the board's Run ready (`runnable()`). */
export function readyOf(rm: Roadmap, buildIds: readonly string[]): string[] {
  const run = new Set(runnable())
  const out = new Set<string>()
  for (const id of buildIds) for (const t of rm.links.byBuild[id] ?? []) if (run.has(t.number)) out.add(t.number)
  return [...out].sort()
}

/** Why a Run button is disabled. */
export function whyNoneReady(rm: Roadmap, buildIds: readonly string[], what: string): string {
  const ts = [...new Set(buildIds.flatMap(id => (rm.links.byBuild[id] ?? []).map(t => t.number)))].sort()
  if (ts.length === 0) return `No tickets in ${what} yet`
  const waiting = ts
    .filter(n => statusOf(n) === 'ready')
    .map(n => `${n} waits on ${blockersOpen(rowOf(n)?.blockedBy ?? []).join(', ')}`)
  if (waiting.length > 0) return `Nothing in ${what} can run yet: ${waiting.join('; ')}`
  return `Nothing in ${what} is ready to run`
}

/** Fills one run line for the ready tickets of a phase or a build; never sends it. */
export function runBuilds($: $, rm: Roadmap, buildIds: readonly string[], what: string) {
  const nums = readyOf(rm, buildIds)
  if (nums.length === 0) return say($, whyNoneReady(rm, buildIds, what), 'warning')
  void fill($, runLine(nums, S.hasRouter), RUN_NOTE)
}

/** Builds among `builds` that Create tickets would make a ticket for. */
export function creatableIds(rm: Roadmap, builds: readonly Build[]): string[] {
  return builds.filter(b => isCreatable(rm, b)).map(b => b.id)
}

/** Every build that is not started and has no ticket: what "Create tickets for all not started" makes. */
export function notStartedIds(rm: Roadmap): string[] {
  return allBuilds(rm.plan)
    .filter(b => isCreatable(rm, b) && (rm.progress.states[b.id] ?? 'not-started') === 'not-started')
    .map(b => b.id)
}

/** Create tickets for some builds (0008): skeletons, Plan cells and queued writer jobs. */
export function createTickets($: $, ids: readonly string[], what: string) {
  void createPlanTickets($, ids, what).catch(err => fail($, err))
}

export function retryBuild($: $, id: string) {
  void retryPlanBuild($, id).catch(err => fail($, err))
}

export function brainstorm($: $, id: string) {
  void fill($, `/ticket-board:brainstorm ${id}`, START_NOTE)
}

export function redesign($: $, id: string) {
  void fill($, `/ticket-board:design ${id}`, START_NOTE)
}

// ---------- Large plans, one phase at a time (0022) ----------

/** What the Plan view's phases (list or timeline) may take of the drawing; the rest is the pane's chrome. */
export const PLAN_BUDGET = 60_000

/** A phase's state for the switcher: done, now (the current phase), started or not started. */
export function phaseState(rm: Roadmap, p: Pick<Phase, 'id'>): string {
  const pr = rm.progress.phases.find(x => x.id === p.id)
  if (pr !== undefined && pr.counted > 0 && pr.pct >= 100) return 'done'
  if (p.id === rm.progress.currentPhase) return 'now'
  return (pr?.pct ?? 0) > 0 ? 'started' : 'not started'
}

/**
 * The phase a large plan shows: the one holding the focused build, else the person's choice
 * (remembered per project), else the current phase (the last once the plan is complete).
 */
export function shownPhase(rm: Roadmap, focus: string | undefined): Phase | undefined {
  const ps = rm.plan.phases
  const byFocus = focus === undefined ? undefined : ps.find(p => p.builds.some(b => b.id === focus))
  return byFocus ?? ps.find(p => pidOf(p) === S.planPhase) ?? ps.find(p => p.id === rm.progress.currentPhase) ?? ps[ps.length - 1]
}

/** Shows one phase of a large plan: the choice is remembered, and the phase opens. */
function pickPhase($: $, p: Phase, v: PlanView) {
  const pid = pidOf(p)
  if (!S.planOpen.has(pid)) S.planOpen.set(pid, true)
  if (v.focus !== undefined) go($, { kind: 'plan', ...(v.from === undefined ? {} : { from: v.from }) })
  void setPlanPhase($, pid)
}

/**
 * Whether the plan is drawn one phase at a time: when every phase drawn open in the list, or the
 * whole timeline, would take more than PLAN_BUDGET of the drawing (the host refuses a drawing over
 * 100,000 characters). Measured with every phase open, so folding a phase never flips the view.
 */
function isPaged(rm: Roadmap, list: () => RenderChildren, timeline: () => RenderChildren): boolean {
  if (rm.plan.phases.length < 2) return false
  return drawnSize(list()) > PLAN_BUDGET || drawnSize(timeline()) > PLAN_BUDGET
}

function isPhaseOpen(rm: Roadmap, p: Phase, focus: string | undefined): boolean {
  const set = S.planOpen.get(pidOf(p))
  if (set !== undefined) return set
  if (focus !== undefined && p.builds.some(b => b.id === focus)) return true
  const pr = rm.progress.phases.find(x => x.id === p.id)
  return pr === undefined || pr.counted === 0 || pr.pct < 100
}

function togglePhase($: $, rm: Roadmap, p: Phase, focus: string | undefined) {
  S.planOpen.set(pidOf(p), !isPhaseOpen(rm, p, focus))
  redraw($)
}

/** A timeline link: the build's ticket when it has one, else the build in the List. */
function openBuild($: $, rm: Roadmap, b: Build) {
  const ts = ticketsOf(rm, b.id)
  if (ts.length > 0) return openTicket($, ts[0]!.number)
  S.planMode = 'list'
  void setPlanMode($, 'list')
  const v = S.view
  go($, { kind: 'plan', focus: b.id, ...(v.kind === 'plan' && v.from !== undefined ? { from: v.from } : {}) })
}

function timelineInput(rm: Roadmap, phases: readonly Phase[] = rm.plan.phases) {
  return {
    phases: phases.map(p => ({
      id: p.id,
      builds: p.builds.map(b => ({ id: b.id, name: b.name, needs: b.needs, hex: stateHex(rm.progress.states[b.id]) })),
    })),
  }
}

const stateHex = (s: BuildState | undefined): string =>
  s === 'built' ? HUE.green : s === 'building' ? HUE.blue : s === 'queued' ? HUE.teal : s === 'shaping' ? HUE.amber : s === 'stuck' ? HUE.red : HUE.slate

/** Every `Needs` pair whose builds are both in the plan: one arrow each. */
export function needPairs(rm: Roadmap): [string, string][] {
  const ids = new Set(allBuilds(rm.plan).map(b => b.id))
  return allBuilds(rm.plan).flatMap(b => b.needs.filter(n => ids.has(n)).map(n => [n, b.id] as [string, string]))
}

/** The empty or broken Plan: why, and where to go. */
function planProblem(): { warning?: string; text: string; hasDesign: boolean } {
  const rv = roadmapView()
  const b = S.snap?.binding
  const hasDesign = b?.design !== undefined
  if (rv?.warning !== undefined && b?.plan !== undefined) return { warning: rv.warning, text: 'Fix PLAN.md (format in docs/STANDARD.md), or plan it again with /ticket-board:planning.', hasDesign }
  return {
    text: hasDesign ? 'No plan yet. Plan the builds from the design with /ticket-board:planning.' : 'No plan yet. Start from an idea on the Start screen, or write a design with /ticket-board:design and plan it with /ticket-board:planning.',
    hasDesign,
  }
}

// ---------- Design data ----------

export type SectionMark = 'unplanned' | 'planned' | 'building' | 'built' | 'stale' | 'dropped'
const MARK: Record<SectionMark, string> = { unplanned: '○', planned: '◔', building: '◐', built: '●', stale: '⚠', dropped: '–' }
const markHex = (m: SectionMark) =>
  m === 'built' ? HUE.green : m === 'building' ? HUE.blue : m === 'planned' ? HUE.teal : m === 'stale' ? HUE.amber : m === 'dropped' ? HUE.slate : G.faint

/** Coverage state per section (0003 `coverage`), dropped sections included as `dropped`. */
export function sectionMarks(rm: Roadmap): { id: string; title: string; mark: SectionMark }[] {
  return rm.design.sections.map(s => ({
    id: s.id,
    title: s.title,
    mark: s.isDropped ? 'dropped' : (rm.coverage.sections.find(c => c.id === s.id)?.state ?? 'unplanned'),
  }))
}

/** Open questions of the live sections, which block Approve design. */
export function openDesignQuestions(rm: Roadmap): { id: string; text: string }[] {
  return rm.design.sections.filter(s => !s.isDropped).flatMap(s => s.questions.filter(q => !q.isResolved).map(q => ({ id: s.id, text: q.text })))
}

async function approve($: $, rm: Roadmap) {
  const open = openDesignQuestions(rm)
  if (open.length > 0) return say($, approveBlockedWhy(open), 'warning')
  try {
    await approveDesign($)
    await fill($, '/ticket-board:planning', 'Design approved. /ticket-board:planning is in your prompt box — press Enter to plan the builds')
  } catch (err) {
    fail($, err)
  }
}

const approveBlockedWhy = (open: { id: string }[]) =>
  `Answer the ${open.length} open question${open.length === 1 ? '' : 's'} first (${[...new Set(open.map(q => q.id))].join(', ')})`

function answerDesign($: $, id: string, text: string, n: number, v: string) {
  if (v.trim() === '') return say($, 'Type an answer first', 'warning')
  const key = `dq-${id}-${n}`
  void saveDesignAnswer($, id, text, v)
    .then(() => {
      S.drafts.delete(key)
      say($, `Saved the answer in DESIGN.md (${id})`)
    })
    .catch(err => fail($, err))
}

const designProblemText = () =>
  S.snap?.binding?.plan !== undefined
    ? 'No design yet. Write one with /design, or open Start.'
    : 'No design yet. Start from an idea on the Start screen, or write a design with /design.'

// ---------- Desktop ----------

function deskCrumb($: $, ui: UI, here: string, from: View | undefined): RenderChildren {
  const { Box, Button, Text } = ui
  return (
    <Box key="crumb" flexDirection="row" gap={1} alignItems="center">
      <Button key="back" label={`‹ ${viewName(from)}`} plain onPress={() => go($, from ?? { kind: 'board' })} />
      <Text color={G.faint}>{`/ ${here}`}</Text>
    </Box>
  )
}

function deskEmpty($: $, ui: UI, key: string, title: string, text: string, warning: string | undefined, actions: RenderChildren): RenderChildren {
  const { Box, Text } = ui
  return Card(
    ui,
    [
      warning === undefined ? null : (
        <Text key={`${key}-warning`} color={STATUS_HEX.draft!}>
          {`⚠ ${warning}`}
        </Text>
      ),
      <Text key={`${key}-text`} color={G.soft}>
        {text}
      </Text>,
      <Box key={`${key}-actions`} flexDirection="row" gap={1} flexWrap="wrap">
        {actions}
      </Box>,
    ],
    { key, title },
  )
}

type Col = { id: string; label: string; width: string }
export const PLAN_COLS: Col[] = [
  { id: 'num', label: '#', width: '7%' },
  { id: 'build', label: 'Build', width: '25%' },
  { id: 'size', label: 'Size', width: '6%' },
  { id: 'needs', label: 'Needs', width: '10%' },
  { id: 'covers', label: 'Covers', width: '13%' },
  { id: 'ticket', label: 'Ticket', width: '17%' },
  { id: 'state', label: 'State', width: '11%' },
  { id: 'action', label: '', width: '11%' },
]

function deskBuildRow($: $, ui: UI, rm: Roadmap, b: Build, n: number, focus: string | undefined): RenderChildren {
  const { Box, Text, Button } = ui
  const ts = ticketsOf(rm, b.id)
  const state = rm.progress.states[b.id]
  const hasReady = ts.some(t => t.status === 'ready')
  const ready = readyOf(rm, [b.id])
  const job = planJobOf(b.id)
  // Where glass and app disagree, a cell's controls go on their own plate (glass.tsx), not the cell.
  const cell = (id: string, children: RenderChildren) => (
    <Box key={`bc-${id}-${b.id}`} width={PLAN_COLS.find(c => c.id === id)!.width} paddingRight={1} flexShrink={0} overflow="hidden">
      {needsPlate() ? <Box>{children}</Box> : children}
    </Box>
  )
  const needs = [...b.needs, ...b.needsOther]
  return (
    <Box key={`build-${b.id}`} flexDirection="row" alignItems="center" paddingX={1} paddingY={1} backgroundColor={b.id === focus ? tint(G.accent, 0.14) : n % 2 === 0 ? wash(0.025) : wash(0)}>
      {cell(
        'num',
        <Text color={G.soft} mono>
          {b.id}
        </Text>,
      )}
      {cell(
        'build',
        <Text color={b.status === '' ? G.ink : G.faint} weight="medium">
          {`${b.name}${b.status === '' ? '' : ` (${b.status})`}`}
        </Text>,
      )}
      {cell('size', <Text color={G.soft}>{b.size || '—'}</Text>)}
      {cell(
        'needs',
        <Text color={G.soft} mono size="footnote">
          {needs.length === 0 ? '—' : needs.join(', ')}
        </Text>,
      )}
      {cell(
        'covers',
        b.covers.length === 0 ? (
          <Text color={G.faint}>—</Text>
        ) : (
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {b.covers.map(d => (
              <Button key={`dchip-${b.id}-${d}`} plain onPress={() => openDesign($, d)}>
                {Pill(ui, d, HUE.sky)}
              </Button>
            ))}
          </Box>
        ),
      )}
      {cell(
        'ticket',
        ts.length === 0 ? (
          <Text color={G.faint} size="footnote">
            no ticket
          </Text>
        ) : (
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {ts.map(t => (
              <Button key={`pill-${b.id}-${t.number}`} plain onPress={() => openTicket($, t.number)}>
                {Pill(ui, `${t.number} ${statusName(t.status)}`, hexOf(t.status))}
              </Button>
            ))}
          </Box>
        ),
      )}
      {cell(
        'state',
        <Text color={stateHex(state)} size="footnote" weight="semibold">
          {stateName(state)}
        </Text>,
      )}
      {cell(
        'action',
        hasReady ? (
          <Button key={`build-run-${b.id}`} label="▶ Run" {...(ready.length > 0 ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => runBuilds($, rm, [b.id], b.id)} />
        ) : job?.state === 'queued' ? (
          <Box key={`build-queued-${b.id}`}>
            <Text color={HUE.teal} size="footnote">
              ⏳ queued
            </Text>
          </Box>
        ) : job?.state === 'writing' ? (
          <Box key={`build-writing-${b.id}`}>
            <Text color={G.accent} size="footnote">
              ✎ writing
            </Text>
          </Box>
        ) : job?.state === 'failed' ? (
          <Box key={`build-failed-${b.id}`} flexDirection="column">
            <Text color={STATUS_HEX.blocked!} size="footnote">{`failed: ${job.reason ?? 'unknown'}`}</Text>
            <Button key={`build-retry-${b.id}`} label="↻ Create again" plain onPress={() => retryBuild($, b.id)} />
          </Box>
        ) : isCreatable(rm, b) ? (
          <Button key={`build-create-${b.id}`} label="+ Create ticket" plain onPress={() => createTickets($, [b.id], b.id)} />
        ) : null,
      )}
    </Box>
  )
}

function deskPhase($: $, ui: UI, rm: Roadmap, p: Phase, focus: string | undefined, isMeasure = false): RenderChildren {
  const { Box, Text, Button } = ui
  const pid = pidOf(p)
  const pr = rm.progress.phases.find(x => x.id === p.id)
  const pct = pr?.pct ?? 0
  const hl = rm.hill.find(x => x.phase === p.id)
  const isOpen = isMeasure || isPhaseOpen(rm, p, focus)
  const ids = p.builds.map(b => b.id)
  const ready = readyOf(rm, ids)
  const creatable = creatableIds(rm, p.builds)
  const what = p.id === '' ? 'the plan' : p.id
  const meta = [p.appetite === '' ? '' : `Appetite ${p.appetite}`, p.exit === '' ? '' : `Exit: ${p.exit}`].filter(Boolean).join(' · ')
  return Card(
    ui,
    [
      <Box key={`phase-head-${pid}`} flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
        <Button key={`phase-toggle-${pid}`} plain onPress={() => togglePhase($, rm, p, focus)}>
          <Text color={G.ink} weight="bold">{`${isOpen ? '▾' : '▸'} ${phaseLabel(p)}`}</Text>
        </Button>
        {ui.Svg !== undefined ? <ui.Svg key={`phase-bar-${pid}`} source={phaseBarSvg(pct, pct >= 100 ? HUE.green : HUE.sky)} alt={`${what} ${pct}%`} width={160} height={8} /> : null}
        <Text key={`phase-pct-${pid}`} color={pct >= 100 ? STATUS_HEX.ready! : G.ink} weight="semibold">{`${pct}%`}</Text>
        {hl === undefined ? null : (
          <Text key={`phase-hill-${pid}`} color={G.soft} size="footnote">
            {hillLabel(hl)}
          </Text>
        )}
      </Box>,
      meta === '' ? null : (
        <Text key={`phase-meta-${pid}`} color={G.soft} size="footnote">
          {meta}
        </Text>
      ),
      <Box key={`phase-actions-${pid}`} flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
        {creatable.length > 0 ? <Button key={`phase-create-${pid}`} label={`+ Create tickets for ${what} (${creatable.length})`} onPress={() => createTickets($, ids, what)} /> : null}
        {p.id !== '' ? <Button key={`phase-brainstorm-${pid}`} label="✨ Brainstorm" onPress={() => brainstorm($, p.id)} /> : null}
        <Button
          key={`phase-run-${pid}`}
          label={`▶ Run ready (${ready.length})`}
          {...(ready.length > 0 ? { variant: 'primary' as const } : { dimColor: true })}
          onPress={() => runBuilds($, rm, ids, what)}
        />
        {ready.length === 0 ? (
          <Text key={`phase-why-${pid}`} color={G.faint} size="footnote">
            {whyNoneReady(rm, ids, what)}
          </Text>
        ) : null}
      </Box>,
      isOpen ? (
        <Box key={`phase-table-${pid}`} flexDirection="column" backgroundColor={wash(0.03)} borderStyle="round" borderColor={G.edge}>
          <Box key={`phase-cols-${pid}`} flexDirection="row" alignItems="center" paddingX={1} paddingY={1} backgroundColor={wash(0.05)}>
            {PLAN_COLS.map(c => (
              <Box key={`ph-${pid}-${c.id}`} width={c.width} flexShrink={0} paddingRight={1}>
                <Text color={G.faint} size="caption" weight="bold">
                  {c.label.toUpperCase()}
                </Text>
              </Box>
            ))}
          </Box>
          {p.builds.map((b, n) => deskBuildRow($, ui, rm, b, n, focus))}
          {p.markers.map((m, n) => (
            <Box key={`marker-${pid}-${n}`} paddingX={1} paddingY={1}>
              <Text color={G.soft} size="footnote">{`— ${m.name}`}</Text>
            </Box>
          ))}
          {p.builds.length === 0 && p.markers.length === 0 ? (
            <Box key={`phase-none-${pid}`} paddingX={1} paddingY={1}>
              <Text color={G.faint}>No builds in this phase yet.</Text>
            </Box>
          ) : null}
        </Box>
      ) : null,
    ],
    { key: `phase-${pid}`, accent: p.builds.some(b => b.id === focus) ? tint(G.accent, 0.5) : undefined },
  )
}

function deskTimeline($: $, ui: UI, rm: Roadmap, phases: readonly Phase[] = rm.plan.phases): RenderChildren {
  const { Box, Text, Button } = ui
  const builds = phases.flatMap(p => p.builds)
  return Card(
    ui,
    [
      ui.Svg !== undefined ? (
        <ui.Svg
          key="timeline"
          source={timelineSvg(timelineInput(rm, phases), HUE.slate, HUE.slate)}
          alt={phases.map(p => `${p.id || 'Plan'}: ${p.builds.map(b => b.id).join(', ')}`).join('; ')}
        />
      ) : null,
      <Text key="hill-title" color={G.soft} size="caption" weight="bold">
        HILL CHART
      </Text>,
      ui.Svg !== undefined ? (
        <ui.Svg
          key="hill"
          source={hillSvg(rm.hill.map(hl => ({ id: hl.phase, position: hl.position })), HUE.sky, HUE.slate)}
          alt={rm.hill.map(hl => `${hl.phase || 'Plan'} ${hl.side}`).join(', ')}
        />
      ) : null,
      <Box key="tl-links" flexDirection="row" gap={1} flexWrap="wrap">
        {builds.map(b => (
          <Button key={`tl-${b.id}`} plain onPress={() => openBuild($, rm, b)}>
            <Text color={G.accent} size="footnote">{`${b.id} ${b.name}`}</Text>
          </Button>
        ))}
      </Box>,
    ],
    { key: 'timeline-card', title: 'Timeline' },
  )
}

/** The phase switcher of a large plan: one button per phase with its % and state, the shown one primary. */
function deskPhaseSwitcher($: $, ui: UI, rm: Roadmap, shown: Phase, v: PlanView): RenderChildren {
  const { Box, Text, Button } = ui
  const ps = rm.plan.phases
  return (
    <Box key="plan-phases" flexDirection="column" gap={1}>
      <Box key="plan-phases-buttons" flexDirection="row" gap={1} flexWrap="wrap">
        {ps.map(p => {
          const pct = rm.progress.phases.find(x => x.id === p.id)?.pct ?? 0
          return (
            <Button
              key={`plan-phase-${pidOf(p)}`}
              label={`${p.id || 'Plan'} · ${pct}% · ${phaseState(rm, p)}`}
              variant={p === shown ? 'primary' : 'secondary'}
              onPress={() => pickPhase($, p, v)}
            />
          )
        })}
      </Box>
      <Text key="plan-phases-note" color={G.soft} size="footnote">{`Phase ${ps.indexOf(shown) + 1} of ${ps.length} · a plan this large is shown one phase at a time`}</Text>
    </Box>
  )
}

export function deskPlan($: $, ui: UI, v: PlanView): RenderChildren {
  const { Box, Text, Button } = ui
  const rm = roadmapView()?.rm
  if (rm === undefined) {
    const pb = planProblem()
    return (
      <Box flexDirection="column" gap={1}>
        {deskCrumb($, ui, 'Plan', v.from)}
        <Text color={G.ink} size="title" weight="bold">
          Plan
        </Text>
        {Toast(ui)}
        {deskEmpty(
          $,
          ui,
          'plan-empty',
          'No plan',
          pb.text,
          pb.warning,
          <>
            <Button key="empty-start" label="Open Start" onPress={() => go($, { kind: 'start' })} />
            {pb.hasDesign ? <Button key="empty-planning" label="Plan it with /ticket-board:planning" variant="primary" onPress={() => void fill($, '/ticket-board:planning', START_NOTE)} /> : null}
          </>,
        )}
      </Box>
    )
  }
  const mode = S.planMode
  const fresh = notStartedIds(rm)
  const paged = isPaged(
    rm,
    () => rm.plan.phases.map(p => deskPhase($, ui, rm, p, v.focus, true)),
    () => deskTimeline($, ui, rm),
  )
  const shown = paged ? shownPhase(rm, v.focus) : undefined
  const phases = shown === undefined ? rm.plan.phases : [shown]
  const sub = [
    rm.plan.designVersion === undefined ? '' : `made from design v${rm.plan.designVersion}`,
    rm.plan.updated === '' ? '' : `updated ${rm.plan.updated}`,
    `${rm.progress.builtWeight} of ${rm.progress.countedWeight} weight built`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Box flexDirection="column" gap={1}>
      {deskCrumb($, ui, 'Plan', v.from)}
      <Box key="plan-title" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box key="plan-title-text" flexDirection="column">
          <Text color={G.ink} size="title" weight="bold">
            {`Plan · ${rm.plan.name || 'Plan'} · ${rm.progress.planPct}%`}
          </Text>
          <Text color={G.faint} size="footnote">
            {sub}
          </Text>
        </Box>
        <Box key="plan-modes" flexDirection="row" gap={1}>
          {fresh.length > 0 ? <Button key="plan-create-all" label={`+ Create tickets for all not started (${fresh.length})`} onPress={() => createTickets($, fresh, 'all not started builds')} /> : null}
          <Button key="plan-list" label="List" variant={mode === 'list' ? 'primary' : 'secondary'} onPress={() => void setPlanMode($, 'list')} />
          <Button key="plan-timeline" label="Timeline" variant={mode === 'timeline' ? 'primary' : 'secondary'} onPress={() => void setPlanMode($, 'timeline')} />
        </Box>
      </Box>
      {Toast(ui)}
      {DeskReplanBanner($, ui)}
      {rm.plan.warnings.map((w, n) => (
        <Text key={`plan-warn-${n}`} color={STATUS_HEX.draft!} size="footnote">
          {`⚠ ${w}`}
        </Text>
      ))}
      {shown !== undefined && deskPhaseSwitcher($, ui, rm, shown, v)}
      {mode === 'timeline' ? deskTimeline($, ui, rm, phases) : phases.map(p => deskPhase($, ui, rm, p, v.focus))}
    </Box>
  )
}

export function deskDesign($: $, ui: UI, v: DesignView): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const rm = fullRoadmap()
  if (rm === undefined || S.snap?.binding?.design === undefined) {
    return (
      <Box flexDirection="column" gap={1}>
        {deskCrumb($, ui, 'Design', v.from)}
        <Text color={G.ink} size="title" weight="bold">
          Design
        </Text>
        {Toast(ui)}
        {deskEmpty($, ui, 'design-empty', 'No design', designProblemText(), undefined, <Button key="empty-start" label="Open Start" variant="primary" onPress={() => go($, { kind: 'start' })} />)}
      </Box>
    )
  }
  const d = rm.design
  const marks = sectionMarks(rm)
  const sec = d.sections.find(s => s.id === v.section) ?? d.sections[0]
  const open = openDesignQuestions(rm)
  const history = S.snap?.changes === undefined ? undefined : historyOf(S.snap.changes, S.snap.changeNotes)
  const sub = [d.version === undefined ? '' : `v${d.version}`, d.status, d.updated === '' ? '' : `updated ${d.updated}`].filter(Boolean).join(' · ')
  const mark = sec === undefined ? undefined : marks.find(m => m.id === sec.id)?.mark
  const builds = sec === undefined ? [] : allBuilds(rm.plan).filter(b => b.covers.includes(sec.id))
  const goSection = (id: string) => go($, { kind: 'design', section: id, ...(v.from === undefined ? {} : { from: v.from }) })
  return (
    <Box flexDirection="column" gap={1}>
      {deskCrumb($, ui, 'Design', v.from)}
      <Box key="design-title" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box key="design-title-text" flexDirection="column">
          <Text color={G.ink} size="title" weight="bold">
            {`Design · ${d.name || 'Design'}`}
          </Text>
          <Text color={G.faint} size="footnote">
            {`${sub}${sub === '' ? '' : ' · '}Design ${rm.coverage.designPct}% · built ${rm.coverage.built} of ${rm.coverage.counted} sections`}
          </Text>
        </Box>
        {d.status === 'draft' ? (
          <Box key="approve-box" flexDirection="column" alignItems="flex-end">
            <Button key="approve-design" label="✓ Approve design" {...(open.length === 0 ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => void approve($, rm)} />
            {open.length > 0 ? (
              <Text key="approve-why" color={G.faint} size="footnote">
                {approveBlockedWhy(open)}
              </Text>
            ) : null}
          </Box>
        ) : null}
      </Box>
      {Toast(ui)}
      {d.warnings.map((w, n) => (
        <Text key={`design-warn-${n}`} color={STATUS_HEX.draft!} size="footnote">
          {`⚠ ${w}`}
        </Text>
      ))}
      {d.sections.length === 0 ? (
        <Text key="design-none" color={G.soft}>{`No numbered sections (## D1 · Title) in ${S.snap?.binding?.designPath ?? 'DESIGN.md'} yet.`}</Text>
      ) : (
        <Box key="design-cols" flexDirection="row" gap={2} flexWrap="wrap" alignItems="flex-start">
          <Box key="design-list" flexDirection="column" gap={1} flexGrow={0} flexShrink={0} width="30%" minWidth={24}>
            {Card(
              ui,
              marks.map(m => (
                <Button key={`sec-${m.id}`} plain onPress={() => goSection(m.id)}>
                  <Text color={m.id === sec?.id ? G.accent : G.ink} weight={m.id === sec?.id ? 'bold' : 'regular'}>{`${MARK[m.mark]} ${m.id} ${m.title}`}</Text>
                  <Text color={markHex(m.mark)} size="footnote">{`  ${m.mark}`}</Text>
                </Button>
              )),
              { key: 'sections-card', title: 'Sections' },
            )}
          </Box>
          {sec === undefined ? null : (
            <Box key="design-detail" flexDirection="column" gap={1} flexGrow={1} flexShrink={1} width="66%" minWidth={40}>
              {Card(
                ui,
                [
                  sec.why === '' ? null : (
                    <Box key="sec-why" flexDirection="column">
                      <Text color={G.faint} size="caption" weight="bold">
                        WHY
                      </Text>
                      <Text color={G.ink}>{sec.why}</Text>
                    </Box>
                  ),
                  sec.what === '' ? null : (
                    <Box key="sec-what" flexDirection="column">
                      <Text color={G.faint} size="caption" weight="bold">
                        WHAT
                      </Text>
                      <Text color={G.ink}>{sec.what}</Text>
                    </Box>
                  ),
                  sec.doneWhen.length === 0 ? null : (
                    <Box key="sec-done" flexDirection="column">
                      <Text color={G.faint} size="caption" weight="bold">
                        DONE WHEN
                      </Text>
                      {sec.doneWhen.map((line, n) => (
                        <Text key={`sec-done-${n}`} color={G.ink}>{`• ${line}`}</Text>
                      ))}
                    </Box>
                  ),
                  <Box key="sec-impl" flexDirection="column">
                    <Text color={G.faint} size="caption" weight="bold">
                      IMPLEMENTED BY
                    </Text>
                    {builds.length === 0 ? (
                      <Text key="impl-none" color={G.soft}>
                        No build covers this section yet.
                      </Text>
                    ) : (
                      builds.map(b => (
                        <Box key={`impl-${b.id}`} flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
                          <Button key={`impl-build-${b.id}`} plain onPress={() => openPlan($, b.id)}>
                            <Text color={G.accent}>{`${b.id} ${b.name}`}</Text>
                          </Button>
                          <Text color={G.faint}>→</Text>
                          {ticketsOf(rm, b.id).length === 0 ? (
                            <Text key={`impl-none-${b.id}`} color={G.faint} size="footnote">
                              no ticket
                            </Text>
                          ) : (
                            ticketsOf(rm, b.id).map(t => (
                              <Button key={`impl-ticket-${b.id}-${t.number}`} plain onPress={() => openTicket($, t.number)}>
                                {Pill(ui, `${t.number} ${statusName(t.status)}`, hexOf(t.status))}
                              </Button>
                            ))
                          )}
                        </Box>
                      ))
                    )}
                  </Box>,
                  <Box key="sec-actions" flexDirection="row" gap={1} flexWrap="wrap">
                    <Button key="brainstorm-section" label="✨ Brainstorm this" onPress={() => brainstorm($, sec.id)} />
                    <Button key="redesign-section" label="Redesign this section" onPress={() => redesign($, sec.id)} />
                  </Box>,
                ],
                {
                  key: 'section-card',
                  title: `${sec.id} · ${sec.title}`,
                  right: <Text color={markHex(mark ?? 'unplanned')} size="footnote">{`${MARK[mark ?? 'unplanned']} ${mark ?? 'unplanned'} · Rev ${sec.rev}`}</Text>,
                },
              )}
              {sec.questions.length === 0
                ? null
                : Card(
                    ui,
                    sec.questions.map((q, n) => {
                      const key = `dq-${sec.id}-${n}`
                      return q.isResolved ? (
                        <Text key={`dqa-${sec.id}-${n}`} color={G.soft} size="footnote">{`✓ ${q.text}`}</Text>
                      ) : (
                        <Box key={`dqb-${sec.id}-${n}`} flexDirection="column" gap={1}>
                          <Text color={G.ink} weight="semibold">
                            {q.text}
                          </Text>
                          <Input
                            key={key}
                            value={S.drafts.get(key) ?? ''}
                            rows={2}
                            placeholder="Type the decision, then Save"
                            submitLabel="Save answer"
                            onInput={val => void S.drafts.set(key, val)}
                            onSubmit={val => answerDesign($, sec.id, q.text, n, val)}
                          />
                        </Box>
                      )
                    }),
                    {
                      key: 'design-questions',
                      title: `Open questions (${sec.questions.filter(q => !q.isResolved).length})`,
                      accent: sec.questions.some(q => !q.isResolved) ? tint(STATUS_HEX.draft!, 0.55) : undefined,
                    },
                  )}
            </Box>
          )}
        </Box>
      )}
      {history === undefined
        ? null
        : Card(
            ui,
            history.length === 0
              ? [
                  <Text key="history-none" color={G.soft} size="footnote">
                    No change notes yet.
                  </Text>,
                ]
              : history.map(hl => (
                  <Text key={`history-${hl.name}`} color={G.soft} size="footnote">{`${hl.label}${hl.date === '' ? '' : ` · ${hl.date}`}${hl.sections === '' ? '' : ` · ${hl.sections}`}  ${hl.name}`}</Text>
                )),
            { key: 'history-card', title: 'History · design/changes' },
          )}
    </Box>
  )
}

// ---------- Terminal ----------

function termHeader($: $, ui: UI, title: string, from: View | undefined): RenderChildren {
  const { Box, Text, Button } = ui
  return (
    <Box key="crumb" flexDirection="row" gap={1}>
      <Button key="back" label={`‹ ${viewName(from)}`} plain onPress={() => go($, from ?? { kind: 'board' })} />
      <Text bold wrap="truncate">
        {title}
      </Text>
    </Box>
  )
}

function termMessage(ui: UI): RenderChildren {
  if (S.message === undefined) return null
  return (
    <ui.Text key="message" color={S.message.tone}>
      {S.message.text}
    </ui.Text>
  )
}

function termBuild($: $, ui: UI, rm: Roadmap, b: Build, focus: string | undefined): RenderChildren {
  const { Box, Text, Button } = ui
  const ts = ticketsOf(rm, b.id)
  const needs = [...b.needs, ...b.needsOther]
  const ready = readyOf(rm, [b.id])
  const job = planJobOf(b.id)
  const line = `${b.id === focus ? '›' : ' '} ${b.id}  ${b.name}${b.status === '' ? '' : ` (${b.status})`} · ${b.size || '—'} · needs ${needs.length === 0 ? '—' : needs.join(', ')} · ${stateName(rm.progress.states[b.id])}`
  return (
    <Box key={`build-${b.id}`} flexDirection="column" paddingLeft={2}>
      <Text bold={b.id === focus} wrap="truncate">
        {line}
      </Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={4}>
        {b.covers.map(d => (
          <Button key={`dchip-${b.id}-${d}`} label={d} plain onPress={() => openDesign($, d)} />
        ))}
        {ts.length === 0 ? <Text key={`noticket-${b.id}`} dimColor>no ticket</Text> : null}
        {ts.map(t => (
          <Button key={`pill-${b.id}-${t.number}`} label={`${t.number} ${t.status}`} plain onPress={() => openTicket($, t.number)} />
        ))}
        {ts.some(t => t.status === 'ready') ? (
          <Button key={`build-run-${b.id}`} label="▶ Run" plain {...(ready.length > 0 ? {} : { dimColor: true })} onPress={() => runBuilds($, rm, [b.id], b.id)} />
        ) : job?.state === 'queued' ? (
          <Box key={`build-queued-${b.id}`}>
            <Text color="warning">queued</Text>
          </Box>
        ) : job?.state === 'writing' ? (
          <Box key={`build-writing-${b.id}`}>
            <Text color="claude">✎ writing</Text>
          </Box>
        ) : job?.state === 'failed' ? (
          <Box key={`build-failed-${b.id}`}>
            <Text color="error">{`failed: ${job.reason ?? 'unknown'}`}</Text>
          </Box>
        ) : isCreatable(rm, b) ? (
          <Button key={`build-create-${b.id}`} label="+ Create ticket" plain onPress={() => createTickets($, [b.id], b.id)} />
        ) : null}
        {job?.state === 'failed' ? <Button key={`build-retry-${b.id}`} label="↻ Create again" plain onPress={() => retryBuild($, b.id)} /> : null}
      </Box>
    </Box>
  )
}

function termPhase($: $, ui: UI, rm: Roadmap, p: Phase, focus: string | undefined, isMeasure = false): RenderChildren {
  const { Box, Text, Button } = ui
  const pid = pidOf(p)
  const pct = rm.progress.phases.find(x => x.id === p.id)?.pct ?? 0
  const hl = rm.hill.find(x => x.phase === p.id)
  const isOpen = isMeasure || isPhaseOpen(rm, p, focus)
  const ids = p.builds.map(b => b.id)
  const ready = readyOf(rm, ids)
  const creatable = creatableIds(rm, p.builds)
  const what = p.id === '' ? 'the plan' : p.id
  const meta = [p.appetite === '' ? '' : `Appetite ${p.appetite}`, p.exit === '' ? '' : `Exit: ${p.exit}`].filter(Boolean).join(' · ')
  return (
    <Box key={`phase-${pid}`} flexDirection="column">
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        <Button key={`phase-toggle-${pid}`} label={`${isOpen ? '▾' : '▸'} ${phaseLabel(p)}`} plain onPress={() => togglePhase($, rm, p, focus)} />
        <Text color={pct >= 100 ? 'success' : 'claude'} bold>{`${pct}%`}</Text>
        {hl === undefined ? null : <Text dimColor>{hillLabel(hl)}</Text>}
      </Box>
      {meta === '' ? null : (
        <Box paddingLeft={2}>
          <Text dimColor>{meta}</Text>
        </Box>
      )}
      <Box flexDirection="row" columnGap={1} flexWrap="wrap" paddingLeft={2}>
        {creatable.length > 0 ? <Button key={`phase-create-${pid}`} label={`+ Create tickets for ${what} (${creatable.length})`} plain onPress={() => createTickets($, ids, what)} /> : null}
        {p.id !== '' ? <Button key={`phase-brainstorm-${pid}`} label="Brainstorm" plain onPress={() => brainstorm($, p.id)} /> : null}
        <Button key={`phase-run-${pid}`} label={`▶ Run ready (${ready.length})`} plain {...(ready.length > 0 ? {} : { dimColor: true })} onPress={() => runBuilds($, rm, ids, what)} />
        {ready.length === 0 ? <Text dimColor>{whyNoneReady(rm, ids, what)}</Text> : null}
      </Box>
      {isOpen ? p.builds.map(b => termBuild($, ui, rm, b, focus)) : null}
      {isOpen
        ? p.markers.map((m, n) => (
            <Box key={`marker-${pid}-${n}`} paddingLeft={2}>
              <Text dimColor>{`— ${m.name}`}</Text>
            </Box>
          ))
        : null}
    </Box>
  )
}

function termTimeline($: $, ui: UI, rm: Roadmap, phases: readonly Phase[] = rm.plan.phases): RenderChildren {
  const { Box, Text, Button } = ui
  return (
    <Box key="timeline" flexDirection="column">
      {phases.map(p => (
        <Text key={`lane-${pidOf(p)}`} wrap="truncate">
          {`${(p.id || 'Plan').padEnd(4)} │ ${p.builds.map(b => (b.needs.length === 0 ? b.id : `${b.needs.join('+')} → ${b.id}`)).join('   ') || '—'}`}
        </Text>
      ))}
      <Text key="hill-line" dimColor>{`Hill: ${rm.hill.map(hl => `${hl.phase || 'Plan'} ${hillLabel(hl).replace('⛰ ', '')} (${hl.position})`).join(' · ')}`}</Text>
      <Box key="tl-links" flexDirection="row" flexWrap="wrap" columnGap={1}>
        {phases.flatMap(p => p.builds).map(b => (
          <Button key={`tl-${b.id}`} label={b.id} plain onPress={() => openBuild($, rm, b)} />
        ))}
      </Box>
    </Box>
  )
}

export function planView($: $, ui: UI, v: PlanView): RenderChildren {
  const { Box, Text, Button } = ui
  const rm = roadmapView()?.rm
  if (rm === undefined) {
    const pb = planProblem()
    return (
      <Box flexDirection="column" gap={1}>
        {termHeader($, ui, 'Plan', v.from)}
        {termMessage(ui)}
        {pb.warning === undefined ? null : <Text key="plan-warning" color="warning">{`⚠ ${pb.warning}`}</Text>}
        <Text key="plan-empty" dimColor>
          {pb.text}
        </Text>
        <Box key="plan-empty-actions" flexDirection="row" columnGap={1}>
          <Button key="empty-start" label="Open Start" onPress={() => go($, { kind: 'start' })} />
          {pb.hasDesign ? <Button key="empty-planning" label="Plan it with /ticket-board:planning" onPress={() => void fill($, '/ticket-board:planning', START_NOTE)} /> : null}
        </Box>
      </Box>
    )
  }
  const mode = S.planMode
  const fresh = notStartedIds(rm)
  const paged = isPaged(
    rm,
    () => rm.plan.phases.map(p => termPhase($, ui, rm, p, v.focus, true)),
    () => termTimeline($, ui, rm),
  )
  const shown = paged ? shownPhase(rm, v.focus) : undefined
  const phases = shown === undefined ? rm.plan.phases : [shown]
  return (
    <Box flexDirection="column" gap={1}>
      {termHeader($, ui, `Plan · ${rm.plan.name || 'Plan'} · ${rm.progress.planPct}%${rm.plan.designVersion === undefined ? '' : ` · made from design v${rm.plan.designVersion}`}`, v.from)}
      <Box key="plan-modes" flexDirection="row" columnGap={1}>
        <Button key="plan-list" label={mode === 'list' ? '[List]' : 'List'} plain onPress={() => void setPlanMode($, 'list')} />
        <Button key="plan-timeline" label={mode === 'timeline' ? '[Timeline]' : 'Timeline'} plain onPress={() => void setPlanMode($, 'timeline')} />
        {fresh.length > 0 ? <Button key="plan-create-all" label={`+ Create tickets for all not started (${fresh.length})`} plain onPress={() => createTickets($, fresh, 'all not started builds')} /> : null}
      </Box>
      {termMessage(ui)}
      {TermReplanBanner($, ui)}
      {rm.plan.warnings.map((w, n) => (
        <Text key={`plan-warn-${n}`} color="warning">{`⚠ ${w}`}</Text>
      ))}
      {shown !== undefined && (
        <Box key="plan-phases" flexDirection="row" columnGap={1} flexWrap="wrap">
          {rm.plan.phases.map(p => {
            const label = `${p.id || 'Plan'} ${rm.progress.phases.find(x => x.id === p.id)?.pct ?? 0}% ${phaseState(rm, p)}`
            return <Button key={`plan-phase-${pidOf(p)}`} label={p === shown ? `[${label}]` : label} plain onPress={() => pickPhase($, p, v)} />
          })}
          <Text key="plan-phases-note" dimColor>{`phase ${rm.plan.phases.indexOf(shown) + 1} of ${rm.plan.phases.length}`}</Text>
        </Box>
      )}
      {mode === 'timeline' ? termTimeline($, ui, rm, phases) : phases.map(p => termPhase($, ui, rm, p, v.focus))}
    </Box>
  )
}

export function designView($: $, ui: UI, v: DesignView): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const rm = fullRoadmap()
  if (rm === undefined || S.snap?.binding?.design === undefined) {
    return (
      <Box flexDirection="column" gap={1}>
        {termHeader($, ui, 'Design', v.from)}
        {termMessage(ui)}
        <Text key="design-empty" dimColor>
          {designProblemText()}
        </Text>
        <Button key="empty-start" label="Open Start" onPress={() => go($, { kind: 'start' })} />
      </Box>
    )
  }
  const d = rm.design
  const marks = sectionMarks(rm)
  const sec = d.sections.find(s => s.id === v.section) ?? d.sections[0]
  const open = openDesignQuestions(rm)
  const history = S.snap?.changes === undefined ? undefined : historyOf(S.snap.changes, S.snap.changeNotes)
  const builds = sec === undefined ? [] : allBuilds(rm.plan).filter(b => b.covers.includes(sec.id))
  const goSection = (id: string) => go($, { kind: 'design', section: id, ...(v.from === undefined ? {} : { from: v.from }) })
  const mark = sec === undefined ? 'unplanned' : (marks.find(m => m.id === sec.id)?.mark ?? 'unplanned')
  return (
    <Box flexDirection="column" gap={1}>
      {termHeader($, ui, `Design · ${d.name || 'Design'}${d.version === undefined ? '' : ` · v${d.version}`}${d.status === '' ? '' : ` · ${d.status}`}`, v.from)}
      <Text key="design-pct" bold color="claude">{`Design ${rm.coverage.designPct}% · built ${rm.coverage.built} of ${rm.coverage.counted} sections`}</Text>
      {d.status === 'draft' ? (
        <Box key="approve-box" flexDirection="row" columnGap={1} flexWrap="wrap">
          <Button key="approve-design" label="✓ Approve design" {...(open.length === 0 ? {} : { dimColor: true })} onPress={() => void approve($, rm)} />
          {open.length > 0 ? <Text dimColor>{approveBlockedWhy(open)}</Text> : null}
        </Box>
      ) : null}
      {termMessage(ui)}
      {d.warnings.map((w, n) => (
        <Text key={`design-warn-${n}`} color="warning">{`⚠ ${w}`}</Text>
      ))}
      {d.sections.length === 0 ? <Text key="design-none" dimColor>{`No numbered sections (## D1 · Title) in ${S.snap?.binding?.designPath ?? 'DESIGN.md'} yet.`}</Text> : null}
      <Box key="design-list" flexDirection="column">
        {marks.map(m => (
          <Button key={`sec-${m.id}`} label={`${m.id === sec?.id ? '›' : ' '} ${MARK[m.mark]} ${m.id} ${m.title} · ${m.mark}`} plain onPress={() => goSection(m.id)} />
        ))}
      </Box>
      {sec === undefined ? null : (
        <Box key="design-detail" flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>{`${sec.id} · ${sec.title}  (${mark} · Rev ${sec.rev})`}</Text>
          {sec.why === '' ? null : <Text key="sec-why">{`Why: ${sec.why}`}</Text>}
          {sec.what === '' ? null : <Text key="sec-what">{`What: ${sec.what}`}</Text>}
          {sec.doneWhen.length === 0 ? null : <Text key="sec-done-title">Done when:</Text>}
          {sec.doneWhen.map((line, n) => (
            <Text key={`sec-done-${n}`}>{`  - ${line}`}</Text>
          ))}
          <Text key="sec-impl" dimColor>
            Implemented by:
          </Text>
          {builds.length === 0 ? <Text key="impl-none" dimColor>{'  no build covers this section yet'}</Text> : null}
          {builds.map(b => (
            <Box key={`impl-${b.id}`} flexDirection="row" columnGap={1} paddingLeft={2} flexWrap="wrap">
              <Button key={`impl-build-${b.id}`} label={`${b.id} ${b.name}`} plain onPress={() => openPlan($, b.id)} />
              <Text>→</Text>
              {ticketsOf(rm, b.id).length === 0 ? <Text dimColor>no ticket</Text> : null}
              {ticketsOf(rm, b.id).map(t => (
                <Button key={`impl-ticket-${b.id}-${t.number}`} label={`${t.number} ${t.status}`} plain onPress={() => openTicket($, t.number)} />
              ))}
            </Box>
          ))}
          <Box key="sec-actions" flexDirection="row" columnGap={1}>
            <Button key="brainstorm-section" label="Brainstorm this" onPress={() => brainstorm($, sec.id)} />
            <Button key="redesign-section" label="Redesign this section" onPress={() => redesign($, sec.id)} />
          </Box>
        </Box>
      )}
      {sec === undefined || sec.questions.length === 0 ? null : (
        <Box key="design-questions" flexDirection="column">
          <Text bold>{`Open questions (${sec.questions.filter(q => !q.isResolved).length})`}</Text>
          {sec.questions.map((q, n) => {
            const key = `dq-${sec.id}-${n}`
            return q.isResolved ? (
              <Text key={`dqa-${sec.id}-${n}`} dimColor>{`✓ ${q.text}`}</Text>
            ) : (
              <Box key={`dqb-${sec.id}-${n}`} flexDirection="column">
                <Text>{q.text}</Text>
                <Input
                  key={key}
                  label="Answer"
                  value={S.drafts.get(key) ?? ''}
                  placeholder="Type the decision, then Save"
                  submitLabel="Save"
                  onInput={val => void S.drafts.set(key, val)}
                  onSubmit={val => answerDesign($, sec.id, q.text, n, val)}
                />
              </Box>
            )
          })}
        </Box>
      )}
      {history === undefined ? null : (
        <Box key="history" flexDirection="column">
          <Text bold>History</Text>
          {history.length === 0 ? <Text key="history-none" dimColor>No change notes yet.</Text> : null}
          {history.map(hl => (
            <Text key={`history-${hl.name}`} dimColor>{`${hl.label}${hl.date === '' ? '' : ` · ${hl.date}`}${hl.sections === '' ? '' : ` · ${hl.sections}`}  ${hl.name}`}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ---------- Replan banner and review (0016) ----------

export type ReplanBanner = {
  /** `Plan is behind design v3 · 4 replan items to review`. */
  text: string
  /** The banner's planner-run button label (Replan, or New proposal when one is open); undefined when it is not offered. */
  start?: string
  /** The banner's Review button opens the review screen. */
  canReview: boolean
}

/** Whether the newest replan proposal is for the current design, and what is left in it. */
function proposalFacts(rm: Roadmap): { lp?: LatestProposal; isUnreadable: boolean; isCurrent: boolean; open: number } {
  const lp = latestProposal()
  if (lp === undefined) return { isUnreadable: false, isCurrent: false, open: 0 }
  const p = lp.proposal
  const isUnreadable = p === undefined || !p.hasGroups
  const dv = rm.design.version
  const isCurrent = p === undefined || !p.hasGroups || p.designVersion === undefined || dv === undefined || p.designVersion >= dv
  const open = isCurrent && p !== undefined && p.hasGroups ? p.items.filter(i => i.state === 'open').length : 0
  return { lp, isUnreadable, isCurrent, open }
}

/**
 * The replan banner on the board and the Plan view: while the plan is behind the design, while the
 * planner writes a proposal, and while the current proposal has items nobody applied or dismissed.
 */
export function replanBanner(): ReplanBanner | undefined {
  const rm = roadmapView()?.rm
  if (rm === undefined) return undefined
  const behind = rm.checks.some(a => a.id === 'plan-behind')
  const f = proposalFacts(rm)
  const isRunning = S.replanJob !== undefined
  if (!behind && f.open === 0 && !isRunning) return undefined
  const dv = rm.design.version
  const head = behind ? (dv === undefined ? 'Plan is behind the design' : `Plan is behind design v${dv}`) : `Replan for design v${f.lp?.proposal?.designVersion ?? dv ?? '?'}`
  const tail = isRunning
    ? 'the planner is writing a replan proposal…'
    : f.isCurrent && f.isUnreadable
      ? `could not read the replan proposal ${f.lp!.path}`
      : f.open > 0
        ? `${f.open} replan item${f.open === 1 ? '' : 's'} to review`
        : 'no replan proposal yet'
  const canReview = f.isCurrent && (f.open > 0 || f.isUnreadable)
  return {
    text: `${head} · ${tail}`,
    ...(behind && !isRunning ? { start: canReview ? '↻ New proposal' : 'Replan' } : {}),
    canReview,
  }
}

export function openReplan($: $) {
  S.replanTicks.clear()
  go($, { kind: 'replan', from: S.view })
  void stampProposal($).catch(err => fail($, err))
}

function replan($: $) {
  void startReplan($).catch(err => fail($, err))
}

function toggleTick($: $, index: number) {
  if (S.replanTicks.has(index)) S.replanTicks.delete(index)
  else S.replanTicks.add(index)
  redraw($)
}

function applySelected($: $) {
  void applyReplan($, [...S.replanTicks]).catch(err => fail($, err))
}

function dismissSelected($: $) {
  void dismissReplan($, [...S.replanTicks]).catch(err => fail($, err))
}

/** The banner's buttons, the same on both surfaces. */
function bannerButtons($: $, ui: UI, b: ReplanBanner, isPlain: boolean): RenderChildren {
  const { Button } = ui
  return [
    b.canReview ? <Button key="replan-review" label="Review replan" {...(isPlain ? { plain: true } : { variant: 'primary' as const })} onPress={() => openReplan($)} /> : null,
    b.start === undefined ? null : (
      <Button key="replan-start" label={b.start} {...(isPlain ? { plain: true } : b.canReview ? {} : { variant: 'primary' as const })} onPress={() => replan($)} />
    ),
  ]
}

/** The desktop banner (board Roadmap card and Plan view). */
export function DeskReplanBanner($: $, ui: UI): RenderChildren {
  const b = replanBanner()
  if (b === undefined) return null
  const { Box, Text } = ui
  return (
    <Box key="replan-banner" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap" backgroundColor={tint(STATUS_HEX.draft!, 0.1)} borderStyle="round" borderColor={tint(STATUS_HEX.draft!, 0.5)} paddingX={2} paddingY={1}>
      <Text key="replan-banner-text" color={STATUS_HEX.draft!} weight="semibold">{`⚠ ${b.text}`}</Text>
      {bannerButtons($, ui, b, false)}
    </Box>
  )
}

/** The terminal banner (board plan line and Plan view). */
export function TermReplanBanner($: $, ui: UI): RenderChildren {
  const b = replanBanner()
  if (b === undefined) return null
  const { Box, Text } = ui
  return (
    <Box key="replan-banner" flexDirection="row" columnGap={1} flexWrap="wrap">
      <Text key="replan-banner-text" color="warning">{`⚠ ${b.text}`}</Text>
      {bannerButtons($, ui, b, true)}
    </Box>
  )
}

type ReviewData = {
  rm?: Roadmap
  lp?: LatestProposal
  /** Set when the proposal cannot be read: the line to show, naming the file. */
  problem?: string
  groups: { id: string; title: string; items: ReplanItem[] }[]
  applied: number
  dismissed: number
  ticked: number
}

function reviewData(): ReviewData {
  const rm = roadmapView()?.rm
  const lp = latestProposal()
  const empty: ReviewData = { groups: [], applied: 0, dismissed: 0, ticked: 0, ...(rm === undefined ? {} : { rm }) }
  if (lp === undefined) return empty
  const p = lp.proposal
  if (p === undefined) return { ...empty, lp, problem: `Could not read the replan proposal: ${lp.path}` }
  if (!p.hasGroups) return { ...empty, lp, problem: `Could not read the replan proposal: ${lp.path} has no Add, Change, Drop or Follow-up heading` }
  const open = p.items.filter(i => i.state === 'open')
  return {
    ...empty,
    lp,
    groups: REPLAN_GROUPS.map(g => ({ id: g.id, title: g.title, items: open.filter(i => i.group === g.id) })),
    applied: p.items.filter(i => i.state === 'applied').length,
    dismissed: p.items.filter(i => i.state === 'dismissed').length,
    ticked: open.filter(i => S.replanTicks.has(i.index)).length,
  }
}

/** A Change item on a build whose ticket is done: the row changes, the done ticket does not. */
function builtNote(rm: Roadmap | undefined, it: ReplanItem): string {
  if (rm === undefined || it.group !== 'change' || it.build === undefined) return ''
  const done = ticketsOf(rm, it.build).filter(t => t.status === 'done')
  return done.length === 0 ? '' : `${done.map(t => t.number).join(', ')} done: only the plan row changes; a Follow-up does the work`
}

export function deskReplan($: $, ui: UI, v: ReplanView): RenderChildren {
  const { Box, Text, Button } = ui
  const d = reviewData()
  const b = replanBanner()
  const sub =
    d.lp === undefined
      ? ''
      : [d.lp.path, d.lp.proposal?.designVersion === undefined ? '' : `for design v${d.lp.proposal.designVersion}`, `${d.applied} applied · ${d.dismissed} dismissed`].filter(Boolean).join(' · ')
  const startButton = (label: string) => (b?.start === undefined ? null : <Button key="replan-start" label={label} variant="primary" onPress={() => replan($)} />)
  return (
    <Box flexDirection="column" gap={1}>
      {deskCrumb($, ui, 'Replan review', v.from)}
      <Box key="replan-title" flexDirection="column">
        <Text color={G.ink} size="title" weight="bold">
          Replan review
        </Text>
        {sub === '' ? null : (
          <Text key="replan-sub" color={G.faint} size="footnote">
            {sub}
          </Text>
        )}
      </Box>
      {Toast(ui)}
      {d.lp === undefined
        ? deskEmpty($, ui, 'replan-empty', 'No replan proposal', 'No replan proposal yet. Replan writes one to design/changes/<date>-replan.md.', undefined, startButton('Replan'))
        : d.problem !== undefined
          ? deskEmpty($, ui, 'replan-problem', 'Proposal', 'Fix the file (format in docs/STANDARD.md, section 8) or make a new proposal.', d.problem, startButton('↻ New proposal'))
          : [
              ...d.groups.map(g =>
                Card(
                  ui,
                  g.items.length === 0
                    ? [
                        <Text key={`rp-none-${g.id}`} color={G.faint} size="footnote">
                          Nothing to review.
                        </Text>,
                      ]
                    : g.items.map(it => {
                        const note = builtNote(d.rm, it)
                        return (
                          <Box key={`rp-item-${it.index}`} flexDirection="column">
                            <Button key={`rp-tick-${it.index}`} label={`${S.replanTicks.has(it.index) ? '☑' : '☐'} ${it.title}`} plain onPress={() => toggleTick($, it.index)} />
                            <Text key={`rp-reason-${it.index}`} color={G.soft} size="footnote">
                              {it.reason === '' ? 'No reason given.' : it.reason}
                            </Text>
                            {it.problem === '' ? null : (
                              <Text key={`rp-problem-${it.index}`} color={STATUS_HEX.blocked!} size="footnote">
                                {`⚠ ${it.problem}`}
                              </Text>
                            )}
                            {note === '' ? null : (
                              <Text key={`rp-note-${it.index}`} color={STATUS_HEX.draft!} size="footnote">
                                {note}
                              </Text>
                            )}
                          </Box>
                        )
                      }),
                  { key: `rp-group-${g.id}`, title: `${g.title} · ${g.items.length}` },
                ),
              ),
              <Box key="replan-actions" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
                <Button key="replan-apply" label={`Apply selected (${d.ticked})`} {...(d.ticked > 0 ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => applySelected($)} />
                <Button key="replan-dismiss" label="Dismiss selected" onPress={() => dismissSelected($)} />
                <Text key="replan-hint" color={G.faint} size="footnote">
                  Nothing is ticked until you tick it. Unticked items stay in the proposal.
                </Text>
              </Box>,
            ]}
    </Box>
  )
}

export function replanView($: $, ui: UI, v: ReplanView): RenderChildren {
  const { Box, Text, Button } = ui
  const d = reviewData()
  const b = replanBanner()
  return (
    <Box flexDirection="column" gap={1}>
      {termHeader($, ui, `Replan review${d.lp === undefined ? '' : ` · ${d.lp.path} · ${d.applied} applied · ${d.dismissed} dismissed`}`, v.from)}
      {termMessage(ui)}
      {d.lp === undefined ? (
        <Box key="replan-empty" flexDirection="column">
          <Text dimColor>{'No replan proposal yet. Replan writes one to design/changes/<date>-replan.md.'}</Text>
          {b?.start === undefined ? null : <Button key="replan-start" label="Replan" onPress={() => replan($)} />}
        </Box>
      ) : d.problem !== undefined ? (
        <Box key="replan-problem" flexDirection="column">
          <Text color="error">{`⚠ ${d.problem}`}</Text>
          <Text dimColor>Fix the file (format in docs/STANDARD.md, section 8) or make a new proposal.</Text>
          {b?.start === undefined ? null : <Button key="replan-start" label="↻ New proposal" onPress={() => replan($)} />}
        </Box>
      ) : (
        <Box key="replan-groups" flexDirection="column" gap={1}>
          {d.groups.map(g => (
            <Box key={`rp-group-${g.id}`} flexDirection="column">
              <Text bold>{`${g.title} (${g.items.length})`}</Text>
              {g.items.length === 0 ? (
                <Text key={`rp-none-${g.id}`} dimColor>
                  {'  nothing to review'}
                </Text>
              ) : null}
              {g.items.map(it => {
                const note = builtNote(d.rm, it)
                return (
                  <Box key={`rp-item-${it.index}`} flexDirection="column" paddingLeft={2}>
                    <Button key={`rp-tick-${it.index}`} label={`${S.replanTicks.has(it.index) ? '[x]' : '[ ]'} ${it.title}`} plain onPress={() => toggleTick($, it.index)} />
                    <Text key={`rp-reason-${it.index}`} dimColor>{`    ${it.reason === '' ? 'No reason given.' : it.reason}`}</Text>
                    {it.problem === '' ? null : <Text key={`rp-problem-${it.index}`} color="error">{`    ⚠ ${it.problem}`}</Text>}
                    {note === '' ? null : <Text key={`rp-note-${it.index}`} color="warning">{`    ${note}`}</Text>}
                  </Box>
                )
              })}
            </Box>
          ))}
          <Box key="replan-actions" flexDirection="row" columnGap={1} flexWrap="wrap">
            <Button key="replan-apply" label={`Apply selected (${d.ticked})`} {...(d.ticked > 0 ? {} : { dimColor: true })} onPress={() => applySelected($)} />
            <Button key="replan-dismiss" label="Dismiss selected" onPress={() => dismissSelected($)} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

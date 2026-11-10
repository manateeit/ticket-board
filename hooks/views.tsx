// The pane's views: Start, Board, Ticket, Questions, New ticket, BOARD.md.
import { ActivityBar, ProjectBar, deskBoard, deskNew, deskReadme, deskStart, deskTicket, openReadme } from './desk'
import type { Elements, EngineInterface, RenderChildren } from 'claude-code'

import { STATUSES } from './core/board'
import { MODE_OPTIONS, OFF_PLAN, SHOW_OPTIONS, SORT_OPTIONS, query, runLine, titleFromIdea, type Filters } from './core/query'
import { allBuilds, type Alert } from './core/roadmap'
import { START_STEPS, isBlankProject, startStep, type StartFacts, type StartStep } from './core/project'
import { isReadyable, readiness } from './core/ticket'
import { startJob, suggestAnswer } from './ai'
import { G, STATUS_HEX, barSvg, heroSvg, tint } from './glass'
import {
  S,
  boardPath,
  createSkeleton,
  dir,
  editRow,
  isLive,
  items,
  jobFor,
  loadAgents,
  redraw,
  refresh,
  phaseName,
  roadmapView,
  rowOf,
  saveAnswer,
  saveFilters,
  say,
  setStartFlag,
  statusOf,
  ticketOfAgent,
  type View,
  abs,
} from './store'

type $ = EngineInterface
export type UI = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Input' | 'Select' | 'Markdown'> & { Svg?: Elements['desktop']['Svg']; Link?: Elements['terminal']['Link'] }
export type Frame = { rows: number; columns: number; glass?: boolean }

export const SHOW_LABEL: Record<string, string> = {
  'needs-me': 'Needs me (draft + blocked)',
  'not-done': 'Not done',
  all: 'All',
}
export const SORT_LABEL: Record<string, string> = {
  number: 'Number ↑',
  'number-desc': 'Number ↓',
  status: 'Status',
  questions: 'Open questions',
  updated: 'Recently edited',
  phase: 'Phase',
}
const TONE: Record<string, string> = {
  draft: 'warning',
  ready: 'success',
  'in-progress': 'suggestion',
  'in-check': 'permission',
  done: 'subtle',
  blocked: 'error',
  unlisted: 'error',
}

export function go($: $, view: View) {
  S.view = view
  S.confirm = undefined
  S.message = undefined
  redraw($)
}

export function fail($: $, err: unknown) {
  say($, err instanceof Error ? err.message : String(err), 'error')
}

export async function fill($: $, text: string, note: string) {
  try {
    const r = await $.prompt.fill({ text, mode: 'replace' })
    say($, r.isFilled ? note : 'The prompt box is busy — copy this instead: ' + text, r.isFilled ? 'success' : 'warning')
  } catch (err) {
    fail($, err)
  }
}

export function blockersOpen(blockedBy: string[]): string[] {
  return blockedBy.filter(n => statusOf(n) !== 'done')
}

/** Ready tickets whose blockers are all done. */
export function runnable(): string[] {
  return items()
    .filter(i => i.status === 'ready' && blockersOpen(i.blockedBy).length === 0)
    .map(i => i.number)
}

export function runTicket($: $, number: string) {
  const open = blockersOpen(rowOf(number)?.blockedBy ?? [])
  const base = runLine([number], S.hasRouter)
  const text = open.length === 0 ? base : `${base.replace(/\.$/, '')} — but only once ${open.join(', ')} ${open.length === 1 ? 'is' : 'are'} done.`
  void fill($, text, 'In your prompt box — press Enter to send it')
}

export function setFilters($: $, change: Partial<Filters>) {
  S.filters = { ...S.filters, ...change }
  S.page = 0
  void saveFilters($)
  redraw($)
}

/** Everything a filter reset puts back (the phase filter included). */
export const CLEARED: Partial<Filters> = { show: 'all', kind: 'any', mode: 'any', search: '', phase: 'any' }

// ---------- Roadmap summary (shared by both surfaces) ----------

export type PlanSummary = {
  planPct: number
  ticketPct: number
  /** Current phase id (the last one once the plan is complete), as shown: `P2`. */
  phase: string
  phaseTitle: string
  phasePct: number
  phaseCount: number
  /** Built and counted builds of the current phase (of the whole plan once complete). */
  built: number
  counted: number
  isComplete: boolean
  /** `P2.4 (no ticket)`; undefined when nothing is unblocked or the plan is complete. */
  nextUp?: string
  /** The tile's sub-line: `P2 of 4 · D 5/9 · tickets 67%`. */
  sub: string
  /** The terminal line: `Plan 46% · P2 60% · design v3 (plan behind) · tickets 67%`. */
  compact: string
  warnings: string[]
  phases: { id: string; label: string; pct: number }[]
}

const listIds = (ids: string[]) => ids.join(', ')

/** One short line per roadmap check (the 0003 `checks` output), worded for the board. */
export function warningLine(a: Alert, designVersion: number | undefined): string {
  const n = a.subjects.length
  switch (a.id) {
    case 'plan-behind':
      return designVersion === undefined ? 'Plan is behind the design' : `Plan is behind design v${designVersion}`
    case 'section-no-build':
      return `${listIds(a.subjects)} ${n === 1 ? 'has' : 'have'} no build`
    case 'build-no-ticket':
      return n === 1 ? `${a.subjects[0]} has no ticket` : `${n} builds have no ticket: ${listIds(a.subjects)}`
    case 'stale-tickets':
      return `${n} stale ticket${n === 1 ? '' : 's'}: ${listIds(a.subjects)}`
    case 'off-plan':
      return `${n} off-plan`
    default:
      return a.message
  }
}

/** The plan's progress for the header tile, the Roadmap card and the terminal line. Undefined with no plan bound. */
export function planSummary(): PlanSummary | undefined {
  const rm = roadmapView()?.rm
  if (rm === undefined) return undefined
  const all = items()
  const done = all.filter(i => i.status === 'done').length
  const ticketPct = all.length === 0 ? 0 : Math.round((done / all.length) * 100)
  const prog = rm.progress
  const isComplete = prog.currentPhase === undefined
  const cur = prog.phases.find(p => p.id === prog.currentPhase) ?? prog.phases[prog.phases.length - 1]!
  const phase = phaseName(cur.id)
  const hasDesign = rm.design.sections.length > 0
  const counted = isComplete ? prog.phases.reduce((s, p) => s + p.counted, 0) : cur.counted
  const built = isComplete ? prog.phases.reduce((s, p) => s + p.built, 0) : cur.built
  let nextUp: string | undefined
  if (prog.nextUp !== undefined && !isComplete) {
    const ts = rm.links.byBuild[prog.nextUp] ?? []
    nextUp = `${prog.nextUp} (${ts.length === 0 ? 'no ticket' : ts.map(t => t.number).join(', ')})`
  }
  const isBehind = rm.checks.some(a => a.id === 'plan-behind')
  const sub = [`${phase} of ${prog.phases.length}`, hasDesign ? `D ${rm.coverage.built}/${rm.coverage.counted}` : '', `tickets ${ticketPct}%`].filter(Boolean).join(' · ')
  const compact = [
    `Plan ${prog.planPct}%`,
    `${phase} ${cur.pct}%`,
    rm.design.version === undefined ? '' : `design v${rm.design.version}${isBehind ? ' (plan behind)' : ''}`,
    `tickets ${ticketPct}%`,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    planPct: prog.planPct,
    ticketPct,
    phase,
    phaseTitle: cur.title,
    phasePct: cur.pct,
    phaseCount: prog.phases.length,
    built,
    counted,
    isComplete,
    nextUp,
    sub,
    compact,
    warnings: rm.checks.map(a => warningLine(a, rm.design.version)),
    phases: prog.phases.map(p => ({ id: phaseName(p.id), label: p.title, pct: p.pct })),
  }
}

/** Options for the phase filter: Any, each phase, then Off-plan. */
export function phaseOptions(): { value: string; label: string }[] {
  const rm = roadmapView()?.rm
  if (rm === undefined) return []
  return [{ value: 'any', label: 'Any' }, ...rm.plan.phases.map(p => ({ value: phaseName(p.id), label: phaseName(p.id) })), { value: OFF_PLAN, label: 'Off-plan' }]
}

export type TicketPlan = {
  /** `P2.2 · One Accept per intent`, `Off-plan`, or `P9.9 — not in the plan`. */
  item: string
  isMissing: boolean
  isOffPlan: boolean
  chips: { label: string; isStale: boolean }[]
  /** `Written against D3 rev 1, now rev 2`, one per stale reference. */
  stale: string[]
}

/** The ticket's plan item and design chips. Undefined with no plan bound. */
export function ticketPlan(number: string): TicketPlan | undefined {
  const rv = roadmapView()
  const rm = rv?.rm
  if (rm === undefined) return undefined
  const ref = rv!.refs.get(number)
  const builds = allBuilds(rm.plan)
  const linked = builds.find(b => (rm.links.byBuild[b.id] ?? []).some(t => t.number === number))
  const named = ref?.plan === undefined ? undefined : builds.find(b => b.id === ref.plan)
  const build = named ?? linked
  const isMissing = ref?.plan !== undefined && named === undefined
  const isOffPlan = !isMissing && build === undefined
  const item = isMissing ? `${ref!.plan} — not in the plan` : build === undefined ? 'Off-plan' : `${build.id} · ${build.name}`
  const chips: TicketPlan['chips'] = []
  const stale: string[] = []
  for (const d of ref?.design ?? []) {
    const sec = rm.design.sections.find(x => x.id === d.id)
    const isStale = sec !== undefined && !sec.isDropped && d.rev !== undefined && d.rev < sec.rev
    chips.push({ label: d.rev === undefined ? d.id : `${d.id}@${d.rev}`, isStale })
    if (isStale) stale.push(`Written against ${d.id} rev ${d.rev}, now rev ${sec!.rev}`)
  }
  return { item, isMissing, isOffPlan, chips, stale }
}

let glass = false

function Header(ui: UI, title: string, $: $, back?: View) {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="row" gap={1} {...(glass ? { paddingBottom: 1 } : {})}>
      {back !== undefined && <Button key="back" label="‹ Back" plain onPress={() => go($, back)} />}
      <Text bold wrap="truncate" {...(glass ? { size: 'heading' as const, weight: 'bold' as const } : {})}>
        {title}
      </Text>
    </Box>
  )
}

function Message(ui: UI): RenderChildren {
  const { Text } = ui
  if (S.message === undefined) return null
  return <Text color={S.message.tone}>{S.message.text}</Text>
}

// ---------- Board ----------

/** The terminal's Agents panel: the same lists as the desktop card, as plain lines. */
function agentsPanel($: $, ui: UI, all: ReturnType<typeof items>): RenderChildren {
  const { Box, Text, Button } = ui
  const live = S.agents.filter(isLive)
  const past = S.agents.filter(a => !isLive(a)).slice(-5).reverse()
  const flight = all.filter(i => i.status === 'in-progress' || i.status === 'in-check')
  const line = (a: (typeof S.agents)[number], dim: boolean) => {
    const t = ticketOfAgent(a)
    return (
      <Text key={`agent-${a.id}`} dimColor={dim} wrap="truncate">
        {`● ${a.status}  ${a.name ?? (a.description || a.type)}  · ${a.type}${t === undefined ? '' : ` · ${t}`}`}
      </Text>
    )
  }
  return (
    <Box key="agents-panel" flexDirection="column" borderStyle="round" paddingX={1}>
      <Box flexDirection="row" columnGap={2}>
        <Text bold>{`AGENTS · ${live.length} RUNNING`}</Text>
        <Button key="agents-hide" label="Hide" plain onPress={() => ((S.showAgents = false), redraw($))} />
      </Box>
      {live.length === 0 ? <Text key="agents-none" dimColor>No agents running in this session right now.</Text> : live.map(a => line(a, false))}
      {flight.length > 0 && <Text key="agents-flight" dimColor>{`In flight on the board (${flight.length}): ${flight.map(i => `${i.number} ${i.title}`).join(', ')}`}</Text>}
      {past.length > 0 && <Text key="agents-past" dimColor>Recently finished</Text>}
      {past.map(a => line(a, true))}
    </Box>
  )
}

function boardView($: $, ui: UI, frame: Frame): RenderChildren {
  const { Box, Text, Button, Input, Select, Markdown } = ui
  const all = items()
  const counts = STATUSES.map(s => [s, all.filter(i => i.status === s).length] as const).filter(([, n]) => n > 0)
  const list = query(all, S.filters)
  const pageSize = Math.max(4, Math.floor((frame.rows - 10) / 2))
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(S.page, pages - 1)
  const shown = list.slice(page * pageSize, page * pageSize + pageSize)
  const run = runnable()
  const unlisted = all.filter(i => i.isUnlisted).length
  // BOARD.md as written: the text above the table, the live table, the text below it.
  const lines = (S.snap?.boardText ?? '').split(/\r?\n/)
  const board = S.snap?.board
  const before = board === undefined ? '' : lines.slice(0, board.headerLine).join('\n').trim()
  const after = board === undefined ? '' : lines.slice(board.lastLine + 1).join('\n').trim()
  const plan = planSummary()
  const planWarning = roadmapView()?.warning
  const phases = phaseOptions()
  const isFiltered = S.filters.show !== 'all' || S.filters.mode !== 'any' || S.filters.search.trim() !== '' || (plan !== undefined && (S.filters.phase ?? 'any') !== 'any')
  return (
    <Box flexDirection="column" gap={1}>
      {bannerView($, ui)}
      {glass && ui.Svg !== undefined ? (
        <ui.Svg
          key="hero"
          alt={`${heading(before)}: ${counts.map(([s, n]) => `${s} ${n}`).join(', ') || 'no tickets yet'}`}
          isInteractive
          source={heroSvg({
            title: heading(before),
            path: boardPath(),
            counts,
            total: all.length,
            done: all.filter(i => i.status === 'done').length,
            needsMe: all.filter(i => i.status === 'draft' || i.status === 'blocked').length,
          })}
        />
      ) : (
        before !== '' && <Markdown key="board-before" text={before} />
      )}
      {glass && ui.Svg !== undefined && intro(before) !== '' && <Markdown key="board-intro" text={intro(before)} />}
      {glass && ui.Svg !== undefined && all.length > 0 && <ui.Svg key="bar" alt="Share of tickets in each status" source={barSvg(counts, all.length)} />}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} {...(glass && ui.Svg !== undefined ? { display: 'none' as never } : {})}>
        {counts.length === 0 ? (
          <Text dimColor>No tickets yet</Text>
        ) : (
          counts.map(([s, n]) => (
            <Text color={TONE[s]}>
              {s} {n}
            </Text>
          ))
        )}
      </Box>
      {plan !== undefined && (
        <Box key="plan-line" flexDirection="column">
          <Text bold color="claude">
            {plan.compact}
          </Text>
          {plan.warnings.length > 0 && <Text color="warning">{`⚠ ${plan.warnings[0]}`}</Text>}
        </Box>
      )}
      {planWarning !== undefined && <Text color="warning">{`⚠ ${planWarning}`}</Text>}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="new" label="+ New ticket" hotkey="n" variant="primary" onPress={() => go($, { kind: 'new' })} />
        {run.length > 0 && (
          <Button key="runall" label={`▶ Run ready (${run.length})`} hotkey="x" onPress={() => void fill($, runLine(run, S.hasRouter), 'In your prompt box — press Enter to send it to the router')} />
        )}
        <Button key="refresh" label="Refresh" hotkey="r" onPress={() => void refresh($, true).then(() => say($, 'Refreshed'), () => undefined)} />
        <Button
          key="agents"
          label={`Agents ● ${S.agents.filter(isLive).length}`}
          hotkey="a"
          variant={S.showAgents ? 'primary' : undefined}
          onPress={() => {
            S.showAgents = !S.showAgents
            redraw($)
            if (S.showAgents) void loadAgents($)
          }}
        />
      </Box>
      {S.showAgents && agentsPanel($, ui, all)}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Select
          key="show"
          label="Show"
          value={S.filters.show}
          options={SHOW_OPTIONS.map(v => ({ value: v, label: SHOW_LABEL[v] ?? v }))}
          onSelect={v => setFilters($, { show: v as Filters['show'] })}
        />
        <Select
          key="sort"
          label="Sort"
          value={S.filters.sort}
          options={SORT_OPTIONS.filter(v => v !== 'phase' || plan !== undefined).map(v => ({ value: v, label: SORT_LABEL[v] ?? v }))}
          onSelect={v => setFilters($, { sort: v as Filters['sort'] })}
        />
        <Select
          key="mode"
          label="Mode"
          value={S.filters.mode}
          options={MODE_OPTIONS.map(v => ({ value: v, label: v === 'any' ? 'Any mode' : v }))}
          onSelect={v => setFilters($, { mode: v as Filters['mode'] })}
        />
        {phases.length > 0 && (
          <Select
            key="phase"
            label="Phase"
            value={S.filters.phase ?? 'any'}
            options={phases.map(o => ({ value: o.value, label: o.value === 'any' ? 'Any phase' : o.label }))}
            onSelect={v => setFilters($, { phase: v })}
          />
        )}
        <Button
          key="hide-done"
          label={S.filters.hideDone === true ? '[x] Hide done' : '[ ] Hide done'}
          hotkey="h"
          plain
          onPress={() => setFilters($, { hideDone: S.filters.hideDone !== true })}
        />
      </Box>
      <Input
        key="search"
        label="Search"
        placeholder="number, title, notes…"
        value={S.filters.search}
        submitLabel="Filter"
        onInput={v => setFilters($, { search: v })}
        onSubmit={v => setFilters($, { search: v })}
      />
      {Message(ui)}
      <Box flexDirection="column" {...(glass ? { gap: 1 } : {})}>
        {shown.length === 0 && (
          <Text dimColor>
            {all.length === 0 ? 'The board has no tickets. Press + New ticket.' : `Nothing matches (${all.length} tickets on the board). Try Show: All.`}
          </Text>
        )}
        {shown.map(i => {
          const job = jobFor(i.number)
          const waiting = blockersOpen(i.blockedBy)
          const canReady = i.status === 'draft' && isReadyable(checksFor(i.number))
          const marks = [
            i.openQuestions > 0 ? `?${i.openQuestions}` : '',
            canReady ? '✓' : '',
            waiting.length > 0 && i.status !== 'done' ? '⛔' : '',
            job !== undefined ? '✎' : '',
            i.isUnlisted ? '⚠' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const details = [
            i.phase === undefined ? '' : i.phase === '' ? 'off-plan' : i.phase,
            i.mode !== '' ? i.mode : '',
            i.blockedBy.length > 0 ? `blocked by ${i.blockedBy.join(', ')}` : '',
            i.owner !== '' && i.owner !== '—' ? `owner ${i.owner}` : '',
            i.notes !== '' && i.notes !== '—' ? i.notes : '',
          ]
            .filter(Boolean)
            .join(' · ')
          const open = () => go($, { kind: 'ticket', number: i.number, tab: 'rd' })
          return (
            <Box
              key={`row-${i.number}`}
              flexDirection="column"
              hover={{ backgroundColor: glass ? G.cardHover : 'promptBorder' }}
              {...(glass
                ? { backgroundColor: G.card, borderStyle: 'round', borderColor: tint(STATUS_HEX[i.status] ?? G.accent, 0.4), paddingX: 1 }
                : {})}
            >
              <Box flexDirection="row" gap={1}>
                <Button key={`open-${i.number}`} label={i.number} plain onPress={open} />
                {glass ? (
                  <Text color={STATUS_HEX[i.status] ?? G.accent} backgroundColor={tint(STATUS_HEX[i.status] ?? G.accent, 0.16)} weight="semibold">
                    {` ${i.status} `}
                  </Text>
                ) : (
                  <Text color={TONE[i.status]}>{i.status.padEnd(11)}</Text>
                )}
                <Box flexGrow={1} flexShrink={1}>
                  <Text wrap="truncate" {...(glass ? { weight: 'semibold' as const } : {})}>
                    {i.title}
                  </Text>
                </Box>
                {marks !== '' && <Text color="warning">{marks}</Text>}
              </Box>
              <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={5}>
                {details !== '' && (
                  <Box flexShrink={1}>
                    <Text dimColor wrap="truncate">
                      {details}
                    </Text>
                  </Box>
                )}
                {i.status === 'draft' && i.openQuestions > 0 && job === undefined && (
                  <Button key={`ans-${i.number}`} label={`Answer (${i.openQuestions})`} plain onPress={() => go($, { kind: 'questions', number: i.number })} />
                )}
                {canReady && job === undefined && (
                  <Button key={`rdy-${i.number}`} label="✓ Ready" plain onPress={() => void setStatus($, i.number, 'ready', 'draft')} />
                )}
                {i.status === 'ready' && (
                  <Button key={`run-${i.number}`} label="▶ Run" plain onPress={() => runTicket($, i.number)} />
                )}
                {i.status === 'ready' && (
                  <Button key={`drf-${i.number}`} label="↩ Draft" plain onPress={() => void setStatus($, i.number, 'draft', 'ready')} />
                )}
                {i.status === 'blocked' && (
                  <Button key={`unb-${i.number}`} label="Unblock" plain onPress={() => void setStatus($, i.number, 'draft', 'blocked')} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
      {pages > 1 && (
        <Box flexDirection="row" gap={1}>
          <Button key="prev" label="‹ Prev" plain onPress={() => ((S.page = Math.max(0, page - 1)), redraw($))} />
          <Text dimColor>
            page {page + 1}/{pages} · {list.length} tickets
          </Text>
          <Button key="next" label="Next ›" plain onPress={() => ((S.page = Math.min(pages - 1, page + 1)), redraw($))} />
        </Box>
      )}
      {isFiltered && list.length < all.length && (
        <Text dimColor>
          Showing {list.length} of {all.length} tickets
        </Text>
      )}
      <Text dimColor>
        ?N open questions · ✓ can be marked ready · ⛔ waits on a ticket · ✎ AI writing{unlisted > 0 ? ' · ⚠ folder not on board' : ''}
      </Text>
      {after !== '' && <Markdown key="board-after" text={after} />}
    </Box>
  )
}

export function checksFor(number: string) {
  const f = S.snap?.files.get(number)
  return readiness({ rd: f?.rd, ev: f?.ev, blockedBy: rowOf(number)?.blockedBy ?? [], statusOf })
}

// ---------- Ticket ----------

export async function setStatus($: $, number: string, to: string, from: string, notes?: string) {
  try {
    await editRow($, number, notes === undefined ? { status: to } : { status: to, notes }, from)
    say($, `${number} → ${to}`)
  } catch (err) {
    await refresh($, true)
    fail($, err)
  }
}

function ticketView($: $, ui: UI, number: string, tab: 'rd' | 'eval'): RenderChildren {
  const { Box, Text, Button, Input, Select, Markdown } = ui
  const row = rowOf(number)
  const f = S.snap?.files.get(number)
  const title = row?.title || f?.title || '(untitled)'
  const status = row?.status ?? 'unlisted'
  const checks = checksFor(number)
  const canReady = isReadyable(checks)
  const open = (f?.questions ?? []).filter(q => !q.isResolved)
  const answered = (f?.questions ?? []).filter(q => q.isResolved)
  const job = jobFor(number)
  const waiting = blockersOpen(row?.blockedBy ?? [])
  const path = f === undefined ? undefined : `${dir()}/${f.folder}`
  const tp = ticketPlan(number)
  const isConfirming = (k: string) => S.confirm === `${number}:${k}`
  const confirm = (k: string) => {
    S.confirm = `${number}:${k}`
    redraw($)
  }

  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, `${number} — ${title}`, $, { kind: 'board' })}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text color={TONE[status]} bold>
          {status}
        </Text>
        {row !== undefined && <Text dimColor>mode {row.mode || '—'}</Text>}
        {row !== undefined && <Text dimColor>blocked by {row.blockedBy.length === 0 ? '—' : row.blockedBy.join(', ')}</Text>}
        {row !== undefined && row.owner !== '' && row.owner !== '—' && <Text dimColor>owner {row.owner}</Text>}
      </Box>
      {row !== undefined && row.notes !== '' && <Text dimColor>Notes: {row.notes}</Text>}
      {tp !== undefined && (
        <Box key="plan-props" flexDirection="column">
          <Text color={tp.isMissing ? 'error' : undefined} dimColor={!tp.isMissing}>
            {`Plan item: ${tp.item}`}
          </Text>
          {tp.chips.length > 0 && <Text dimColor>{`Design: ${tp.chips.map(c => (c.isStale ? `${c.label} (stale)` : c.label)).join(', ')}`}</Text>}
          {tp.stale.map(line => (
            <Text key={`stale-${line}`} color="warning">{`⚠ ${line}`}</Text>
          ))}
        </Box>
      )}
      {row === undefined && <Text color="error">⚠ BOARD.md has no row for this ticket folder.</Text>}
      {f === undefined && <Text color="error">⚠ No folder {dir()}/{number}-… for this row.</Text>}
      {Message(ui)}

      {status === 'draft' && (
        <Box flexDirection="column">
          <Text bold>Ready check</Text>
          {checks.map(c => (
            <Text color={c.isOk ? 'success' : c.isHard ? 'error' : 'warning'}>
              {c.isOk ? '✓' : c.isHard ? '✗' : '!'} {c.label}
              {c.detail !== undefined ? ` — ${c.detail}` : ''}
            </Text>
          ))}
        </Box>
      )}

      {job !== undefined && (
        <Box flexDirection="row" gap={1}>
          <Text color="claude">✎ AI is {job.kind === 'draft' ? 'writing' : job.kind === 'enhance' ? 'enhancing' : 'folding answers into'} this ticket…</Text>
          <Button key="viewagent" label="Watch" plain onPress={() => void $.ui.view({ agentId: job.agentId }).catch(() => undefined)} />
        </Box>
      )}

      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0}>
        {status === 'ready' && <Button key="run" label="▶ Run this ticket" hotkey="x" variant="primary" onPress={() => runTicket($, number)} />}
        {f !== undefined && status !== 'done' && (open.length > 0 || answered.length > 0) && (
          <Button
            key="questions"
            label={open.length > 0 ? `Answer questions (${open.length})` : `Questions (${answered.length} answered)`}
            hotkey="q"
            variant={status === 'draft' && open.length > 0 ? 'primary' : 'secondary'}
            onPress={() => go($, { kind: 'questions', number })}
          />
        )}
        {status === 'draft' && canReady && (
          <Button key="ready" label="✓ Mark ready" hotkey="m" variant="primary" onPress={() => void setStatus($, number, 'ready', 'draft')} />
        )}
        {status === 'ready' && <Button key="draft" label="Back to draft" hotkey="d" onPress={() => void setStatus($, number, 'draft', 'ready')} />}
        {status === 'draft' && f !== undefined && job === undefined && (
          <Button key="enhance" label="✎ Enhance with AI" hotkey="e" onPress={() => void startJob($, number, 'enhance')} />
        )}
        {status === 'blocked' && (
          <>
            <Button key="unblock-draft" label="Unblock → draft" onPress={() => void setStatus($, number, 'draft', 'blocked')} />
            <Button key="unblock-ready" label="Unblock → ready" onPress={() => void setStatus($, number, 'ready', 'blocked')} />
          </>
        )}
        {row !== undefined && status !== 'blocked' && status !== 'done' && (
          <Button key="block" label="Block…" onPress={() => confirm('block')} />
        )}
      </Box>

      {isConfirming('block') && (
        <Input
          key={`block-${number}`}
          label="Why is it blocked? (goes in Notes)"
          autoFocus
          submitLabel="Mark blocked"
          onSubmit={reason => {
            S.confirm = undefined
            void setStatus($, number, 'blocked', status, `blocked: ${reason.trim() || 'no reason given'}`)
          }}
        />
      )}

      {row !== undefined && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Select
            key={`mode-${number}`}
            label="Mode"
            value={row.mode === 'team' ? 'team' : 'solo'}
            options={[{ value: 'solo' }, { value: 'team' }]}
            onSelect={v => void editRow($, number, { mode: v }).then(() => say($, `Mode → ${v}`), err => fail($, err))}
          />
          <Input
            key={`blockedby-${number}`}
            label="Blocked by"
            value={row.blockedBy.join(', ')}
            placeholder="ticket numbers, e.g. 0003, 0007"
            submitLabel="Save"
            onSubmit={v => {
              const nums = (v.match(/\d{1,4}/g) ?? []).map(n => n.padStart(4, '0')).filter(n => n !== number)
              void editRow($, number, { blockedBy: nums.length === 0 ? '—' : nums.join(', ') }).then(() => say($, 'Blocked by saved'), err => fail($, err))
            }}
          />
        </Box>
      )}

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button
          key="discuss"
          label="Discuss in chat"
          plain
          onPress={() => void fill($, `Let's look at ticket ${number} (${path ?? dir()}/rd.md). `, 'Started a message in your prompt box')}
        />
        {path !== undefined && (
          <Button key="copy" label="Copy path" plain onPress={p => void $.ui.copy({ text: path, surface: p.surface }).then(() => say($, `Copied ${path}`))} />
        )}
        {row !== undefined && (
          <Button key="override" label="Change status…" plain onPress={() => confirm('override')} />
        )}
      </Box>

      {isConfirming('override') && row !== undefined && (
        <Box flexDirection="column">
          <Text color="warning">
            The router normally moves in-progress / in-check / done. Change it by hand only to fix the board.
          </Text>
          <Box flexDirection="row" gap={1}>
            <Select
              key={`override-${number}`}
              label="Set status"
              value={S.overrideTo || status}
              options={STATUSES.map(s => ({ value: s }))}
              onSelect={v => ((S.overrideTo = v), redraw($))}
            />
            <Button
              key="override-ok"
              label="Apply"
              variant="primary"
              onPress={() => {
                const to = S.overrideTo || status
                S.confirm = undefined
                S.overrideTo = ''
                if (to !== status) void setStatus($, number, to, status)
              }}
            />
            <Button key="override-cancel" label="Cancel" plain onPress={() => ((S.confirm = undefined), redraw($))} />
          </Box>
        </Box>
      )}

      {f !== undefined && (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="tab-rd" label={tab === 'rd' ? '[rd.md]' : 'rd.md'} plain onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
            <Button key="tab-eval" label={tab === 'eval' ? '[eval.md]' : 'eval.md'} plain onPress={() => go($, { kind: 'ticket', number, tab: 'eval' })} />
          </Box>
          <Markdown key={`md-${number}-${tab}`} text={(tab === 'rd' ? f.rd : f.ev) ?? `_No ${tab === 'rd' ? 'rd' : 'eval'}.md yet._`} />
        </Box>
      )}
      {waiting.length > 0 && status === 'ready' && <Text color="warning">Waits for {waiting.join(', ')} before the router will start it.</Text>}
    </Box>
  )
}

// ---------- Questions ----------

function questionsView($: $, ui: UI, number: string): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const f = S.snap?.files.get(number)
  const qs = f?.questions ?? []
  const open = qs.filter(q => !q.isResolved)
  const answered = qs.filter(q => q.isResolved)
  const job = jobFor(number)
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, `${number} — open questions`, $, { kind: 'ticket', number, tab: 'rd' })}
      {Message(ui)}
      {open.length === 0 && <Text color="success">✓ No open questions left.</Text>}
      {open.map((q, n) => {
        const key = `q-${number}-${q.index}`
        const draft = S.drafts.get(key) ?? ''
        return (
          <Box key={`box-${key}`} flexDirection="column">
            <Text bold>
              {n + 1}. {q.text}
            </Text>
            {q.detail !== '' && <Text dimColor>{q.detail}</Text>}
            <Input
              key={key}
              label="Answer"
              value={draft}
              rows={2}
              autoFocus={n === 0 ? true : undefined}
              placeholder="Type the decision, then Save"
              submitLabel="Save"
              onInput={v => void S.drafts.set(key, v)}
              onSubmit={v => {
                if (v.trim() === '') return say($, 'Type an answer first', 'warning')
                void saveAnswer($, number, q, v)
                  .then(() => {
                    S.drafts.delete(key)
                    say($, `Saved answer to question ${n + 1}`)
                  })
                  .catch(err => fail($, err))
              }}
            />
            <Box flexDirection="row" gap={1}>
              <Button
                key={`suggest-${key}`}
                label={S.suggesting.has(key) ? 'Thinking…' : 'Suggest (AI)'}
                plain
                onPress={() => {
                  if (S.suggesting.has(key)) return
                  S.suggesting.add(key)
                  redraw($)
                  void suggestAnswer($, number, q).then(s => {
                    S.suggesting.delete(key)
                    if (s !== undefined) S.drafts.set(key, s)
                    redraw($)
                  })
                }}
              />
              <Button
                key={`discuss-${key}`}
                label="Discuss in chat"
                plain
                onPress={() =>
                  void fill($, `Ticket ${number} (${dir()}/${f?.folder}/rd.md) asks: "${q.text}" — help me decide. `, 'Started a message in your prompt box')
                }
              />
            </Box>
          </Box>
        )
      })}
      {answered.length > 0 && (
        <Box flexDirection="column">
          <Text bold dimColor>
            Answered ({answered.length})
          </Text>
          {answered.map(q => (
            <Text dimColor>
              ✓ {q.text}
              {'\n'}
              {'   '}
              {q.detail.split('\n').slice(-1)[0] ?? ''}
            </Text>
          ))}
          {job === undefined ? (
            <Button
              key="fold"
              label="✎ Fold answers into the ticket (AI)"
              onPress={() => void startJob($, number, 'fold')}
            />
          ) : (
            <Text color="claude">✎ AI is working on this ticket…</Text>
          )}
        </Box>
      )}
      {open.length === 0 && rowOf(number)?.status === 'draft' && (
        <Button key="toticket" label="Back to the ticket to mark it ready" variant="primary" onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
      )}
    </Box>
  )
}

// ---------- New ticket ----------

export async function createTicket($: $, withAI: boolean) {
  const idea = (S.drafts.get('new-idea') ?? '').trim()
  if (idea === '') return say($, 'Describe the ticket first', 'warning')
  const blockedBy = ((S.drafts.get('new-blocked') ?? '').match(/\d{1,4}/g) ?? []).map(n => n.padStart(4, '0'))
  try {
    const { number } = await createSkeleton(
      $,
      { title: (S.drafts.get('new-title') ?? '').trim() || titleFromIdea(idea), text: idea, mode: S.newMode, blockedBy, kind: S.newKind },
      withAI ? 'AI drafting…' : 'Skeleton — fill in rd.md and eval.md',
    )
    S.drafts.delete('new-idea')
    S.drafts.delete('new-blocked')
    S.drafts.delete('new-title')
    go($, { kind: 'ticket', number, tab: 'rd' })
    if (withAI) await startJob($, number, 'draft', idea)
    else say($, `Created ${number} as a draft skeleton`)
  } catch (err) {
    fail($, err)
  }
}

export async function draftInChat($: $) {
  const idea = (S.drafts.get('new-idea') ?? '').trim()
  if (idea === '') return say($, 'Describe the ticket first', 'warning')
  const hasOwn = await $.fs.exists(abs('.claude/skills/ticket/SKILL.md')).catch(() => false)
  await fill($, `/${hasOwn ? 'ticket' : 'ticket-board:ticket'} ${idea}`, 'In your prompt box — press Enter to draft it in chat')
}

function newView($: $, ui: UI): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const idea = S.drafts.get('new-idea') ?? ''
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, 'New ticket', $, { kind: 'board' })}
      <Text dimColor>
        Describe the feature or fix in your own words. The AI explores the code and writes rd.md + eval.md in the /ticket format, as a draft — it asks
        you anything it cannot decide.
      </Text>
      <Input
        key="new-idea"
        label="Idea"
        rows={5}
        autoFocus
        value={idea}
        placeholder="e.g. Let people export the board as CSV from the settings page"
        submitLabel="Create + enhance"
        onInput={v => void S.drafts.set('new-idea', v)}
        onSubmit={v => {
          S.drafts.set('new-idea', v)
          void createTicket($, true)
        }}
      />
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Select key="new-mode" label="Mode" value={S.newMode} options={[{ value: 'solo' }, { value: 'team' }]} onSelect={v => ((S.newMode = v), redraw($))} />
        <Input
          key="new-blocked"
          label="Blocked by"
          value={S.drafts.get('new-blocked') ?? ''}
          placeholder="—"
          submitLabel="Set"
          onInput={v => void S.drafts.set('new-blocked', v)}
          onSubmit={v => void S.drafts.set('new-blocked', v)}
        />
      </Box>
      {Message(ui)}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="create-ai" label="✎ Create draft + enhance with AI" variant="primary" onPress={() => void createTicket($, true)} />
        <Button key="create-plain" label="Create empty draft" onPress={() => void createTicket($, false)} />
        <Button key="create-chat" label="Draft in chat instead" plain onPress={() => void draftInChat($)} />
      </Box>
    </Box>
  )
}

// ---------- BOARD.md ----------

function docView($: $, ui: UI): RenderChildren {
  const { Box, Markdown } = ui
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, boardPath(), $, { kind: 'board' })}
      <Markdown key="board-doc" text={S.snap?.boardText || '_BOARD.md is empty._'} />
    </Box>
  )
}

// ---------- Project line + README (terminal) ----------

/** `Project · owner/repo · branch    [o README]` above the board. */
export function projectLine(): string {
  const p = S.project
  if (p === undefined) return ''
  const repo = p.repo !== '' ? p.repo : p.isGit ? 'local git, no origin' : 'not a git repo'
  return [p.name, repo, p.branch].filter(Boolean).join(' · ')
}

function withProject($: $, ui: UI, body: RenderChildren): RenderChildren {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        <Text bold color="claude" wrap="truncate">
          {projectLine() || 'Loading project…'}
        </Text>
        <Button key="readme" label="README" hotkey="o" plain onPress={() => void openReadme($)} />
      </Box>
      {body}
    </Box>
  )
}

function readmeView($: $, ui: UI): RenderChildren {
  const { Box, Markdown, Text } = ui
  const p = S.project
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, `README · ${projectLine()}`, $, { kind: 'board' })}
      {p?.readme === undefined ? <Text dimColor>This project has no README.md yet.</Text> : <Markdown key="readme-doc" text={p.readme} />}
    </Box>
  )
}

// ---------- No board ----------

export async function setUp($: $) {
  try {
    const root = $.plugin.root
    const board = await $.fs.read(abs(`${root}/templates/BOARD.md`))
    await $.fs.write(abs(boardPath()), board)
    for (const f of ['rd.md', 'eval.md']) {
      const path = `${dir()}/TEMPLATE/${f}`
      if (!(await $.fs.exists(abs(path)))) await $.fs.write(abs(path), await $.fs.read(abs(`${root}/skills/ticket/TEMPLATE/${f}`)))
    }
    await refresh($, true)
    say($, `Created ${boardPath()} — press + New ticket to add the first one`)
  } catch (err) {
    fail($, err)
  }
}

// ---------- Start ----------
// Shown instead of the board when the project has no design, no plan and no tickets (or no board),
// and from the banner. Every button fills the prompt: Claude runs the command and asks first.

export function startFacts(): StartFacts {
  const p = S.project
  return {
    git: p?.git ?? 'none',
    hasCommit: p?.hasCommit === true,
    hasOrigin: (p?.repo ?? '') !== '',
    isGithubSkipped: S.startFlags.isGithubSkipped,
    hasIdea: (p?.ideaPath ?? '') !== '',
    hasDesign: (p?.designPath ?? '') !== '',
    hasPlan: (p?.planPath ?? '') !== '',
    hasTickets: items().length > 0,
  }
}

/** Nothing here yet: no design, no plan and no ticket folders or board rows. */
export function isStartState(): boolean {
  return S.snap !== undefined && isBlankProject(startFacts())
}

/** Whether the pane draws Start rather than the current view. */
export function showsStart(): boolean {
  const v = S.view
  if (v.kind === 'readme') return false
  if (v.kind === 'start' || S.snap?.hasBoard !== true) return true
  return (v.kind === 'board' || v.kind === 'doc') && !S.showBoard && isStartState()
}

/**
 * The banner over the board while the design or the plan is missing (and it was not dismissed): a
 * project with tickets but no docs, or one part-way through Start. Set up opens Start.
 */
export function bannerText(): string | undefined {
  const f = startFacts()
  if (S.startFlags.isBannerDismissed || (f.hasDesign && f.hasPlan)) return undefined
  return `No ${!f.hasDesign && !f.hasPlan ? 'design or plan' : !f.hasDesign ? 'design' : 'plan'} yet`
}

export const STEP_NAME: Record<StartStep, string> = { setup: 'Setup', idea: 'Idea', design: 'Design', plan: 'Plan', tickets: 'Tickets', done: 'Done' }

/** Each step: done, the current one, or still to come. */
export type StepMark = { step: (typeof START_STEPS)[number]; name: string; state: 'done' | 'now' | 'todo' }

export function stepMarks(): StepMark[] {
  const at = startStep(startFacts())
  const now = at === 'done' ? START_STEPS.length : START_STEPS.indexOf(at)
  return START_STEPS.map((step, n): StepMark => ({ step, name: STEP_NAME[step], state: n < now ? 'done' : n === now ? 'now' : 'todo' }))
}

/** The Git and GitHub lines of the Setup step. */
export function setupLines(): {
  git: { mark: '✓' | '!' | '?'; label: string; detail: string }
  github: { mark: '✓' | '!' | '–'; label: string; detail: string }
} {
  const p = S.project
  const f = startFacts()
  const branch = p?.branch || 'no branch'
  const git =
    f.git === 'unknown'
      ? { mark: '?' as const, label: 'Git repository', detail: 'git status unknown' }
      : f.git === 'none'
        ? { mark: '!' as const, label: 'Git repository', detail: 'not a git repo' }
        : { mark: f.hasCommit ? ('✓' as const) : ('!' as const), label: 'Git repository', detail: `${branch} · ${f.hasCommit ? 'has commits' : '0 commits'}` }
  const host = p?.host ?? ''
  const github = f.hasOrigin
    ? { mark: '✓' as const, label: 'GitHub repository', detail: `${p?.repo ?? ''}${host !== '' && host !== 'github.com' ? ` (${host})` : ''}` }
    : f.isGithubSkipped
      ? { mark: '–' as const, label: 'GitHub repository', detail: 'skipped' }
      : { mark: '!' as const, label: 'No GitHub repository', detail: '' }
  return { git, github }
}

export const ASK_NOTE = 'Claude will ask before running the command.'
export const ORIGIN_NOTE = 'Tickets work locally; the router needs origin to open PRs.'

/** What each Start button puts in the prompt box. Nothing here runs a command. */
export const startPrompt = {
  gitInit: () => 'Initialise git here and make the first commit.',
  github: () =>
    `Create a private GitHub repository for this project with \`gh repo create --private\`, add it as origin and push${startFacts().hasCommit ? '' : ' (make the first commit first)'}.`,
  firstPush: () => (startFacts().hasOrigin ? 'Make the first commit and push it to origin.' : 'Make the first commit.'),
  brainstorm: (idea: string) => `/brainstorm ${idea}`,
  design: (idea: string) => `/design ${idea}`,
  fromCode: () => '/design Draft a design from the existing code in this repository.',
  fromIdea: () => `/design ${S.project?.ideaPath ?? ''}`.trim(),
  plan: () => `/planning ${S.project?.designPath ?? ''}`.trim(),
}

const IDEA_KEY = 'start-idea'
export const startIdea = () => (S.drafts.get(IDEA_KEY) ?? '').trim()

export function setStartIdea($: $, v: string) {
  const was = startIdea() === ''
  S.drafts.set(IDEA_KEY, v)
  if (was !== (v.trim() === '')) redraw($)
}

/** Brainstorm and design need the idea typed first. */
export function fillWithIdea($: $, make: (idea: string) => string) {
  const idea = startIdea()
  if (idea === '') return say($, 'Type what you are building first', 'warning')
  void fill($, make(idea), 'In your prompt box — press Enter to start')
}

export function startFill($: $, text: string) {
  void fill($, text, `In your prompt box — press Enter to send it. ${ASK_NOTE}`)
}

/** Leave Start for the board (it stays away this session even while the project is blank). */
export function showBoard($: $) {
  S.showBoard = true
  go($, { kind: 'board' })
}

/** "Set up board only": what Set up board did before Start, then the board. */
export async function setUpBoardOnly($: $) {
  await setUp($)
  if (S.snap?.hasBoard === true) {
    S.showBoard = true
    S.view = { kind: 'board' }
    redraw($)
  }
}

function startView($: $, ui: UI): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const f = startFacts()
  const at = startStep(f)
  const lines = setupLines()
  const p = S.project
  const idea = startIdea()
  const hasBoard = S.snap?.hasBoard === true
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1}>
        {hasBoard && <Button key="back" label="‹ Board" plain onPress={() => showBoard($)} />}
        <Text bold>Start a project</Text>
      </Box>
      <Box flexDirection="column">
        {stepMarks().map((m, n) => (
          <Text key={`step-${m.step}`} color={m.state === 'now' ? 'claude' : m.state === 'done' ? 'success' : undefined} dimColor={m.state === 'todo'} bold={m.state === 'now'}>
            {`${n + 1}. ${m.state === 'done' ? '✓' : m.state === 'now' ? '●' : '○'} ${m.name}${m.state === 'now' ? '  ← you are here' : ''}`}
          </Text>
        ))}
      </Box>
      {Message(ui)}
      <Box flexDirection="column">
        <Text color={lines.git.mark === '✓' ? 'success' : 'warning'}>
          {`${lines.git.mark} ${lines.git.label}  ${lines.git.detail}`}
        </Text>
        {f.git === 'none' && (
          <Box flexDirection="column" paddingLeft={2}>
            <Button key="start-git" label="Initialise git and make the first commit" hotkey="i" onPress={() => startFill($, startPrompt.gitInit())} />
            <Text dimColor>{ASK_NOTE}</Text>
          </Box>
        )}
        {f.git === 'repo' && !f.hasCommit && (
          <Box flexDirection="column" paddingLeft={2}>
            <Button key="start-push" label={f.hasOrigin ? 'Make the first commit and push' : 'Make the first commit'} hotkey="u" onPress={() => startFill($, startPrompt.firstPush())} />
            <Text dimColor>{ASK_NOTE}</Text>
          </Box>
        )}
        <Text color={lines.github.mark === '✓' ? 'success' : lines.github.mark === '!' ? 'warning' : undefined} dimColor={lines.github.mark === '–'}>
          {`${lines.github.mark} ${lines.github.label}${lines.github.detail !== '' ? `  ${lines.github.detail}` : ''}`}
        </Text>
        {!f.hasOrigin && !f.isGithubSkipped && (
          <Box flexDirection="column" paddingLeft={2}>
            <Box flexDirection="row" columnGap={1}>
              <Button key="start-github" label="Create private repo on GitHub" hotkey="g" onPress={() => startFill($, startPrompt.github())} />
              <Button key="start-skip" label="Skip" hotkey="k" plain onPress={() => void setStartFlag($, { isGithubSkipped: true })} />
            </Box>
            <Text dimColor>{ORIGIN_NOTE}</Text>
            <Text dimColor>{ASK_NOTE}</Text>
          </Box>
        )}
      </Box>
      {!f.hasDesign && !f.hasPlan && (
        <Box flexDirection="column">
          {f.hasIdea && <Text color="success">{`✓ Idea written down: ${p?.ideaPath ?? ''}`}</Text>}
          <Input
            key={IDEA_KEY}
            label="What are you building?"
            rows={3}
            value={S.drafts.get(IDEA_KEY) ?? ''}
            placeholder="e.g. A booking app for small salons; owners hate phone tag…"
            submitLabel="Save"
            onInput={v => setStartIdea($, v)}
            onSubmit={v => setStartIdea($, v)}
          />
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            <Button key="start-brainstorm" label="✨ Brainstorm it first" hotkey="b" variant={idea !== '' ? 'primary' : undefined} dimColor={idea === ''} onPress={() => fillWithIdea($, startPrompt.brainstorm)} />
            <Button key="start-design" label="Go straight to design" hotkey="d" dimColor={idea === ''} onPress={() => fillWithIdea($, startPrompt.design)} />
            {p?.hasCode === true && <Button key="start-code" label="Draft a design from the code" hotkey="c" onPress={() => startFill($, startPrompt.fromCode())} />}
          </Box>
          {idea === '' && <Text dimColor>Type your idea to brainstorm it or go straight to design.</Text>}
        </Box>
      )}
      {at === 'design' && (
        <Button key="start-from-idea" label={`Write the design from ${p?.ideaPath ?? 'the idea'}`} hotkey="w" variant="primary" onPress={() => startFill($, startPrompt.fromIdea())} />
      )}
      {f.hasDesign && <Text color="success">{`✓ Design  ${p?.designPath ?? ''}`}</Text>}
      {at === 'plan' && <Button key="start-plan" label="Plan the builds from the design" hotkey="p" variant="primary" onPress={() => startFill($, startPrompt.plan())} />}
      {f.hasPlan && <Text color="success">{`✓ Plan  ${p?.planPath ?? ''}`}</Text>}
      {at === 'tickets' && hasBoard && <Button key="start-new" label="+ New ticket" hotkey="n" variant="primary" onPress={() => go($, { kind: 'new' })} />}
      {at === 'tickets' && !hasBoard && <Button key="start-board-setup" label="Set up board" hotkey="s" variant="primary" onPress={() => void setUpBoardOnly($)} />}
      {at === 'done' && <Text color="success">✓ Everything is set up.</Text>}
      {!hasBoard && at !== 'tickets' && <Button key="setup-board-only" label="Set up board only" hotkey="s" plain onPress={() => void setUpBoardOnly($)} />}
    </Box>
  )
}

function bannerView($: $, ui: UI): RenderChildren {
  const text = bannerText()
  if (text === undefined) return null
  const { Box, Text, Button } = ui
  return (
    <Box key="banner" flexDirection="row" columnGap={1} flexWrap="wrap" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text color="warning">{text} →</Text>
      <Button key="banner-setup" label="Set up" hotkey="s" onPress={() => go($, { kind: 'start' })} />
      <Button key="banner-dismiss" label="Dismiss" plain onPress={() => void setStartFlag($, { isBannerDismissed: true })} />
    </Box>
  )
}

/** The board's first heading (or a default) for the hero. */
function heading(before: string): string {
  const h = /^#\s+(.+)$/m.exec(before)
  return (h?.[1] ?? 'Ticket board').replace(/[`*]/g, '').trim()
}

/** The text above the table without its first heading (the hero shows that). */
function intro(before: string): string {
  return before.replace(/^#\s+.+$/m, '').trim()
}

export function drawPane($: $, ui: UI, frame: Frame): RenderChildren {
  glass = frame.glass === true
  const { Text } = ui
  if (S.snap === undefined) {
    void refresh($)
    return <Text dimColor>Loading {boardPath()}…</Text>
  }
  const v = S.view
  if (glass) {
    const body =
      v.kind === 'readme'
        ? deskReadme($, ui)
        : showsStart()
          ? deskStart($, ui)
          : S.snap.board === undefined
            ? <Text color="error">{boardPath()} has no ticket table (a markdown table with # and Status columns).</Text>
            : v.kind === 'board' || v.kind === 'doc'
              ? deskBoard($, ui, frame)
              : v.kind === 'ticket'
                ? deskTicket($, ui, v.number, v.tab, false)
                : v.kind === 'questions'
                  ? deskTicket($, ui, v.number, 'rd', true)
                  : deskNew($, ui)
    return (
      <ui.Box flexDirection="column" gap={1}>
        {ProjectBar($, ui)}
        {ActivityBar($, ui)}
        {body}
      </ui.Box>
    )
  }
  if (v.kind === 'readme') return readmeView($, ui)
  if (showsStart()) return withProject($, ui, startView($, ui))
  if (S.snap.board === undefined)
    return <Text color="error">{boardPath()} has no ticket table (a markdown table with # and Status columns).</Text>
  switch (v.kind) {
    case 'board':
      return withProject($, ui, boardView($, ui, frame))
    case 'doc':
      return docView($, ui)
    case 'ticket':
      return ticketView($, ui, v.number, v.tab)
    case 'questions':
      return questionsView($, ui, v.number)
    case 'new':
      return newView($, ui)
  }
}

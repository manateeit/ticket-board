// The desktop app's look: a professional feature/bug tracker in one dark glass
// container. A KPI strip, status tabs, a sortable table, a two-column ticket
// page with inline questions and a properties sidebar, and a typed New form.
// The terminal keeps the compact views in views.tsx.
import type { EngineInterface, RenderChildren } from 'claude-code'

import { startJob, suggestAnswer } from './ai'
import { STATUSES, parseBlockedBy } from './core/board'
import { KINDS, query, resultOf, runLine, type Filters, type Kind, type Sort } from './core/query'
import { headFieldLine, isReadyable, setHeadField } from './core/ticket'
import { G, HUE, Plate, SCHEMES, STATUS_HEX, barSvg, groupInk, needsPlate, railSvg, spinnerSvg, tint, wash, workingSvg } from './glass'
import { S, setSchemeChoice, setStartFlag, isLive, loadAgents, ticketOfAgent, boardPath, dir, hasColumn, items, jobFor, redraw, refresh, roadmapView, rowOf, saveAnswer, say, statusOf, abs, versionLabel } from './store'
import { editRd, rdLock } from './store'
import { openAdopt } from './adopt'
import {
  ADOPT_LABEL,
  ADOPT_NOTE,
  ASK_NOTE,
  CLEARED,
  ORIGIN_NOTE,
  bannerText,
  blockersOpen,
  checksFor,
  createTicket,
  draftInChat,
  drawnSize,
  fail,
  fill,
  noColumn,
  saveCell,
  fillWithIdea,
  phaseOptions,
  planSummary,
  go,
  runTicket,
  runnable,
  setFilters,
  setStartIdea,
  setStatus,
  setUpBoardOnly,
  setupLines,
  showBoard,
  startFacts,
  startFill,
  startIdea,
  startPrompt,
  stepMarks,
  reviewStale,
  staleChips,
  ticketPlan,
  type PlanSummary,
  type Frame,
  type UI,
} from './views'
import { startStep } from './core/project'
import { DeskReplanBanner, brainstorm, openDesign, openPlan, viewName } from './plan'
import type { View } from './store'

type $ = EngineInterface

// ---------- Vocabulary ----------

const KIND: Record<Kind, { label: string; icon: string; hex: string }> = {
  feature: { label: 'Feature', icon: '✦', get hex() { return HUE.violet } },
  bug: { label: 'Bug', icon: '●', get hex() { return HUE.rose } },
  chore: { label: 'Chore', icon: '◆', get hex() { return HUE.slate } },
}

const STATUS_NAME: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  'in-progress': 'In progress',
  'in-check': 'In check',
  done: 'Done',
  blocked: 'Blocked',
  unlisted: 'Not on board',
}

const FLOW = ['draft', 'ready', 'in-progress', 'in-check', 'done'] as const

export const hexOf = (status: string) => STATUS_HEX[status] ?? G.soft

function ago(ms: number): string {
  if (ms <= 0) return '—'
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(ms).toISOString().slice(0, 10)
}

// ---------- Small parts ----------

export function Pill(ui: UI, text: string, hex: string, key?: string) {
  return (
    <ui.Text key={key} color={hex} backgroundColor={tint(hex, G.chip)} weight="semibold" size="footnote">
      {` ${text} `}
    </ui.Text>
  )
}

export function StatusPill(ui: UI, status: string) {
  return Pill(ui, `● ${STATUS_NAME[status] ?? status}`, hexOf(status))
}

function KindTag(ui: UI, kind: Kind | undefined) {
  const k = KIND[kind ?? 'feature']
  return (
    <ui.Text color={k.hex} weight="medium" size="footnote">
      {`${k.icon} ${k.label}`}
    </ui.Text>
  )
}

export function Card(ui: UI, children: RenderChildren, opts: { key?: string; accent?: string; title?: string; right?: RenderChildren } = {}) {
  const { Box, Text } = ui
  return (
    <Box
      key={opts.key}
      flexDirection="column"
      gap={1}
      backgroundColor={G.card}
      borderStyle="round"
      borderColor={opts.accent ?? G.edge}
      paddingX={2}
      paddingY={1}
    >
      {(opts.title !== undefined || opts.right !== undefined) && (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          {opts.title !== undefined && (
            <Text color={G.soft} size="caption" weight="bold">
              {opts.title.toUpperCase()}
            </Text>
          )}
          {opts.right}
        </Box>
      )}
      {children}
    </Box>
  )
}

export function Toast(ui: UI): RenderChildren {
  if (S.message === undefined) return null
  const hex = S.message.tone === 'error' ? STATUS_HEX.blocked! : S.message.tone === 'warning' ? STATUS_HEX.draft! : STATUS_HEX.ready!
  return (
    <ui.Box backgroundColor={tint(hex, 0.12)} borderStyle="round" borderColor={tint(hex, 0.5)} paddingX={2}>
      <ui.Text color={hex}>{S.message.text}</ui.Text>
    </ui.Box>
  )
}

function Kpi(ui: UI, key: string, value: string, label: string, hex: string, sub?: string) {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" flexGrow={1} minWidth={18} backgroundColor={G.card} borderStyle="round" borderColor={tint(hex, 0.45)} paddingX={2} paddingY={1}>
      <Text color={hex} size="title" weight="bold">
        {value}
      </Text>
      <Text color={G.soft} size="footnote">
        {label}
        {sub !== undefined && <Text color={G.faint}>{`  ${sub}`}</Text>}
      </Text>
    </Box>
  )
}

// ---------- Agents ----------

const AGENT_HEX: Record<string, string> = {
  get pending() { return HUE.amber },
  get running() { return HUE.blue },
  get waiting() { return HUE.purple },
  get idle() { return HUE.slate },
  get completed() { return HUE.green },
  get failed() { return HUE.red },
  get killed() { return HUE.red },
}

/** Puts the agent's transcript in the main view. The app may refuse (the desktop can't switch views from a pane yet): say why. */
export async function openTranscript($: $, agentId: string) {
  try {
    const shown = (await $.ui.view({ agentId })) as { deny?: string } | undefined
    if (shown?.deny !== undefined) {
      S.watching = agentId
      say($, `The app won't switch to that agent's transcript here (${shown.deny}). Its activity is shown below instead.`, 'warning')
    }
  } catch (err) {
    S.watching = agentId
    say($, `Can't open that transcript here: ${err instanceof Error ? err.message : String(err)}. Its activity is shown below instead.`, 'warning')
  }
}

/** What an agent did, step by step: the fallback when the app won't show its transcript (openTranscript sets S.watching). */
function AgentActivity(ui: UI, id: string, name: string): RenderChildren {
  const { Box, Text } = ui
  const log = S.agentLog.get(id) ?? []
  return (
    <Box key={`agent-log-${id}`} flexDirection="column" gap={0} marginLeft={2} paddingX={2} paddingY={1} borderStyle="round" borderColor={G.edge}>
      <Text color={G.soft} size="caption" weight="bold">
        {`WHAT ${name.toUpperCase()} DID · ${log.length === 0 ? 'nothing seen yet' : `last ${Math.min(log.length, 12)} of ${log.length} steps`}`}
      </Text>
      {log.length === 0 ? (
        <Text color={G.faint} size="footnote">
          No tool calls seen since the pane loaded. Steps show up here as the agent works.
        </Text>
      ) : (
        log.slice(-12).map((l, n) => (
          <Box key={`agent-log-${id}-${n}`} flexDirection="row" gap={1}>
            <Text color={G.faint} size="footnote" mono>
              {clockOf(l.at)}
            </Text>
            <Text color={G.accent} size="footnote" weight="medium">
              {toolWords(l.tool)}
            </Text>
            <Text color={G.soft} size="footnote" mono wrap="truncate">
              {l.detail}
            </Text>
          </Box>
        ))
      )}
    </Box>
  )
}

function AgentsPanel($: $, ui: UI, all: Row[]): RenderChildren {
  const { Box, Text, Button } = ui
  const live = S.agents.filter(isLive)
  const past = S.agents.filter(a => !isLive(a)).slice(-5).reverse()
  const flight = all.filter(i => i.status === 'in-progress' || i.status === 'in-check')
  const agentRow = (a: (typeof S.agents)[number], dim: boolean) => {
    const hex = AGENT_HEX[a.status] ?? G.soft
    const t = ticketOfAgent(a)
    const title = t === undefined ? undefined : all.find(i => i.number === t)?.title
    return (
      <Box key={`agent-${a.id}`} flexDirection="row" alignItems="center" gap={1} paddingX={1} paddingY={dim ? 0 : 1} backgroundColor={dim ? undefined : wash(0.03)}>
        <Box width="12%" flexShrink={0}>
          {Pill(ui, `● ${a.status}`, hex)}
        </Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={dim ? G.soft : G.ink} weight={dim ? 'regular' : 'medium'} wrap="truncate">
            {a.name ?? (a.description || a.type)}
          </Text>
          <Text color={G.faint} size="footnote" wrap="truncate">
            {[a.type, a.name !== undefined && a.description !== '' ? a.description : undefined, a.spawnedBy === 'ticket-board' ? 'ticket writer' : undefined].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <Box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
        {t !== undefined && (
          <Button key={`agent-t-${a.id}`} plain onPress={() => go($, { kind: 'ticket', number: t, tab: 'rd' })}>
            <Text color={G.accent} size="footnote">{`${t}${title ? ` ${title.slice(0, 28)}` : ''} ›`}</Text>
          </Button>
        )}
        <Button
          key={`agent-w-${a.id}`}
          label={S.watching === a.id ? 'Hide activity' : 'Activity'}
          plain
          onPress={() => {
            S.watching = S.watching === a.id ? '' : a.id
            redraw($)
          }}
        />
        {a.teammateId === undefined && isLive(a) && (
          <Button key={`agent-v-${a.id}`} label="Open transcript ↗" plain onPress={() => void openTranscript($, a.id)} />
        )}
        </Box>
      </Box>
    )
  }
  const activity = (a: (typeof S.agents)[number]) => AgentActivity(ui, a.id, a.name ?? a.type)
  return Card(
    ui,
    [
      live.length === 0 ? (
        <Text key="agents-none" color={G.soft} size="footnote">
          No agents running in this session right now.
        </Text>
      ) : (
        <Box key="agents-live" flexDirection="column" gap={0}>
          {live.map(a => [agentRow(a, false), S.watching === a.id ? activity(a) : null])}
        </Box>
      ),
      flight.length > 0 ? (
        <Box key="agents-flight" flexDirection="column" gap={0}>
          <Text color={G.faint} size="caption" weight="bold">
            {`IN FLIGHT ON THE BOARD (${flight.length})`}
          </Text>
          {flight.map(i => (
            <Box key={`flight-${i.number}`} flexDirection="row" gap={1} alignItems="center" paddingX={1}>
              {StatusPill(ui, i.status)}
              <Button key={`flight-o-${i.number}`} plain onPress={() => go($, { kind: 'ticket', number: i.number, tab: 'rd' })}>
                <Text color={G.ink}>{`${i.number}  ${i.title}`}</Text>
              </Button>
              {i.owner !== '' && i.owner !== '—' && <Text color={G.faint} size="footnote">{i.owner}</Text>}
            </Box>
          ))}
        </Box>
      ) : null,
      past.length > 0 ? (
        <Box key="agents-past" flexDirection="column" gap={0}>
          <Text color={G.faint} size="caption" weight="bold">
            RECENTLY FINISHED
          </Text>
          {past.map(a => [agentRow(a, true), S.watching === a.id ? activity(a) : null])}
        </Box>
      ) : null,
      <Text key="agents-hint" color={G.faint} size="footnote">
        Shows this session's subagents and teammates. A router running in another session shows up through its tickets under In flight.
      </Text>,
    ],
    {
      key: 'agents-card',
      title: `Agents · ${live.length} running`,
      accent: live.length > 0 ? tint(AGENT_HEX.running!, 0.5) : undefined,
      right: <Button key="agents-hide" label="Hide" plain onPress={() => ((S.showAgents = false), redraw($))} />,
    },
  )
}

// ---------- Activity ----------

const TOOL_WORDS: [RegExp, string][] = [
  [/^Bash$/, 'Running a command'],
  [/^(Edit|Write|MultiEdit|NotebookEdit)$/, 'Editing files'],
  [/^(Read|Grep|Glob|LS)$/, 'Reading code'],
  [/^(Agent|Task)$/, 'Starting an agent'],
  [/^(WebFetch|WebSearch)$/, 'Researching'],
  [/^TodoWrite$/, 'Planning'],
  [/^mcp__/, 'Using a connector'],
]
const toolWords = (t: string) => TOOL_WORDS.find(([re]) => re.test(t))?.[1] ?? (t === '' ? 'Thinking' : `Using ${t}`)
const clockOf = (ms: number) => new Date(ms).toTimeString().slice(0, 5)

/** The strip at the top of every desktop view: animated while the session or its agents work ("Claude is working", or "Waiting on N agents" once the main turn ended), a quiet "Idle" otherwise. */
export function ActivityBar($: $, ui: UI): RenderChildren {
  const { Box, Text, Button } = ui
  const live = S.agents.filter(isLive)
  const writing = S.jobs.size
  const adopting = S.adoptJob !== undefined
  const isBusy = S.busySince !== 0
  const hex = isBusy ? G.accent : HUE.violet
  if (!isBusy && live.length === 0 && writing === 0 && !adopting) {
    return (
      <Box key="activity" flexDirection="row" gap={1} alignItems="center">
        <Text color={G.faint} size="footnote">
          ○ Claude is idle
        </Text>
      </Box>
    )
  }
  // The main turn has ended but work goes on in the background: the session waits on its agents, not on the person.
  const agents = `${live.length} agent${live.length === 1 ? '' : 's'}`
  const parts: string[] = []
  if (isBusy) parts.push(`Claude is working · ${toolWords(S.busyTool)} · since ${clockOf(S.busySince)}`)
  else parts.push(live.length > 0 ? `Waiting on ${agents}` : 'Waiting on the AI')
  if (isBusy && live.length > 0) parts.push(`${agents} running`)
  if (writing > 0) parts.push(`AI writing ${writing} ticket${writing === 1 ? '' : 's'}`)
  if (adopting) parts.push('AI converting your docs')
  if (!isBusy) parts.push(live.length > 0 ? `Claude continues when ${live.length === 1 ? 'it reports' : 'they report'}` : 'the board updates when it is done')
  return (
    <Box key="activity" flexDirection="column" gap={0} backgroundColor={tint(hex, 0.08)} borderStyle="round" borderColor={tint(hex, 0.4)} paddingX={1}>
      <Box flexDirection="row" gap={1} alignItems="center" justifyContent="space-between">
        <Box flexDirection="row" gap={1} alignItems="center" flexShrink={1} minWidth={0}>
          {ui.Svg !== undefined && <ui.Svg key="spinner" source={spinnerSvg(hex)} alt="working" width={18} height={18} />}
          <Text color={G.ink} weight="medium" size="footnote">
            {parts.join('  ·  ')}
          </Text>
        </Box>
        {live.length > 0 && !S.showAgents && (
          <Box key="activity-agents-box" flexShrink={0}>
          <Button
            key="activity-agents"
            label="Show agents"
            plain
            onPress={() => {
              S.showAgents = true
              if (S.view.kind !== 'board') go($, { kind: 'board' })
              else redraw($)
              void loadAgents($)
            }}
          />
          </Box>
        )}
      </Box>
      {ui.Svg !== undefined && <ui.Svg key="sweep" source={workingSvg(hex)} alt="" height={3} />}
    </Box>
  )
}

// ---------- Board ----------

type Row = ReturnType<typeof items>[number]

type Col = { id: string; label: string; width: string; sort?: Sort }

/**
 * The table's columns; the Phase column only while a plan is bound (it takes its width from Title).
 * With plated rows (glass and app disagree) the actions column also holds the row's Open button and
 * takes that room from Title too. Widths total 100%.
 */
export function boardCols(hasPlan: boolean, isPlated = false): Col[] {
  const extra = isPlated ? 9 : 0
  return [
    { id: 'num', label: 'ID', width: '6%', sort: 'number' },
    { id: 'kind', label: 'Type', width: '9%', sort: 'kind' },
    { id: 'title', label: 'Title', width: `${(hasPlan ? 27 : 33) - extra}%`, sort: 'title' },
    ...(hasPlan ? [{ id: 'phase', label: 'Phase', width: '6%', sort: 'phase' as Sort }] : []),
    { id: 'status', label: 'Status', width: '11%', sort: 'status' },
    { id: 'result', label: 'Result', width: '10%' },
    { id: 'deps', label: 'Depends on', width: '10%' },
    { id: 'q', label: 'Qs', width: '5%', sort: 'questions' },
    { id: 'updated', label: 'Updated', width: '8%', sort: 'updated' },
    { id: 'action', label: '', width: `${8 + extra}%` },
  ]
}

function sortHeader($: $, ui: UI, c: Col) {
  const f = S.filters
  const active = c.sort !== undefined && (f.sort === c.sort || (c.sort === 'number' && f.sort === 'number-desc'))
  const desc = f.desc === true || f.sort === 'number-desc'
  const arrow = active ? (desc ? ' ↓' : ' ↑') : ''
  if (c.sort === undefined) {
    return (
      <ui.Text color={groupInk(true)} size="caption" weight="bold">
        {c.label.toUpperCase()}
      </ui.Text>
    )
  }
  return (
    <ui.Button
      key={`sort-${c.id}`}
      plain
      onPress={() => setFilters($, active ? { sort: c.sort === 'number' ? 'number' : c.sort!, desc: !desc } : { sort: c.sort!, desc: false })}
    >
      <ui.Text color={active ? G.accent : G.faint} size="caption" weight="bold">
        {`${c.label.toUpperCase()}${arrow}`}
      </ui.Text>
    </ui.Button>
  )
}

/** The one thing to do next on a row, as a button (or nothing). */
function rowAction($: $, ui: UI, i: Row): RenderChildren {
  const { Button } = ui
  const job = jobFor(i.number)
  if (job !== undefined) return <ui.Text color={G.accent} size="footnote">✎ AI…</ui.Text>
  if (i.status === 'draft' && i.openQuestions > 0) {
    return <Button key={`ans-${i.number}`} label={`Answer ${i.openQuestions}`} onPress={() => go($, { kind: 'questions', number: i.number })} />
  }
  if (i.status === 'draft' && isReadyable(checksFor(i.number))) {
    return <Button key={`rdy-${i.number}`} label="✓ Ready" onPress={() => void setStatus($, i.number, 'ready', 'draft')} />
  }
  if (i.status === 'ready') return <Button key={`run-${i.number}`} label="▶ Run" variant="primary" onPress={() => runTicket($, i.number)} />
  if (i.status === 'blocked') return <Button key={`unb-${i.number}`} label="Unblock" onPress={() => void setStatus($, i.number, 'draft', 'blocked')} />
  return null
}

function tableRow($: $, ui: UI, i: Row, n: number, cols: Col[]): RenderChildren {
  const { Box, Text, Button } = ui
  const waiting = blockersOpen(i.blockedBy)
  const hex = hexOf(i.status)
  // Glass and app disagree: a native button would draw the app's colors on the card, so ID and
  // title are drawn as text and the press moves to an Open button among the row's actions.
  const isPlated = needsPlate()
  const isLight = G.look === 'light'
  const open = () => go($, { kind: 'ticket', number: i.number, tab: 'rd' })
  const cell = (id: string, children: RenderChildren) => (
    <Box key={`c-${id}-${i.number}`} width={cols.find(c => c.id === id)!.width} paddingRight={1} flexShrink={0} overflow="hidden">
      {children}
    </Box>
  )
  return (
    <Box
      key={`row-${i.number}`}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      paddingY={1}
      backgroundColor={n % 2 === 0 ? wash(0.025) : wash(0)}
      hover={{ backgroundColor: tint(hex, 0.12) }}
    >
      {cell(
        'num',
        isPlated ? (
          <Text color={G.ink} weight="bold" mono>
            {i.number}
          </Text>
        ) : (
          <Button key={`open-${i.number}`} plain onPress={open}>
            <Text color={G.soft} mono {...(isLight ? { weight: 'bold' as const } : {})}>
              {i.number}
            </Text>
          </Button>
        ),
      )}
      {cell('kind', KindTag(ui, i.kind))}
      {cell(
        'title',
        <Box flexDirection="column" flexShrink={1}>
          {isPlated ? (
            <Text color={i.status === 'done' ? G.soft : G.ink} wrap="truncate">
              {i.title}
            </Text>
          ) : (
            <Button key={`title-${i.number}`} plain onPress={open}>
              <Text color={i.status === 'done' ? G.soft : G.ink} weight={isLight ? 'regular' : 'medium'} wrap="truncate">
                {i.title}
              </Text>
            </Button>
          )}
          {staleChips(i.number).map(c => (
            <Button key={`stale-${i.number}-${c.section}`} plain onPress={() => reviewStale($, i.number)}>
              <Text color={STATUS_HEX.draft!} backgroundColor={tint(STATUS_HEX.draft!, 0.14)} size="footnote" wrap="truncate">
                {`⚠ ${c.label}`}
              </Text>
            </Button>
          ))}
        </Box>,
      )}
      {i.phase !== undefined &&
        cell(
          'phase',
          <Text color={i.phase === '' ? G.faint : G.soft} mono size="footnote">
            {i.phase === '' ? '—' : i.phase}
          </Text>,
        )}
      {cell('status', StatusPill(ui, i.status))}
      {cell(
        'result',
        (() => {
          const r = resultOf(i.notes)
          return r === undefined ? <Text color={G.faint}>—</Text> : Pill(ui, r.label, (HUE as Record<string, string>)[r.hue] ?? HUE.slate)
        })(),
      )}
      {cell(
        'deps',
        i.blockedBy.length === 0 ? (
          <Text color={G.faint}>—</Text>
        ) : (
          <Text color={waiting.length > 0 ? STATUS_HEX.blocked! : G.soft} mono size="footnote">
            {`${waiting.length > 0 ? '⛔ ' : ''}${i.blockedBy.join(', ')}`}
          </Text>
        ),
      )}
      {cell('q', i.openQuestions > 0 ? Pill(ui, `? ${i.openQuestions}`, STATUS_HEX.draft!) : <Text color={G.faint}>—</Text>)}
      {cell(
        'updated',
        <Text color={G.faint} size="footnote">
          {ago(i.updatedMs)}
        </Text>,
      )}
      {cell(
        'action',
        isPlated ? (
          // The row's ID and title are text on the card; its Open button joins the row's action
          // on one plate.
          <Box flexDirection="row" gap={1} alignItems="center">
            <Button key={`open-${i.number}`} label="Open" onPress={open} />
            {rowAction($, ui, i)}
          </Box>
        ) : (
          rowAction($, ui, i)
        ),
      )}
    </Box>
  )
}

/**
 * The Roadmap card: a static phase rail with a link per phase (each sets the phase filter), the
 * Now line, the roadmap checks as short warnings, and the replan banner (0016) with Replan and
 * Review replan while the plan is behind the design or a proposal has items left.
 */
function RoadmapCard($: $, ui: UI, plan: PlanSummary, phaseFilter: string): RenderChildren {
  const { Box, Text, Button } = ui
  const now = plan.isComplete
    ? `Plan complete · ${plan.built} of ${plan.counted} builds built`
    : `Now: ${plan.phase} · ${plan.phaseTitle} · ${plan.built} of ${plan.counted} builds built${plan.nextUp === undefined ? '' : ` · next up ${plan.nextUp}`}`
  return Card(
    ui,
    [
      ui.Svg !== undefined ? (
        <ui.Svg key="rail" source={railSvg(plan.phases, G.accent)} alt={plan.phases.map(p => `${p.id} ${p.pct}%`).join(', ')} height={14} />
      ) : null,
      <Box key="rail-links" flexDirection="row" gap={1} flexWrap="wrap">
        {plan.phases.map(p => (
          <Button
            key={`rail-${p.id}`}
            plain
            onPress={() => setFilters($, { phase: phaseFilter === p.id ? 'any' : p.id })}
          >
            <Text color={phaseFilter === p.id ? G.accent : p.pct >= 100 ? STATUS_HEX.done! : G.soft} weight={phaseFilter === p.id ? 'bold' : 'regular'} size="footnote">
              {`${p.pct >= 100 ? '✓ ' : ''}${p.id} ${p.label} · ${p.pct}%`}
            </Text>
          </Button>
        ))}
      </Box>,
      <Text key="rm-now" color={G.ink}>
        {now}
      </Text>,
      ...plan.warnings.map((w, n) => (
        <Text key={`rm-warn-${n}`} color={STATUS_HEX.draft!} size="footnote">
          {`⚠ ${w}`}
        </Text>
      )),
      DeskReplanBanner($, ui),
    ],
    { key: 'roadmap-card', title: 'Roadmap', right: <Text color={G.faint} size="footnote">{`Plan ${plan.planPct}% · tickets ${plan.ticketPct}%`}</Text> },
  )
}

/** What the board's rows may take of the drawing (the host refuses one over 100,000 characters); the rest is the board's chrome. */
export const ROWS_BUDGET = 60_000
/** Rows on one page of a board too long to draw whole. */
export const ROWS_PAGE = 20

/** Every row when they fit ROWS_BUDGET; else ROWS_PAGE a page, fewer when the largest row would not let that many fit (never under 5). */
export function rowsPerPage(sizes: readonly number[]): number {
  const sum = sizes.reduce((a, b) => a + b, 0)
  if (sum <= ROWS_BUDGET) return Math.max(1, sizes.length)
  return Math.max(5, Math.min(ROWS_PAGE, Math.floor(ROWS_BUDGET / Math.max(1, ...sizes))))
}

function boardIntro(text: string): { title: string; notes: string } {
  const lines = text.split(/\r?\n/)
  const h = lines.findIndex(l => /^#\s+/.test(l))
  const title = h >= 0 ? lines[h]!.replace(/^#\s+/, '').trim() : 'Tickets'
  const notes = lines.filter((_, n) => n !== h).join('\n').trim()
  return { title, notes }
}

export function deskBoard($: $, ui: UI, _frame: Frame): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const all = items()
  const f = S.filters
  const by = (s: string) => all.filter(i => i.status === s).length
  const total = all.length
  const done = by('done')
  const needs = all.filter(i => i.status === 'draft' || i.status === 'blocked').length
  const openBugs = all.filter(i => i.kind === 'bug' && i.status !== 'done').length
  const active = by('in-progress') + by('in-check')
  const run = runnable()
  const list = query(all, f)

  const text = S.snap?.boardText ?? ''
  const board = S.snap?.board
  const lines = text.split(/\r?\n/)
  const before = board === undefined ? '' : lines.slice(0, board.headerLine).join('\n')
  const after = board === undefined ? '' : lines.slice(board.lastLine + 1).join('\n')
  const intro = boardIntro(before)
  const boardNotes = [intro.notes, after.trim()].filter(s => s !== '').join('\n\n')

  const counts = STATUSES.map(s => [s, by(s)] as const).filter(([, n]) => n > 0)
  const tabs: { id: Filters['show']; label: string; n: number; hex: string }[] = [
    { id: 'all', label: 'All', n: total, hex: G.accent },
    { id: 'needs-me', label: 'Needs me', n: needs, hex: STATUS_HEX.draft! },
    { id: 'not-done', label: 'Open', n: total - done, hex: G.accent },
    ...STATUSES.filter(s => by(s) > 0).map(s => ({ id: s as Filters['show'], label: STATUS_NAME[s] ?? s, n: by(s), hex: hexOf(s) })),
  ]
  const plan = planSummary()
  const planWarning = roadmapView()?.warning
  const cols = boardCols(plan !== undefined, needsPlate())
  const phaseFilter = f.phase ?? 'any'
  const isFiltered = f.show !== 'all' || f.kind !== 'any' || f.mode !== 'any' || f.search.trim() !== '' || (plan !== undefined && phaseFilter !== 'any')
  const grouped = f.sort === 'status'
  // Rows of the filtered, sorted list; in pages when they would not fit the drawing (0022).
  const drawnRows = list.map((i, n) => tableRow($, ui, i, n, cols))
  const pageSize = rowsPerPage(drawnRows.map(drawnSize))
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.max(0, Math.min(S.page, pages - 1))
  const first = page * pageSize
  const rows = list.slice(first, first + pageSize)
  const turn = (n: number) => {
    S.page = n
    redraw($)
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Title bar. The buttons never shrink and the text beside them truncates: in the desktop a
          text column that overflows can overlap a Button beside it and swallow its clicks (as 0.4.11
          fixed for the project bar). */}
      <Box key="title-bar" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box key="title-text" flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={G.ink} size="title" weight="bold" wrap="truncate">
            {intro.title}
          </Text>
          <Text color={G.faint} size="footnote" mono wrap="truncate">
            {`${boardPath()} · ${total} ticket${total === 1 ? '' : 's'}${versionLabel() === '' ? '' : ` · ${versionLabel()}`}`}
          </Text>
        </Box>
        <Box key="title-buttons" flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
          {run.length > 0 && <Button key="runall" label={`▶ Run ready (${run.length})`} hotkey="x" onPress={() => void fill($, runLine(run, S.hasRouter, boardPath()), 'Run line is in your prompt box — press Enter to send it')} />}
          <Button
            key="agents"
            hotkey="a"
            variant={S.showAgents ? 'primary' : 'secondary'}
            onPress={() => {
              S.showAgents = !S.showAgents
              redraw($)
              if (S.showAgents) void loadAgents($)
            }}
          >
            {'Agents '}
            <Text color={S.agents.some(isLive) ? AGENT_HEX.running! : G.faint}>{`● ${S.agents.filter(isLive).length}`}</Text>
          </Button>
          <Button key="refresh" label="↻" hotkey="r" onPress={() => void refresh($, true).then(() => say($, 'Refreshed'))} />
          <Button key="new" label="+ New ticket" hotkey="n" variant="primary" onPress={() => go($, { kind: 'new' })} />
        </Box>
      </Box>

      {Toast(ui)}
      {Banner($, ui)}

      {/* KPIs */}
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {Kpi(ui, 'kpi-needs', String(needs), 'Need you', STATUS_HEX.draft!, 'drafts + blocked')}
        {Kpi(ui, 'kpi-ready', String(by('ready')), 'Ready to run', STATUS_HEX.ready!)}
        {Kpi(ui, 'kpi-active', String(active), 'In flight', STATUS_HEX['in-progress']!, 'building + checking')}
        {Kpi(ui, 'kpi-bugs', String(openBugs), 'Open bugs', KIND.bug.hex)}
        {plan !== undefined
          ? Kpi(ui, 'kpi-done', `${plan.planPct}%`, 'Plan', G.accent, plan.sub)
          : Kpi(ui, 'kpi-done', total === 0 ? '0%' : `${Math.round((done / total) * 100)}%`, 'Done', STATUS_HEX.done!, `${done} of ${total}`)}
      </Box>
      {ui.Svg !== undefined && total > 0 && <ui.Svg key="bar" source={barSvg(counts, total)} alt={counts.map(([s, n]) => `${s} ${n}`).join(', ')} height={6} />}
      {S.showAgents && AgentsPanel($, ui, all)}

      {/* Filters */}
      <Box flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
        {tabs.map(t => (
          <Button key={`show-${t.id}`} variant={f.show === t.id ? 'primary' : 'secondary'} onPress={() => setFilters($, { show: t.id })}>
            {`${t.label} `}
            <Text color={f.show === t.id ? undefined : G.faint}>{String(t.n)}</Text>
          </Button>
        ))}
      </Box>
      <Box flexDirection="row" gap={2} flexWrap="wrap" alignItems="center">
        <Box flexDirection="row" gap={1} alignItems="center">
          {(['any', ...KINDS] as const).map(k => (
            <Button key={`kind-${k}`} variant={f.kind === k ? 'primary' : 'secondary'} onPress={() => setFilters($, { kind: k })}>
              {k === 'any' ? 'All types' : `${KIND[k].icon} ${KIND[k].label}s`}
            </Button>
          ))}
        </Box>
        <Button
          key="hide-done"
          variant={f.hideDone === true ? 'primary' : 'secondary'}
          onPress={() => setFilters($, { hideDone: f.hideDone !== true })}
        >
          {f.hideDone === true ? `✓ Hiding done ` : 'Hide done '}
          <Text color={f.hideDone === true ? undefined : G.faint}>{String(done)}</Text>
        </Button>
        <Select
          key="mode"
          label="Mode"
          value={f.mode}
          options={[{ value: 'any', label: 'Any' }, { value: 'solo', label: 'Solo' }, { value: 'team', label: 'Team' }]}
          onSelect={v => setFilters($, { mode: v as Filters['mode'] })}
        />
        {plan !== undefined && (
          <Select key="phase" label="Phase" value={phaseFilter} options={phaseOptions()} onSelect={v => setFilters($, { phase: v })} />
        )}
        <Input
          key="search"
          placeholder="Search number, title, notes…"
          value={f.search}
          submitLabel="Search"
          onInput={v => {
            S.filters = { ...S.filters, search: v }
          }}
          onSubmit={v => setFilters($, { search: v })}
        />
        {isFiltered && <Button key="clear" label="Clear filters" plain onPress={() => setFilters($, CLEARED)} />}
      </Box>

      {/* Table */}
      {/* On the light glass the table is a white card; the sort headers are small labels on it. */}
      <Box flexDirection="column" backgroundColor={G.look === 'light' ? G.card : wash(0.03)} borderStyle="round" borderColor={G.edge}>
        {Plate(
          ui,
          'sort',
          cols.map(c => (
            <Box key={`h-${c.id}`} width={c.width} flexShrink={0} paddingRight={1}>
              {sortHeader($, ui, c)}
            </Box>
          )),
          { flexDirection: 'row', alignItems: 'center', paddingX: 1, paddingY: 1, backgroundColor: wash(0.05) },
        )}
        {rows.length === 0 && (
          <Box flexDirection="column" alignItems="center" paddingY={2} gap={1}>
            <Text color={G.soft}>{total === 0 ? 'No tickets yet.' : 'No tickets match these filters.'}</Text>
            {total === 0 ? (
              <Button key="new-empty" label="+ Create the first ticket" variant="primary" onPress={() => go($, { kind: 'new' })} />
            ) : (
              <Button key="clear-empty" label="Clear filters" onPress={() => setFilters($, CLEARED)} />
            )}
          </Box>
        )}
        {rows.map((i, n) => {
          const head =
            grouped && (n === 0 || rows[n - 1]!.status !== i.status) ? (
              <Box key={`g-${i.status}`} flexDirection="row" gap={1} paddingX={1} paddingTop={1}>
                {StatusPill(ui, i.status)}
                <Text color={G.faint} size="footnote">
                  {String(list.filter(r => r.status === i.status).length)}
                </Text>
              </Box>
            ) : null
          return [head, drawnRows[first + n]]
        })}
      </Box>
      {pages > 1 && (
        <Box key="rows-pager" flexDirection="row" gap={1} alignItems="center">
          {page > 0 && <Button key="rows-prev" label="‹ Previous" onPress={() => turn(page - 1)} />}
          <Text color={G.soft} size="footnote">{`Rows ${first + 1}–${first + rows.length} of ${list.length}`}</Text>
          {page < pages - 1 && <Button key="rows-next" label="Next ›" onPress={() => turn(page + 1)} />}
        </Box>
      )}
      <Text color={G.faint} size="footnote">
        {`Showing ${list.length} of ${total} · click a column to sort · open a ticket for its full notes`}
      </Text>

      {plan !== undefined && RoadmapCard($, ui, plan, phaseFilter)}
      {planWarning !== undefined && (
        <Text key="plan-warning" color={STATUS_HEX.draft!} size="footnote">
          {`⚠ ${planWarning}`}
        </Text>
      )}

      {boardNotes !== '' &&
        Card(ui, <ui.Markdown key="board-notes" text={boardNotes} />, {
          key: 'notes-card',
          title: 'Board notes · BOARD.md',
        })}
    </Box>
  )
}

// ---------- Ticket ----------

/** Splits rd.md / eval.md into one card per "## " section. Drops the H1 (the page shows the title), the head's Type line
 * (a `type:` line in a section or code block stays),
 * and the Open questions section (the questions card above handles those; a done ticket doesn't need them). */
export function docSections(text: string): { title?: string; body: string }[] {
  const out: { title?: string; body: string[] }[] = [{ body: [] }]
  const typeAt = headFieldLine(text, 'type')
  for (const [n, line] of text.split(/\r?\n/).entries()) {
    if (/^#\s/.test(line) || n === typeAt) continue
    const h = /^##\s+(.*)$/.exec(line)
    if (h) out.push({ title: h[1]!.replace(/[`*]/g, '').trim(), body: [] })
    else out[out.length - 1]!.body.push(line)
  }
  return out
    .filter(sec => !/^open questions?\b/i.test(sec.title ?? ''))
    .map(sec => ({ title: sec.title, body: sec.body.join('\n').trim() }))
    .filter(sec => sec.title !== undefined || sec.body !== '')
}

async function setKind($: $, number: string, kind: Kind) {
  try {
    await editRd($, number, rd => setHeadField(rd, 'Type', kind))
    say($, `${number} is now a ${KIND[kind].label.toLowerCase()}`)
  } catch (err) {
    fail($, err)
  }
}

function Stepper(ui: UI, status: string): RenderChildren {
  const { Box, Text } = ui
  const at = FLOW.indexOf(status as (typeof FLOW)[number])
  return (
    <Box flexDirection="row" alignItems="center" flexWrap="wrap" gap={1}>
      {FLOW.map((s, n) => {
        const isDone = at > n || status === 'done'
        const isNow = at === n
        const hex = isNow ? hexOf(s) : isDone ? STATUS_HEX.ready! : G.faint
        return [
          <Text key={`step-${s}`} color={hex} backgroundColor={isNow ? tint(hex, 0.18) : undefined} weight={isNow ? 'bold' : 'regular'} size="footnote">
            {` ${isDone && !isNow ? '✓' : isNow ? '●' : '○'} ${STATUS_NAME[s]} `}
          </Text>,
          n < FLOW.length - 1 ? (
            <Text key={`arrow-${s}`} color={G.faint}>
              ─
            </Text>
          ) : null,
        ]
      })}
    </Box>
  )
}

export function Prop(ui: UI, label: string, value: RenderChildren) {
  return (
    <ui.Box flexDirection="column">
      <ui.Text color={G.faint} size="caption" weight="bold">
        {label.toUpperCase()}
      </ui.Text>
      {typeof value === 'string' ? <ui.Text color={G.ink}>{value}</ui.Text> : value}
    </ui.Box>
  )
}

function QuestionsCard($: $, ui: UI, number: string, focus: boolean): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const f = S.snap?.files.get(number)
  const qs = f?.questions ?? []
  if (qs.length === 0) return null
  const open = qs.filter(q => !q.isResolved)
  const answered = qs.filter(q => q.isResolved)
  const job = jobFor(number)
  const lock = rdLock(number)
  const hex = open.length > 0 ? STATUS_HEX.draft! : STATUS_HEX.ready!
  return Card(
    ui,
    [
      open.length === 0 ? (
        <Text key="q-none" color={STATUS_HEX.ready!}>
          ✓ Every question is answered.
        </Text>
      ) : null,
      ...open.map((q, n) => {
        const key = `q-${number}-${q.index}`
        const draft = S.drafts.get(key) ?? ''
        return (
          <Box key={`box-${key}`} flexDirection="column" gap={1} backgroundColor={wash(0.03)} borderStyle="round" borderColor={tint(STATUS_HEX.draft!, 0.35)} paddingX={2} paddingY={1}>
            <Text color={G.ink} weight="semibold">
              {`${n + 1}. ${q.text}`}
            </Text>
            {q.detail !== '' && (
              <Text color={G.soft} size="footnote">
                {q.detail}
              </Text>
            )}
            {lock !== undefined ? (
              <Text key={`locked-${key}`} color={G.soft} size="footnote">
                {`🔒 ${lock}`}
              </Text>
            ) : (
            <Input
              key={key}
              value={draft}
              rows={2}
              placeholder="Type the decision, then Save"
              submitLabel="Save answer"
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
            )}
            <Box flexDirection="row" gap={1}>
              <Button
                key={`suggest-${key}`}
                label={S.suggesting.has(key) ? 'Thinking…' : '✨ Suggest an answer'}
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
                onPress={() => void fill($, `Ticket ${number} (${dir()}/${f?.folder}/rd.md) asks: "${q.text}" — help me decide. `, 'Started a message in your prompt box')}
              />
            </Box>
          </Box>
        )
      }),
      answered.length > 0 ? (
        <Box key="answered" flexDirection="column" gap={0}>
          <Text color={G.faint} size="caption" weight="bold">
            {`ANSWERED (${answered.length})`}
          </Text>
          {answered.map(q => (
            <Text key={`a-${q.index}`} color={G.soft} size="footnote">
              {`✓ ${q.text} — ${q.detail.split('\n').slice(-1)[0] ?? ''}`}
            </Text>
          ))}
        </Box>
      ) : null,
      answered.length > 0 && job === undefined ? (
        <Box key="fold-row" flexDirection="row">
          <Button key="fold" label="✎ Fold answers into the ticket (AI)" plain onPress={() => void startJob($, number, 'fold')} />
        </Box>
      ) : null,
      focus && open.length === 0 && rowOf(number)?.status === 'draft' ? (
        <Box key="toticket-row" flexDirection="row">
          <Button key="toticket" label="Back to the ticket to mark it ready" variant="primary" onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
        </Box>
      ) : null,
    ],
    {
      key: 'questions-card',
      accent: tint(hex, 0.55),
      title: open.length > 0 ? `${open.length} open question${open.length === 1 ? '' : 's'}` : 'Questions',
    },
  )
}

export function deskTicket($: $, ui: UI, number: string, tab: 'rd' | 'eval', focusQuestions: boolean, from?: View): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const row = rowOf(number)
  const f = S.snap?.files.get(number)
  const item = items().find(i => i.number === number)
  const status = row?.status ?? 'unlisted'
  const kind = item?.kind ?? 'feature'
  const title = row?.title || f?.title || number
  const path = f === undefined ? undefined : `${dir()}/${f.folder}`
  const open = status === 'done' ? 0 : (f?.questions ?? []).filter(q => !q.isResolved).length
  const checks = checksFor(number)
  const canReady = status === 'draft' && isReadyable(checks)
  const job = jobFor(number)
  const waiting = blockersOpen(row?.blockedBy ?? [])
  const tp = ticketPlan(number)
  const stale = staleChips(number)
  const list = query(items(), S.filters)
  const at = list.findIndex(i => i.number === number)
  const prev = at > 0 ? list[at - 1] : undefined
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined
  const isConfirming = (what: string) => S.confirm === `${number}:${what}`
  const confirm = (what: string) => {
    S.confirm = isConfirming(what) ? undefined : `${number}:${what}`
    redraw($)
  }
  /** Prev / Next and the rd / eval tabs keep where Back returns to. */
  const keep = from === undefined ? {} : { from }

  if (focusQuestions) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button key="back" label={`‹ ${number}`} plain onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
          <Text color={G.faint}>/ Questions</Text>
        </Box>
        <Text color={G.ink} size="heading" weight="bold">
          {title}
        </Text>
        {Toast(ui)}
        {QuestionsCard($, ui, number, true) ?? <Text color={G.soft}>This ticket has no open questions section.</Text>}
      </Box>
    )
  }

  const primary: RenderChildren =
    job !== undefined ? null : status === 'ready' ? (
      <Button key="run" label="▶ Run this ticket" hotkey="x" variant="primary" onPress={() => runTicket($, number)} />
    ) : canReady ? (
      <Button key="ready" label="✓ Mark ready" hotkey="m" variant="primary" onPress={() => void setStatus($, number, 'ready', 'draft')} />
    ) : status === 'draft' && open > 0 ? (
      <Button key="questions" label={`Answer ${open} question${open === 1 ? '' : 's'}`} hotkey="q" variant="primary" onPress={() => go($, { kind: 'questions', number })} />
    ) : null

  return (
    <Box flexDirection="column" gap={1}>
      {/* Breadcrumb + prev/next */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button key="back" label={`‹ ${viewName(from)}`} plain onPress={() => go($, from ?? { kind: 'board' })} />
          <Text color={G.faint} mono>
            {`/ ${number}`}
          </Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          {at >= 0 && (
            <Text color={G.faint} size="footnote">
              {`${at + 1} of ${list.length}`}
            </Text>
          )}
          {prev !== undefined && <Button key="prev-ticket" label="‹ Prev" hotkey="k" plain onPress={() => go($, { kind: 'ticket', number: prev.number, tab, ...keep })} />}
          {next !== undefined && <Button key="next-ticket" label="Next ›" hotkey="j" plain onPress={() => go($, { kind: 'ticket', number: next.number, tab, ...keep })} />}
        </Box>
      </Box>

      {/* Title block */}
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={2} alignItems="center">
          <Text color={G.faint} mono>
            {number}
          </Text>
          {KindTag(ui, kind)}
          {StatusPill(ui, status)}
          {row?.mode !== undefined && row.mode !== '' && Pill(ui, row.mode, G.soft)}
        </Box>
        <Text color={G.ink} size="title" weight="bold">
          {title}
        </Text>
        {status === 'blocked' || status === 'unlisted' ? null : Stepper(ui, status)}
      </Box>

      {Toast(ui)}

      {status === 'blocked' && (
        <Box backgroundColor={tint(STATUS_HEX.blocked!, 0.12)} borderStyle="round" borderColor={tint(STATUS_HEX.blocked!, 0.55)} paddingX={2} paddingY={1}>
          <Text color={STATUS_HEX.blocked!}>{`⛔ Blocked${row?.notes ? ` — ${row.notes}` : ''}`}</Text>
        </Box>
      )}
      {stale.length > 0 && (
        <Box key="stale-notice" flexDirection="column" backgroundColor={tint(STATUS_HEX.draft!, 0.12)} borderStyle="round" borderColor={tint(STATUS_HEX.draft!, 0.55)} paddingX={2} paddingY={1}>
          {stale.map(c => (
            <Button key={`review-${c.section}`} plain onPress={() => reviewStale($, number, from)}>
              <Text color={STATUS_HEX.draft!}>{`⚠ ${c.label}`}</Text>
            </Button>
          ))}
        </Box>
      )}
      {row === undefined && f !== undefined && <Text color={STATUS_HEX.blocked!}>⚠ This folder has no row on BOARD.md.</Text>}
      {f === undefined && <Text color={STATUS_HEX.blocked!}>{`⚠ No folder for ${number} in ${dir()}/.`}</Text>}

      {/* Actions */}
      <Box flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
        {primary}
        {job !== undefined && (
          <Box flexDirection="row" gap={1} alignItems="center" backgroundColor={tint(G.accent, 0.1)} borderStyle="round" borderColor={tint(G.accent, 0.5)} paddingX={2}>
            <Text color={G.accent}>{`✎ AI is ${job.kind === 'draft' || job.kind === 'plan' ? 'writing' : job.kind === 'fold' ? 'folding answers into' : 'improving'} this ticket…`}</Text>
            <Button key="viewagent" label="Watch" plain onPress={() => void openTranscript($, job.agentId)} />
          </Box>
        )}
        {status === 'draft' && open > 0 && primary !== null && !canReady ? null : status === 'draft' && open > 0 ? (
          <Button key="questions" label={`Answer ${open} question${open === 1 ? '' : 's'}`} hotkey="q" onPress={() => go($, { kind: 'questions', number })} />
        ) : null}
        {status === 'ready' && <Button key="draft" label="↩ Back to draft" hotkey="d" onPress={() => void setStatus($, number, 'draft', 'ready')} />}
        {status === 'blocked' && <Button key="unblock-draft" label="Unblock → draft" onPress={() => void setStatus($, number, 'draft', 'blocked')} />}
        {job === undefined && f !== undefined && <Button key="enhance" label="✨ Enhance with AI" hotkey="e" onPress={() => void startJob($, number, 'enhance')} />}
        <Button key="brainstorm" label="✨ Brainstorm" hotkey="b" onPress={() => brainstorm($, number)} />
        <Button key="discuss" label="Discuss in chat" plain onPress={() => void fill($, `Let's look at ticket ${number} (${path ?? dir()}/rd.md). `, 'Started a message in your prompt box')} />
      </Box>
      {job !== undefined && S.watching === job.agentId && AgentActivity(ui, job.agentId, S.agents.find(a => a.id === job.agentId)?.name ?? 'the writer')}

      {/* Two columns: content | properties */}
      <Box flexDirection="row" gap={2} flexWrap="wrap" alignItems="flex-start">
        <Box flexDirection="column" gap={1} flexGrow={1} flexShrink={1} width="66%" minWidth={50}>
          {row?.notes && row.notes !== '—'
            ? Card(ui, <ui.Markdown key="ticket-notes" text={row.notes.replace(/;\s+/g, '\n- ').replace(/^/, '- ')} />, {
                key: 'notes-card-ticket',
                title: 'Progress notes · BOARD.md',
                right: (() => {
                  const r = resultOf(row.notes)
                  return r === undefined ? undefined : Pill(ui, r.label, (HUE as Record<string, string>)[r.hue] ?? HUE.slate)
                })(),
              })
            : null}
          {status === 'done' ? null : QuestionsCard($, ui, number, false)}
          {status === 'draft' &&
            Card(
              ui,
              checks.map(c => (
                <Text key={`chk-${c.id}`} color={c.isOk ? STATUS_HEX.ready! : c.isHard ? STATUS_HEX.blocked! : STATUS_HEX.draft!} size="footnote">
                  {`${c.isOk ? '✓' : c.isHard ? '✗' : '!'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`}
                </Text>
              )),
              { key: 'checks-card', title: canReady ? 'Ready check · passes' : 'Ready check', accent: tint(canReady ? STATUS_HEX.ready! : STATUS_HEX.draft!, 0.45) },
            )}
          <Box key="doc-tabs" flexDirection="row" gap={1} alignItems="center" paddingTop={1}>
            <Button key="tab-rd" label="Requirements" variant={tab === 'rd' ? 'primary' : 'secondary'} onPress={() => go($, { kind: 'ticket', number, tab: 'rd', ...keep })} />
            <Button key="tab-eval" label="Acceptance checks" variant={tab === 'eval' ? 'primary' : 'secondary'} onPress={() => go($, { kind: 'ticket', number, tab: 'eval', ...keep })} />
            <Text color={G.faint} size="footnote" mono>
              {`${tab === 'rd' ? 'rd' : 'eval'}.md`}
            </Text>
          </Box>
          {docSections((tab === 'rd' ? f?.rd : f?.ev) ?? '').map((sec, n) =>
            Card(ui, <ui.Markdown key={`md-${number}-${tab}-${n}`} text={sec.body === '' ? '_Empty._' : sec.body} />, {
              key: `sec-${tab}-${n}`,
              title: sec.title,
            }),
          )}
          {((tab === 'rd' ? f?.rd : f?.ev) ?? '').trim() === '' && <Text color={G.soft}>{`No ${tab === 'rd' ? 'rd' : 'eval'}.md yet.`}</Text>}
        </Box>

        <Box flexDirection="column" gap={1} flexGrow={0} flexShrink={0} width="30%" minWidth={30}>
          {Card(
            ui,
            [
              Prop(ui, 'Status', StatusPill(ui, status)),
              rdLock(number) !== undefined ? (
                <Box key={`kind-locked-${number}`} flexDirection="column">
                  {Prop(ui, 'Type', `${KIND[kind].icon} ${KIND[kind].label}`)}
                  <Text color={G.faint} size="footnote">
                    {`🔒 ${rdLock(number)}`}
                  </Text>
                </Box>
              ) : (
                <Select
                  key={`kind-${number}`}
                  label="Type"
                  value={kind}
                  options={KINDS.map(k => ({ value: k, label: `${KIND[k].icon} ${KIND[k].label}` }))}
                  onSelect={v => void setKind($, number, v as Kind)}
                />
              ),
              row === undefined ? null : hasColumn('mode') ? (
                <Select
                  key={`mode-${number}`}
                  label="Mode"
                  value={row.mode === 'team' ? 'team' : 'solo'}
                  options={[{ value: 'solo', label: 'Solo' }, { value: 'team', label: 'Team' }]}
                  onSelect={v => saveCell($, number, { mode: v }, `Mode → ${v}`)}
                />
              ) : (
                <Text key={`mode-${number}`} color={G.faint} size="footnote">{noColumn('mode')}</Text>
              ),
              row === undefined ? null : hasColumn('blockedBy') ? (
                <Input
                  key={`blockedby-${number}`}
                  label="Depends on"
                  value={row.blockedBy.join(', ')}
                  placeholder="e.g. 0003, 0007"
                  submitLabel="Save"
                  onSubmit={v => saveCell($, number, { blockedBy: parseBlockedBy(v).filter(n => n !== number) }, 'Dependencies saved')}
                />
              ) : (
                <Text key={`blockedby-${number}`} color={G.faint} size="footnote">{noColumn('blockedBy')}</Text>
              ),
              waiting.length > 0 ? (
                <Text key="waiting" color={STATUS_HEX.blocked!} size="footnote">
                  {`⛔ Waiting on ${waiting.join(', ')}`}
                </Text>
              ) : null,
              tp !== undefined
                ? Prop(
                    ui,
                    'Plan item',
                    tp.build === undefined ? (
                      <Text key="plan-item" color={tp.isMissing ? STATUS_HEX.blocked! : tp.isOffPlan ? G.soft : G.ink}>
                        {tp.item}
                      </Text>
                    ) : (
                      <Button key="plan-item" plain onPress={() => openPlan($, tp.build)}>
                        <Text color={G.accent}>{`${tp.item} ›`}</Text>
                      </Button>
                    ),
                  )
                : null,
              tp !== undefined && tp.chips.length > 0
                ? Prop(
                    ui,
                    'Design',
                    <Box key="design-chips" flexDirection="row" gap={1} flexWrap="wrap">
                      {tp.chips.map(c => (
                        <Button key={`chip-${c.id}`} plain onPress={() => openDesign($, c.id)}>
                          {Pill(ui, c.isStale ? `${c.label} · stale` : c.label, c.isStale ? STATUS_HEX.draft! : HUE.sky)}
                        </Button>
                      ))}
                    </Box>,
                  )
                : null,
              Prop(ui, 'Owner', row?.owner && row.owner !== '—' ? row.owner : 'Unassigned'),
              Prop(ui, 'Updated', ago(item?.updatedMs ?? 0)),
              
              path !== undefined
                ? Prop(
                    ui,
                    'Folder',
                    <Button key="copy" plain onPress={p => void $.ui.copy({ text: path, surface: p.surface }).then(() => say($, `Copied ${path}`))}>
                      <Text color={G.accent} mono size="footnote">
                        {`${path}  ⧉`}
                      </Text>
                    </Button>,
                  )
                : null,
            ],
            { key: 'props-card', title: 'Properties' },
          )}

          {row !== undefined &&
            Card(
              ui,
              [
                status !== 'blocked' && status !== 'done' ? (
                  <Button key="block" label="⛔ Block…" onPress={() => confirm('block')} />
                ) : null,
                isConfirming('block') ? (
                  <Input
                    key={`block-${number}`}
                    label={hasColumn('notes') ? 'Why is it blocked?' : 'Why is it blocked? (not saved: BOARD.md has no Notes column)'}
                    submitLabel="Mark blocked"
                    onSubmit={reason => {
                      S.confirm = undefined
                      void setStatus($, number, 'blocked', status, `blocked: ${reason.trim() || 'no reason given'}`)
                    }}
                  />
                ) : null,
                <Button key="override" label="Change status by hand…" plain onPress={() => confirm('override')} />,
                isConfirming('override') ? (
                  <Box key="override-box" flexDirection="column" gap={1}>
                    <Text color={STATUS_HEX.draft!} size="footnote">
                      The router normally moves in-progress, in-check and done. Change it by hand only to fix the board.
                    </Text>
                    <Select
                      key={`override-${number}`}
                      label="Set status"
                      value={S.overrideTo || status}
                      options={STATUSES.map(s => ({ value: s, label: STATUS_NAME[s] ?? s }))}
                      onSelect={v => {
                        S.overrideTo = v
                        redraw($)
                      }}
                    />
                    <Box flexDirection="row" gap={1}>
                      <Button
                        key="override-ok"
                        label="Apply"
                        variant="primary"
                        onPress={() => {
                          const to = S.overrideTo || status
                          S.confirm = undefined
                          S.overrideTo = ''
                          if (to !== status) void setStatus($, number, to, status)
                          else redraw($)
                        }}
                      />
                      <Button key="override-cancel" label="Cancel" plain onPress={() => confirm('override')} />
                    </Box>
                  </Box>
                ) : null,
              ],
              { key: 'more-card', title: 'More' },
            )}
        </Box>
      </Box>
    </Box>
  )
}

// ---------- New ticket ----------

export function deskNew($: $, ui: UI): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const kind = (S.newKind as Kind) in KIND ? (S.newKind as Kind) : 'feature'
  const placeholder =
    kind === 'bug'
      ? 'What happens now, what should happen instead, and how to reproduce it…'
      : kind === 'chore'
        ? 'What needs doing and why (refactor, upgrade, cleanup)…'
        : 'Describe the feature: who it is for, what it should do, anything you already know…'
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1} alignItems="center">
        <Button key="back" label="‹ Board" plain onPress={() => go($, { kind: 'board' })} />
        <Text color={G.faint}>/ New ticket</Text>
      </Box>
      <Text color={G.ink} size="title" weight="bold">
        New ticket
      </Text>
      {Toast(ui)}
      <Box flexDirection="row" gap={2} flexWrap="wrap" alignItems="flex-start">
        <Box flexDirection="column" gap={1} flexGrow={1} flexShrink={1} width="62%" minWidth={50}>
          {Card(
            ui,
            [
              <Box key="kinds" flexDirection="row" gap={1}>
                {KINDS.map(k => (
                  <Button
                    key={`newkind-${k}`}
                    variant={kind === k ? 'primary' : 'secondary'}
                    onPress={() => {
                      S.newKind = k
                      redraw($)
                    }}
                  >
                    {`${KIND[k].icon} ${KIND[k].label}`}
                  </Button>
                ))}
              </Box>,
              <Input
                key="new-title"
                label="Title (optional — the AI picks one if empty)"
                value={S.drafts.get('new-title') ?? ''}
                placeholder={kind === 'bug' ? 'e.g. Export button does nothing on Safari' : 'e.g. Dark mode for the settings page'}
                submitLabel="Next"
                onInput={v => void S.drafts.set('new-title', v)}
                onSubmit={v => void S.drafts.set('new-title', v)}
              />,
              <Input
                key="new-idea"
                label="Description"
                value={S.drafts.get('new-idea') ?? ''}
                rows={6}
                autoFocus
                placeholder={placeholder}
                submitLabel="Create + enhance"
                onInput={v => void S.drafts.set('new-idea', v)}
                onSubmit={v => {
                  S.drafts.set('new-idea', v)
                  void createTicket($, true)
                }}
              />,
              <Box key="meta" flexDirection="row" gap={2} flexWrap="wrap">
                <Select key="new-mode" label="Mode" value={S.newMode} options={[{ value: 'solo', label: 'Solo' }, { value: 'team', label: 'Team' }]} onSelect={v => ((S.newMode = v), redraw($))} />
                <Input
                  key="new-blocked"
                  label="Depends on"
                  value={S.drafts.get('new-blocked') ?? ''}
                  placeholder="e.g. 0003"
                  submitLabel="Set"
                  onInput={v => void S.drafts.set('new-blocked', v)}
                  onSubmit={v => void S.drafts.set('new-blocked', v)}
                />
              </Box>,
              <Box key="create-row" flexDirection="row" gap={1} flexWrap="wrap">
                <Button key="create-ai" label="✨ Create + AI enhance" variant="primary" onPress={() => void createTicket($, true)} />
                <Button key="create-plain" label="Create skeleton only" onPress={() => void createTicket($, false)} />
                <Button key="create-chat" label="Write it in chat with /ticket" plain onPress={() => void draftInChat($)} />
              </Box>,
            ],
            { key: 'new-card' },
          )}
        </Box>
        <Box flexDirection="column" gap={1} flexGrow={0} flexShrink={0} width="34%" minWidth={30}>
          {Card(
            ui,
            [
              <Text key="w1" color={G.soft} size="footnote">
                1. The ticket gets the next number, a folder with rd.md and eval.md, and a draft row on BOARD.md.
              </Text>,
              <Text key="w2" color={G.soft} size="footnote">
                2. The AI writer fills in what it should do, its scope, the acceptance checks, and the questions only you can answer.
              </Text>,
              <Text key="w3" color={G.soft} size="footnote">
                3. You answer the questions here, mark it ready, and run it.
              </Text>,
            ],
            { key: 'how-card', title: 'What happens next' },
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ---------- Start ----------

/** Over the board: tickets exist but no design or plan. Set up opens Start; Dismiss is remembered per project. */
function Banner($: $, ui: UI): RenderChildren {
  const text = bannerText()
  if (text === undefined) return null
  const { Box, Text, Button } = ui
  const hex = STATUS_HEX.draft!
  return (
    <Box key="banner" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} backgroundColor={tint(hex, 0.1)} borderStyle="round" borderColor={tint(hex, 0.5)} paddingX={2}>
      <Text color={hex} weight="semibold">{`${text} →`}</Text>
      <Box flexDirection="row" gap={1}>
        <Button key="banner-setup" label="Set up" variant="primary" onPress={() => go($, { kind: 'start' })} />
        <Button key="banner-dismiss" label="Dismiss" plain onPress={() => void setStartFlag($, { isBannerDismissed: true })} />
      </Box>
    </Box>
  )
}

function SetupLine(ui: UI, key: string, mark: string, label: string, detail: string, actions?: RenderChildren, notes: string[] = []) {
  const { Box, Text } = ui
  const hex = mark === '✓' ? STATUS_HEX.ready! : mark === '!' ? STATUS_HEX.draft! : G.faint
  return (
    <Box key={key} flexDirection="column">
      <Box flexDirection="row" gap={2} alignItems="center" flexWrap="wrap">
        <Text color={hex} weight="bold">
          {mark}
        </Text>
        <Box minWidth={22}>
          <Text color={G.ink} weight="semibold">
            {label}
          </Text>
        </Box>
        {detail !== '' && (
          <Text color={G.soft} mono>
            {detail}
          </Text>
        )}
        {actions}
      </Box>
      {notes.map((n, i) => (
        <Box key={`${key}-note-${i}`} paddingLeft={4}>
          <Text color={G.faint} size="footnote">
            {n}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

/** "I already have docs…": opens the adopt flow (0009), where AI converts existing files and you review the result. */
function AdoptStart($: $, ui: UI): RenderChildren {
  const { Box, Text, Button } = ui
  return (
    <Box key="start-adopt-box" flexDirection="column" gap={0}>
      <Box key="start-adopt-actions" flexDirection="row" gap={1}>
        <Button key="start-adopt" label={ADOPT_LABEL} hotkey="h" onPress={() => openAdopt($)} />
      </Box>
      <Text key="start-adopt-note" color={G.faint} size="footnote">
        {ADOPT_NOTE}
      </Text>
    </Box>
  )
}

/** The Start screen: a Setup → Idea → Design → Plan → Tickets stepper with ways to begin. Buttons only fill the prompt. */
export function deskStart($: $, ui: UI): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const f = startFacts()
  const at = startStep(f)
  const lines = setupLines()
  const p = S.project
  const idea = startIdea()
  const hasBoard = S.snap?.hasBoard === true
  const marks = stepMarks()
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" gap={1} alignItems="center">
        {hasBoard && <Button key="back" label="‹ Board" plain onPress={() => showBoard($)} />}
        <Text color={G.ink} size="title" weight="bold">
          Start a project
        </Text>
      </Box>
      {Toast(ui)}
      <Box flexDirection="row" alignItems="center" flexWrap="wrap" gap={1}>
        {marks.map((m, n) => {
          const hex = m.state === 'now' ? G.accent : m.state === 'done' ? STATUS_HEX.ready! : G.faint
          return [
            <Text key={`step-${m.step}`} color={hex} {...(m.state === 'now' ? { backgroundColor: tint(hex, G.look === 'dark' ? 0.18 : 0.1) } : {})} weight={m.state === 'now' ? 'bold' : 'regular'} size="footnote">
              {` ${m.state === 'done' ? '✓' : m.state === 'now' ? '●' : '○'} ${m.name} `}
            </Text>,
            n < marks.length - 1 ? (
              <Text key={`step-arrow-${m.step}`} color={G.faint}>
                ──
              </Text>
            ) : null,
          ]
        })}
      </Box>
      {Card(
        ui,
        [
          SetupLine(
            ui,
            'line-git',
            lines.git.mark,
            lines.git.label,
            lines.git.detail,
            f.git === 'none' ? (
              <Button key="start-git" label="Initialise git and make the first commit" hotkey="i" onPress={() => startFill($, startPrompt.gitInit())} />
            ) : f.git === 'repo' && !f.hasCommit ? (
              <Button key="start-push" label={f.hasOrigin ? 'Make the first commit and push' : 'Make the first commit'} hotkey="u" onPress={() => startFill($, startPrompt.firstPush())} />
            ) : undefined,
            f.git === 'none' || (f.git === 'repo' && !f.hasCommit) ? [ASK_NOTE] : [],
          ),
          SetupLine(
            ui,
            'line-github',
            lines.github.mark,
            lines.github.label,
            lines.github.detail,
            !f.hasOrigin && !f.isGithubSkipped ? (
              <Box key="github-actions" flexDirection="row" gap={1}>
                <Button key="start-github" label="Create private repo on GitHub" hotkey="g" onPress={() => startFill($, startPrompt.github())} />
                <Button key="start-skip" label="Skip" hotkey="k" plain onPress={() => void setStartFlag($, { isGithubSkipped: true })} />
              </Box>
            ) : undefined,
            !f.hasOrigin && !f.isGithubSkipped ? [ORIGIN_NOTE, ASK_NOTE] : [],
          ),
        ],
        { key: 'start-setup', title: 'Setup', accent: at === 'setup' ? tint(G.accent, 0.5) : undefined },
      )}
      {!f.hasDesign &&
        !f.hasPlan &&
        Card(
          ui,
          [
            f.hasIdea ? (
              <Text key="idea-file" color={STATUS_HEX.ready!}>
                {`✓ Idea written down: ${p?.ideaPath ?? ''}`}
              </Text>
            ) : null,
            <Input
              key="start-idea"
              label="What are you building?"
              rows={3}
              value={S.drafts.get('start-idea') ?? ''}
              placeholder="A booking app for small salons; owners hate phone tag…"
              submitLabel="Save"
              onInput={v => setStartIdea($, v)}
              onSubmit={v => setStartIdea($, v)}
            />,
            <Box key="idea-actions" flexDirection="row" gap={1} flexWrap="wrap">
              <Button key="start-brainstorm" label="✨ Brainstorm it first" hotkey="b" variant={idea !== '' ? 'primary' : undefined} dimColor={idea === ''} onPress={() => fillWithIdea($, startPrompt.brainstorm)} />
              <Button key="start-design" label="Go straight to design" hotkey="d" dimColor={idea === ''} onPress={() => fillWithIdea($, startPrompt.design)} />
              {p?.hasCode === true && <Button key="start-code" label="Draft a design from the code" hotkey="c" onPress={() => startFill($, startPrompt.fromCode())} />}
            </Box>,
            idea === '' ? (
              <Text key="idea-hint" color={G.faint} size="footnote">
                Type your idea to brainstorm it or go straight to design.
              </Text>
            ) : null,
            AdoptStart($, ui),
          ],
          { key: 'start-idea-card', title: 'Idea', accent: at === 'idea' || at === 'design' ? tint(G.accent, 0.5) : undefined },
        )}
      {(f.hasDesign || at === 'design') &&
        Card(
          ui,
          [
            f.hasDesign ? (
              <Text key="design-file" color={STATUS_HEX.ready!}>{`✓ ${p?.designPath ?? ''}`}</Text>
            ) : (
              <Button key="start-from-idea" label={`Write the design from ${p?.ideaPath ?? 'the idea'}`} hotkey="w" variant="primary" onPress={() => startFill($, startPrompt.fromIdea())} />
            ),
            at === 'plan' ? <Button key="start-plan" label="Plan the builds from the design" hotkey="p" variant="primary" onPress={() => startFill($, startPrompt.plan())} /> : null,
            f.hasPlan ? <Text key="plan-file" color={STATUS_HEX.ready!}>{`✓ ${p?.planPath ?? ''}`}</Text> : null,
            f.hasDesign !== f.hasPlan ? AdoptStart($, ui) : null,
          ],
          { key: 'start-design-card', title: 'Design and plan' },
        )}
      {at === 'tickets' &&
        Card(
          ui,
          [
            hasBoard ? (
              <Button key="start-new" label="+ New ticket" hotkey="n" variant="primary" onPress={() => go($, { kind: 'new' })} />
            ) : (
              <Button key="start-board-setup" label="Set up board" hotkey="s" variant="primary" onPress={() => void setUpBoardOnly($)} />
            ),
          ],
          { key: 'start-tickets-card', title: 'Tickets' },
        )}
      {at === 'done' && <Text color={STATUS_HEX.ready!}>✓ Everything is set up.</Text>}
      {!hasBoard && at !== 'tickets' && <Button key="setup-board-only" label="Set up board only" hotkey="s" plain onPress={() => void setUpBoardOnly($)} />}
    </Box>
  )
}

/** Exported for tests and the terminal fallback: the statuses a ticket can still move through. */
export const flow = FLOW
export const statusName = (s: string) => STATUS_NAME[s] ?? s
export { statusOf }

// ---------- Project bar + README ----------

/** What the colors button says: the current choice; a press moves to the next one. */
const SCHEME_LABEL: Record<string, string> = { auto: '◐ Colors: app', dark: '☾ Colors: dark', light: '☀ Colors: light' }

/** Top of the pane: the project's general name, its repo and branch, and the README button. */
export function ProjectBar($: $, ui: UI): RenderChildren {
  const { Box, Text, Button } = ui
  const p = S.project
  const name = p?.name ?? 'Loading project…'
  const repoText = p === undefined ? '' : p.repo !== '' ? p.repo : p.isGit ? 'local git · no origin remote' : 'not a git repository'
  const isReadme = S.view.kind === 'readme'
  const summary =
    p === undefined ? '' : p.summary !== '' ? p.summary : p.readme === undefined ? 'No README yet. Open README to have Claude write one, so this header can say what the project is.' : 'The README has a title but no description paragraph yet.'
  // Buttons get their own row, never squeezed beside shrinking text: in the desktop a truncated
  // text column can overlap a Button beside it and swallow its clicks.
  return (
    <Box key="project" flexDirection="column" gap={1} paddingX={2} paddingY={1} backgroundColor={G.look === 'light' ? G.card : tint(G.accent, 0.07)} borderStyle="round" borderColor={G.look === 'light' ? G.edge : tint(G.accent, 0.3)}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Text color={G.faint} size="caption" weight="bold">
          PROJECT
        </Text>
        <Box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
          <Button
            key="scheme"
            label={SCHEME_LABEL[S.scheme]}
            onPress={() => void setSchemeChoice($, SCHEMES[(SCHEMES.indexOf(S.scheme) + 1) % SCHEMES.length]!)}
          />
          <Button
            key="readme"
            hotkey="o"
            variant={isReadme ? 'primary' : 'secondary'}
            label={p !== undefined && p.readme === undefined ? 'README (none)' : isReadme ? '‹ Board' : 'README'}
            onPress={() => void openReadme($)}
          />
        </Box>
      </Box>
      <Text color={G.ink} size="heading" weight="bold">
        {name}
      </Text>
      {summary !== '' && (
        <Text color={p?.summary === '' ? STATUS_HEX.draft! : G.soft}>{summary}</Text>
      )}
      <Box flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
        {p !== undefined && p.repoUrl !== '' && ui.Link !== undefined ? (
          <ui.Link key="repo-link" href={p.repoUrl} label={`⎇ ${repoText}`} />
        ) : (
          <Text color={p?.repo === '' ? STATUS_HEX.draft! : G.faint} size="footnote" mono>
            {`⎇ ${repoText}`}
          </Text>
        )}
        {p !== undefined && p.branch !== '' && (
          <Text color={G.faint} size="footnote" mono>
            {`· branch ${p.branch}`}
          </Text>
        )}
      </Box>
      {S.root !== '' && S.root !== S.cwd && (
        <Text color={G.soft} size="footnote">{`This session runs in a worktree; the board is read from the main checkout: ${S.root}`}</Text>
      )}
    </Box>
  )
}

export async function openReadme($: $) {
  if (S.view.kind === 'readme') return go($, { kind: 'board' })
  S.readmePart = 0
  go($, { kind: 'readme' })
  await refresh($, true)
}

const readmeAsk = () =>
  `Update README.md so it matches the project as it is now: what it is, how to install and run it, how to use it, and what changed recently (see ${boardPath()}). Keep what is still true; fix what is stale.`

/** Characters of README per part on the glass: its markdown is drawn several times larger than the text. */
export const README_PART = 8000

/**
 * A long README split into parts the glass can draw: the host refuses a drawing over 100,000
 * characters serialized (and the pane goes blank), and the glass markdown of a 60 KB README is
 * nearly 300,000. Parts break before a heading or at a blank line, never inside a code block.
 */
export function readmeParts(text: string, max = README_PART): string[] {
  const parts: string[] = []
  let cur: string[] = []
  let size = 0
  let inCode = false
  for (const line of text.split(/\r?\n/)) {
    const isBreak = !inCode && (/^#{1,6}\s/.test(line) || line.trim() === '')
    if (size >= max && (isBreak || size >= max * 3)) {
      parts.push(cur.join('\n'))
      cur = []
      size = 0
    }
    if (line.startsWith('```')) inCode = !inCode
    cur.push(line)
    size += line.length + 1
  }
  if (cur.some(l => l.trim() !== '')) parts.push(cur.join('\n'))
  return parts.length === 0 ? [''] : parts
}

/** What one README part may take of the drawing, the view's own chrome left room for. */
const README_PART_BUDGET = 60_000
let partsMemo: { text: string; parts: string[] } | undefined

/** `readmeParts`, each part split again until its glass drawing fits README_PART_BUDGET (dense tables and callouts draw far larger than prose). */
function drawableParts(ui: UI, text: string): string[] {
  if (partsMemo?.text === text) return partsMemo.parts
  const size = (t: string) => {
    try {
      return JSON.stringify(ui.Markdown({ text: t } as never))?.length ?? 0
    } catch {
      return 0
    }
  }
  const split = (t: string, max: number): string[] => {
    if (max < 250 || size(t) <= README_PART_BUDGET) return [t]
    const parts = readmeParts(t, Math.floor(max / 2))
    return parts.length === 1 ? parts : parts.flatMap(p => split(p, Math.floor(max / 2)))
  }
  const parts = readmeParts(text).flatMap(p => split(p, README_PART))
  partsMemo = { text, parts }
  return parts
}

export function deskReadme($: $, ui: UI): RenderChildren {
  const { Box, Text, Button } = ui
  const p = S.project
  const text = p?.readme
  const rel = p === undefined || p.readmePath === '' ? 'README.md' : p.readmePath.replace(`${p.folder}/`, '')
  const parts = text === undefined ? [] : drawableParts(ui, text)
  const part = Math.max(0, Math.min(S.readmePart, parts.length - 1))
  const turn = (n: number) => {
    S.readmePart = n
    redraw($)
  }
  const pager =
    parts.length > 1 ? (
      <Box key="readme-pager" flexDirection="row" gap={1} alignItems="center">
        {part > 0 && <Button key="readme-prev" label="‹ Previous part" onPress={() => turn(part - 1)} />}
        <Text color={G.soft} size="footnote">{`Part ${part + 1} of ${parts.length}`}</Text>
        {part < parts.length - 1 && <Button key="readme-next" label="Next part ›" onPress={() => turn(part + 1)} />}
      </Box>
    ) : null
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Button key="back" label="‹ Board" plain onPress={() => go($, { kind: 'board' })} />
          <Text color={G.faint}>{`/ ${rel}`}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="readme-refresh" label="↻" hotkey="r" onPress={() => void refresh($, true).then(() => say($, 'README reloaded'))} />
          <Button
            key="readme-update"
            label={text === undefined ? '✨ Ask Claude to write a README' : '✨ Ask Claude to update it'}
            variant="primary"
            onPress={() =>
              void fill(
                $,
                text === undefined ? `Write a README.md for this project: what it is, how to install and run it, and how to use it. Read the code and ${boardPath()} first.` : readmeAsk(),
                'In your prompt box — press Enter to send it',
              )
            }
          />
        </Box>
      </Box>
      {Toast(ui)}
      {text === undefined
        ? Card(
            ui,
            <Text color={G.soft}>This project has no README yet. Every ticket's workflow includes keeping it current; you can also ask Claude to write one now.</Text>,
            { key: 'readme-none', title: 'No README' },
          )
        : Card(ui, [<ui.Markdown key="readme-md" text={parts[part]!} />, pager], { key: 'readme-body', title: rel })}
    </Box>
  )
}

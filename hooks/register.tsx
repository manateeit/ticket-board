// ticket-board: tickets/BOARD.md and its tickets in a side pane.
import type { EngineInterface, Register } from 'claude-code'

import { isInsideFolder, jobNote, pumpPlanQueue } from './ai'
import { docsGaps } from './core/ticket'
import { S, abs, isLive, dir, resetSession, editRow, followAppTheme, loadAgents, loadAppTheme, loadFilters, loadJobs, loadScheme, loadPlanMode, loadStartFlags, loadVersion, logAgentTool, redraw, refresh, rowOf, saveJobs, say, type Options } from './store'
import { G, glassUI, setScheme } from './glass'
import { drawPane, go, type UI } from './views'

const PANE = 'ticket-board'
const TITLE = 'Tickets'
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

type $ = EngineInterface

/** Runs work in the background; a pane or session that went away meanwhile is not an error. */
const bg = (p: Promise<unknown>) => void p.catch(() => undefined)

function readOptions(o: Readonly<Record<string, unknown>>): Options {
  const n = Number(o.pollSeconds)
  return {
    ticketsDir: typeof o.ticketsDir === 'string' && o.ticketsDir.trim() !== '' ? o.ticketsDir.trim() : 'tickets',
    pollSeconds: Number.isFinite(n) && n >= 1 ? n : 3,
    autoOpen: o.autoOpen !== false,
    writerModel: typeof o.writerModel === 'string' ? o.writerModel.trim() : '',
    showVersion: o.showVersion !== false,
  }
}

let shownTitle = TITLE
/** The pane's tab says when work is going on, so a full-size or background pane still tells you. */
function syncTitle($: $) {
  if (!S.isOpen) return
  const working = S.busySince !== 0 || S.jobs.size > 0 || S.agents.some(isLive)
  const t = working ? `${TITLE} · ● working` : TITLE
  if (t === shownTitle) return
  shownTitle = t
  bg($.ui.open({ id: PANE, title: t }))
}

async function open($: $, byCommand: boolean) {
  S.openedByCommand = S.openedByCommand || byCommand
  shownTitle = TITLE
  const r = await $.ui.open({ id: PANE, title: TITLE, ...(byCommand ? { focus: true as const } : {}) })
  S.isOpen = r.isPlaced
  if (r.isPlaced) {
    bg(refresh($))
    bg(loadAgents($))
  }
  return r
}

async function hasTicketsFolder($: $): Promise<boolean> {
  try {
    return await $.fs.exists(abs(dir()))
  } catch {
    return false
  }
}

function touchesTickets(path: unknown): boolean {
  if (typeof path !== 'string') return false
  const d = dir()
  return path.includes(`/${d}/`) || path.startsWith(`${d}/`)
}

export const register: Register = (on, options) => {
  S.options = readOptions(options)

  on('session.start', async ($, e, next) => {
    resetSession(e.cwd)
    await $.command.register({
      name: 'board',
      description: 'Open the ticket board pane: /board · /board 14 · /board new <idea> · /board plan · /board design',
      argumentHint: '[ticket number | new <idea> | plan | design]',
    })
    await loadFilters($)
    await loadScheme($)
    await loadAppTheme($)
    await loadJobs($)
    await loadStartFlags($)
    await loadPlanMode($)
    await loadVersion($)
    await refresh($)
    // Opens on its own only where a tickets/ folder exists (with or without BOARD.md); where it lands
    // (Start or the board) is up to drawPane. Elsewhere /board opens Start.
    if (S.options.autoOpen && e.isInteractive && (S.snap?.hasBoard === true || (await hasTicketsFolder($)))) bg(open($, false))
    $.clock.every(S.options.pollSeconds * 1000, () => {
      if (S.isOpen) bg(refresh($))
    })
    $.clock.every(3000, () => {
      if (S.isOpen) bg(loadAgents($).then(() => syncTitle($)))
    })
    return next(e)
  })

  // The app's light/dark mode as the settings writer wrote it: Colors "app" follows it, and the
  // control plates are matched to it.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined) followAppTheme($, r.value)
    return r
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'board' }, async ($, e) => {
    if (S.cwd === '') S.cwd = await $.session.cwd()
    await refresh($, true)
    const args = e.args.trim()
    const num = /^#?(\d{1,5})$/.exec(args)
    if (num !== null) {
      const n = num[1]!.padStart(4, '0')
      if (rowOf(n) === undefined && !S.snap?.files.has(n)) return { text: `No ticket ${n} on ${dir()}/BOARD.md.`, isTextDisplayOnly: true }
      go($, { kind: 'ticket', number: n, tab: 'rd' })
    } else if (/^new\b/i.test(args)) {
      const idea = args.replace(/^new\s*/i, '')
      if (idea !== '') S.drafts.set('new-idea', idea)
      go($, { kind: 'new' })
    } else if (args === 'plan' || args === 'design') {
      go($, { kind: args })
    } else if (args === 'close') {
      await $.ui.close({ id: PANE })
      S.isOpen = false
      return { text: 'Ticket board closed.', isTextDisplayOnly: true }
    } else if (args !== '') {
      return { text: 'Usage: /board · /board <number> · /board new <idea> · /board plan · /board design · /board close', isTextDisplayOnly: true }
    }
    const r = await open($, true)
    if (!r.isPlaced) return { text: `The ticket board pane could not open here (${r.reason}).`, isTextDisplayOnly: true }
    return { text: 'Ticket board open.', isTextDisplayOnly: true }
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE) {
      S.isOpen = false
      S.openedByCommand = false
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // Opened automatically but the surface put it inline above the prompt (no room for a side pane): close it again.
    if (!S.openedByCommand && e.props.placement === 'inline') {
      bg($.ui.close({ id: PANE }))
      S.isOpen = false
    }
    S.isOpen = true
    const frame = { rows: e.viewport?.rows ?? 30, columns: e.props.bodyColumns }
    if (e.surface === 'desktop') {
      // One self-painted glass container: the pane never shows the app's own background through it.
      setScheme(S.scheme, S.isAppLight)
      const base = $.ui.resolve(e)
      const ui = { ...glassUI(base as unknown as UI), Svg: base.Svg }
      return (
        <base.Box flexDirection="column" flexGrow={1} backgroundColor={G.base} borderStyle="round" borderColor={G.edge} paddingX={2} paddingY={1}>
          {drawPane($, ui, { ...frame, glass: true })}
        </base.Box>
      )
    }
    const ui = $.ui.resolve(e)
    const { Box } = ui
    return <Box flexDirection="column">{drawPane($, ui, frame)}</Box>
  })

  // Keep the ticket writer inside its ticket folder; refresh after edits to the tickets folder.
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && S.busySince !== 0) {
      const t = (e as unknown as { tool: string }).tool
      if (t !== S.busyTool) {
        S.busyTool = t
        if (S.isOpen) redraw($)
      }
    }
    if (e.agentId !== undefined) {
      logAgentTool(e.agentId, e as unknown as Record<string, unknown>)
      if (S.isOpen && S.watching === e.agentId) redraw($)
    }
    const job = e.agentId === undefined ? undefined : S.jobs.get(e.agentId)
    const input = e as unknown as { tool: string; file_path?: string; notebook_path?: string }
    const path = input.file_path ?? input.notebook_path
    if (job !== undefined && WRITE_TOOLS.has(input.tool)) {
      if (typeof path !== 'string' || !isInsideFolder(path, job.number))
        return { deny: `ticket-board: the ticket writer may only write inside ${dir()}/${job.number}-…/ (rd.md, eval.md).` }
    }
    const ran = await next(e)
    if (S.isOpen && (WRITE_TOOLS.has(input.tool) ? touchesTickets(path) : input.tool === 'Bash')) bg(refresh($))
    return ran
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'ticket-board: its tool guard failed.' }))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      S.busySince = Date.now()
      S.busyTool = ''
      if (S.isOpen) redraw($)
      syncTitle($)
    }
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (S.isOpen) bg(loadAgents($))
    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && S.busySince !== 0) {
      S.busySince = 0
      S.busyTool = ''
      if (S.isOpen) redraw($)
      syncTitle($)
    }
    if (e.agentId !== undefined && S.isOpen) bg(loadAgents($))
    const job = e.agentId === undefined ? undefined : S.jobs.get(e.agentId)
    if (job !== undefined) {
      S.jobs.delete(job.agentId)
      await saveJobs($)
      await refresh($, true)
      const f = S.snap?.files.get(job.number)
      const open = f?.questions.filter(q => !q.isResolved).length ?? 0
      const failed = e.isAborted || e.reason !== 'answer'
      // A ticket from the plan must end with its docs step (0008): report what the writer left out.
      const gaps = !failed && job.kind === 'plan' ? docsGaps(f?.rd, f?.ev) : []
      const base = failed
        ? `AI ${job.kind} stopped (${e.reason}) — see the agent transcript`
        : job.kind === 'fold'
          ? `Answers folded in · ${open} open question${open === 1 ? '' : 's'}`
          : `AI draft done · ${open} open question${open === 1 ? '' : 's'}`
      const note = jobNote(gaps.length === 0 ? base : `${base} · missing ${gaps.join(' and ')}`, job.extra)
      const row = rowOf(job.number)
      if (row !== undefined && (row.notes === '' || row.notes.startsWith('AI '))) await editRow($, job.number, { notes: note }).catch(() => undefined)
      if (failed && job.kind === 'plan' && job.build !== undefined) S.planFailed.set(job.build, { number: job.number, reason: String(e.reason) })
      $.ui.toast(`Ticket ${job.number}: ${note}`)
      say($, `Ticket ${job.number}: ${note}`, failed ? 'error' : gaps.length > 0 ? 'warning' : 'success')
      // A slot is free: the next queued ticket from the plan starts.
      await pumpPlanQueue($).catch(() => undefined)
      if (!failed && open > 0 && job.kind !== 'fold' && S.view.kind === 'ticket' && S.view.number === job.number)
        go($, { kind: 'questions', number: job.number })
      redraw($)
    }
    return next(e)
  })
}

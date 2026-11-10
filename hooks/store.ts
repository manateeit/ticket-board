// The pane's in-memory state and everything that reads or writes the tickets folder.
import type { AgentInfo, EngineInterface } from 'claude-code'

import { addRow, parseBoard, setCells, type Board, type BoardRow, type Column } from './core/board'
import { DEFAULT_FILTERS, kindOf, nextNumber, slugify, today, type Filters, type Item } from './core/query'
import type { Scheme } from './glass'
import { README_NAMES, hasCode, ideaFile, originUrl, parseGitFile, parseRemote, projectName, type Project, readGitFacts, readmeSummary } from './core/project'
import { bindFromBoard } from './core/roadmap'
import { answerQuestion, parseQuestions, parseTitle, type Question } from './core/ticket'

type $ = EngineInterface

export type TicketFiles = {
  number: string
  folder: string
  rd?: string
  ev?: string
  rdMtime: number
  evMtime: number
  title?: string
  questions: Question[]
}

export type Snapshot = {
  hasBoard: boolean
  boardText: string
  board?: Board
  boardMtime: number
  files: Map<string, TicketFiles>
  loadedAt: number
}

export type View =
  | { kind: 'board' }
  | { kind: 'doc' }
  | { kind: 'ticket'; number: string; tab: 'rd' | 'eval' }
  | { kind: 'questions'; number: string }
  | { kind: 'new' }
  | { kind: 'readme' }
  | { kind: 'start' }

export type Job = { agentId: string; number: string; kind: 'draft' | 'enhance' | 'fold'; startedAt: number }

export type Options = { ticketsDir: string; pollSeconds: number; autoOpen: boolean; writerModel: string }

export type StartFlags = { isGithubSkipped: boolean; isBannerDismissed: boolean }
const NO_START_FLAGS: StartFlags = { isGithubSkipped: false, isBannerDismissed: false }

export const S = {
  options: { ticketsDir: 'tickets', pollSeconds: 3, autoOpen: true, writerModel: '' } as Options,
  cwd: '',
  /** Where tickets/ lives: the main checkout when the session runs in a linked git worktree (agent or EnterWorktree), else cwd. '' until resolved. */
  root: '',
  snap: undefined as Snapshot | undefined,
  view: { kind: 'board' } as View,
  filters: { ...DEFAULT_FILTERS } as Filters,
  page: 0,
  isOpen: false,
  openedByCommand: false,
  jobs: new Map<string, Job>(),
  /** Text the person has typed but not saved yet, by input key. */
  drafts: new Map<string, string>(),
  /** Pending suggestion requests, by question key. */
  suggesting: new Set<string>(),
  message: undefined as { text: string; tone: 'success' | 'error' | 'warning' } | undefined,
  confirm: undefined as string | undefined,
  newMode: 'solo',
  newKind: 'feature',
  overrideTo: '',
  isRefreshing: false,
  /** This session's subagents and teammates, as $.agent.list() last gave them. */
  agents: [] as AgentInfo[],
  showAgents: false,
  /** Recent tool calls per subagent (from the tool.call hook), newest last: what Watch shows in the pane. */
  agentLog: new Map<string, { at: number; tool: string; detail: string }[]>(),
  /** The agent whose activity is open under its row. */
  watching: '',
  /** The main Claude loop: working since (ms), and the tool it is on. */
  busySince: 0,
  busyTool: '',
  /** The project defines a `router` agent (.claude/agents/router.md): run lines ask for it by name. */
  hasRouter: false,
  /** The project and repo this session works in (shown at the top of the pane). */
  project: undefined as Project | undefined,
  /** Desktop pane colors. The app's light/dark mode can't be read, so the person picks; remembered across sessions. */
  scheme: 'auto' as Scheme,
  /** Start screen choices remembered per project: Skip on the GitHub line, the banner dismissed. */
  startFlags: { ...NO_START_FLAGS } as StartFlags,
  /** The person chose the board over the Start screen this session ("Set up board only", "Show the board"). */
  showBoard: false,
}

/** A new session starts clean (the module can outlive one session). */
export function resetSession(cwd: string) {
  Object.assign(S, {
    cwd,
    root: '',
    snap: undefined,
    view: { kind: 'board' },
    filters: { ...DEFAULT_FILTERS },
    page: 0,
    isOpen: false,
    openedByCommand: false,
    message: undefined,
    confirm: undefined,
    newMode: 'solo',
    newKind: 'feature',
    overrideTo: '',
    busySince: 0,
    busyTool: '',
    isRefreshing: false,
    project: undefined,
    startFlags: { ...NO_START_FLAGS },
    showBoard: false,
  })
  S.jobs.clear()
  S.agentLog.clear()
  S.watching = ''
  S.drafts.clear()
  S.suggesting.clear()
}

export const dir = () => S.options.ticketsDir.replace(/\/+$/, '') || 'tickets'
export const boardPath = () => `${dir()}/BOARD.md`
export const abs = (rel: string) => (rel.startsWith('/') ? rel : `${S.root || S.cwd}/${rel}`)

/**
 * A worktree holds the board as it was when its branch was cut, so tickets added since are missing
 * there. The router keeps tickets/BOARD.md in the main checkout: when the session runs in a linked
 * worktree whose main checkout has a board, read and write that one.
 */
export async function resolveRoot($: $): Promise<void> {
  const cwd = S.cwd || '.'
  S.root = cwd
  if ((await readOr($, `${cwd}/.git/HEAD`)) !== undefined) return
  const target = parseGitFile((await readOr($, `${cwd}/.git`)) ?? '')
  if (target === '') return
  const gitDir = target.startsWith('/') ? target : `${cwd}/${target}`
  const common = ((await readOr($, `${gitDir}/commondir`)) ?? '').trim()
  const commonDir = (common === '' ? gitDir.replace(/\/worktrees\/[^/]+\/?$/, '') : common.startsWith('/') ? common : `${gitDir}/${common}`).replace(/\/+$/, '')
  const resolved = commonDir.split('/').reduce<string[]>((acc, part) => (part === '..' ? acc.slice(0, -1) : part === '.' || part === '' ? acc : [...acc, part]), [])
  if (resolved.at(-1) !== '.git') return
  const main = `/${resolved.slice(0, -1).join('/')}`
  if (main !== cwd && (await readOr($, `${main}/${boardPath()}`)) !== undefined) S.root = main
}

export function redraw($: $) {
  // A redraw is best effort: the pane may have closed (or the session ended) meanwhile.
  try {
    void Promise.resolve($.ui.invalidate('ui.render')).catch(() => undefined)
  } catch {
    // ignore
  }
}

export function say($: $, text: string, tone: 'success' | 'error' | 'warning' = 'success') {
  S.message = { text, tone }
  redraw($)
}

async function readOr($: $, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(abs(path))
  } catch {
    return undefined
  }
}

async function listOr($: $, path: string) {
  try {
    return await $.fs.list(abs(path))
  } catch {
    return []
  }
}

/**
 * Design and plan the board is bound to (`Design: … · Plan: …` in BOARD.md), else `design/DESIGN.md`
 * and `design/PLAN.md` in any case. `bindFromBoard` reads synchronously, so the paths it asks for
 * are read first and handed back on a second pass.
 */
async function findDesignAndPlan($: $, boardText: string | undefined): Promise<{ designPath: string; planPath: string }> {
  const wanted: string[] = []
  bindFromBoard(boardText, p => (wanted.push(p), undefined))
  const texts = new Map<string, string>()
  for (const p of wanted) {
    const t = await readOr($, p)
    if (t !== undefined) texts.set(p, t)
  }
  const b = bindFromBoard(boardText, p => texts.get(p))
  return { designPath: b.designPath ?? '', planPath: b.planPath ?? '' }
}

/**
 * Name, repo, branch and README of the folder this session runs in, plus what the Start screen
 * needs: commit presence, design/plan/idea files and whether there is code. Reads files only: no
 * git command or other process.
 */
export async function loadProject($: $, boardText?: string): Promise<Project> {
  const cwd = S.cwd || '.'
  const read = async (path: string) => {
    try {
      return await $.fs.read(path)
    } catch {
      return undefined
    }
  }
  const top = await listOr($, cwd)
  const git = await readGitFacts(cwd, read, top.some(e => e.name === '.git'))
  const config = git.config
  let readmePath = ''
  let readme: string | undefined
  for (const name of README_NAMES) {
    readme = await readOr($, `${cwd}/${name}`)
    if (readme !== undefined) {
      readmePath = `${cwd}/${name}`
      break
    }
  }
  const pkg = await readOr($, `${cwd}/package.json`)
  const remote = parseRemote(config === undefined ? '' : originUrl(config))
  const { designPath, planPath } = await findDesignAndPlan($, boardText)
  const ideaPath = ideaFile(await listOr($, 'design'), await listOr($, 'design/brainstorms'))
  return {
    name: projectName(readme, pkg, cwd),
    folder: cwd,
    repo: remote.repo,
    repoUrl: remote.repoUrl,
    host: remote.host,
    branch: git.branch,
    isGit: git.state !== 'none',
    readmePath,
    readme,
    summary: readmeSummary(readme, pkg),
    git: git.state,
    hasCommit: git.hasCommit,
    designPath,
    planPath,
    ideaPath,
    hasCode: hasCode(top.map(e => e.name), dir()),
  }
}

/** Re-reads what changed since the last snapshot (by modification time). Returns whether anything changed. */
export async function refresh($: $, force = false): Promise<boolean> {
  if (S.isRefreshing) return false
  S.isRefreshing = true
  try {
    if (S.root === '') await resolveRoot($)
    const prev = S.snap
    const entries = await listOr($, dir())
    const boardEntry = entries.find(e => e.name === 'BOARD.md' && e.kind === 'file')
    let changed = force || prev === undefined
    let boardText = prev?.boardText ?? ''
    let board = prev?.board
    const boardMtime = boardEntry?.mtimeMs ?? 0
    if (boardEntry === undefined) {
      if (prev?.hasBoard !== false) changed = true
      boardText = ''
      board = undefined
    } else if (force || prev === undefined || prev.boardMtime !== boardMtime || !prev.hasBoard) {
      boardText = (await readOr($, boardPath())) ?? ''
      board = parseBoard(boardText)
      changed = true
    }
    // Re-read while the project is not fully set up, so the Start screen and banner follow the files
    // Claude writes (git init, design/DESIGN.md, …) without a manual refresh.
    const isSetUp = (p: Project) => p.designPath !== '' && p.planPath !== '' && p.hasCommit && p.repo !== ''
    if (force || prev === undefined || S.project === undefined || changed || !isSetUp(S.project)) {
      const was = JSON.stringify(S.project)
      S.project = await loadProject($, boardEntry === undefined ? undefined : boardText)
      if (JSON.stringify(S.project) !== was) changed = true
    }
    if (force || prev === undefined) S.hasRouter = (await readOr($, abs('.claude/agents/router.md'))) !== undefined
    const files = new Map<string, TicketFiles>()
    const folders = entries.filter(e => e.kind === 'dir' && /^\d{1,5}-/.test(e.name))
    for (const f of folders) {
      const number = f.name.split('-')[0]!.padStart(4, '0')
      const inner = await listOr($, `${dir()}/${f.name}`)
      const rdMtime = inner.find(e => e.name === 'rd.md')?.mtimeMs ?? 0
      const evMtime = inner.find(e => e.name === 'eval.md')?.mtimeMs ?? 0
      const old = prev?.files.get(number)
      if (!force && old !== undefined && old.folder === f.name && old.rdMtime === rdMtime && old.evMtime === evMtime) {
        files.set(number, old)
        continue
      }
      changed = true
      const rd = rdMtime === 0 ? undefined : await readOr($, `${dir()}/${f.name}/rd.md`)
      const ev = evMtime === 0 ? undefined : await readOr($, `${dir()}/${f.name}/eval.md`)
      files.set(number, {
        number,
        folder: f.name,
        rd,
        ev,
        rdMtime,
        evMtime,
        title: rd === undefined ? undefined : parseTitle(rd),
        questions: rd === undefined ? [] : parseQuestions(rd),
      })
    }
    if (prev !== undefined && prev.files.size !== files.size) changed = true
    S.snap = { hasBoard: boardEntry !== undefined, boardText, board, boardMtime, files, loadedAt: Date.now() }
    if (changed) redraw($)
    return changed
  } finally {
    S.isRefreshing = false
  }
}

export function rows(): BoardRow[] {
  return S.snap?.board?.rows ?? []
}

export function rowOf(number: string): BoardRow | undefined {
  return rows().find(r => r.number === number)
}

export function statusOf(number: string): string | undefined {
  return rowOf(number)?.status
}

/** Board rows plus ticket folders that have no row (shown with a warning). */
export function items(): (Item & { isUnlisted: boolean; blockedBy: string[] })[] {
  const files = S.snap?.files ?? new Map<string, TicketFiles>()
  const out = rows().map(r => {
    const f = files.get(r.number)
    return {
      number: r.number,
      title: r.title || f?.title || '(untitled)',
      status: r.status,
      mode: r.mode,
      owner: r.owner,
      notes: r.notes,
      // A finished ticket no longer needs its questions answered.
      openQuestions: r.status === 'done' ? 0 : (f?.questions.filter(q => !q.isResolved).length ?? 0),
      updatedMs: Math.max(f?.rdMtime ?? 0, f?.evMtime ?? 0),
      kind: kindOf(r.title || f?.title || '', f?.rd),
      isUnlisted: false,
      blockedBy: r.blockedBy,
    }
  })
  for (const f of files.values()) {
    if (out.some(i => i.number === f.number)) continue
    out.push({
      number: f.number,
      title: f.title ?? f.folder,
      status: 'unlisted',
      mode: '',
      owner: '',
      notes: 'Folder exists but BOARD.md has no row for it',
      openQuestions: f.questions.filter(q => !q.isResolved).length,
      updatedMs: Math.max(f.rdMtime, f.evMtime),
      kind: kindOf(f.title ?? f.folder, f.rd),
      isUnlisted: true,
      blockedBy: [],
    })
  }
  return out
}

/** Re-reads BOARD.md, applies one row edit and writes it back. Throws with a person-readable message. */
export async function editRow($: $, number: string, changes: Partial<Record<Column, string>>, expectStatus?: string) {
  const text = await $.fs.read(abs(boardPath()))
  const next = setCells(text, number, changes, expectStatus)
  if (next !== text) await $.fs.write(abs(boardPath()), next)
  await refresh($)
}

export async function saveAnswer($: $, number: string, q: Question, answer: string) {
  const f = S.snap?.files.get(number)
  if (f === undefined) throw new Error(`Ticket ${number} has no folder`)
  const path = `${dir()}/${f.folder}/rd.md`
  const text = await $.fs.read(abs(path))
  await $.fs.write(abs(path), answerQuestion(text, q.index, q.text, answer, today(Date.now())))
  await refresh($)
}

export function folderOf(number: string): string | undefined {
  return S.snap?.files.get(number)?.folder
}

/** Reserves the next number: creates the folder with skeleton files and adds a draft row. */
export async function createSkeleton(
  $: $,
  idea: { title: string; text: string; mode: string; blockedBy: string[]; kind?: string },
  notes: string,
): Promise<{ number: string; folder: string }> {
  await refresh($, true)
  const names = [...(S.snap?.files.values() ?? [])].map(f => f.folder)
  const entries = await listOr($, dir())
  const number = nextNumber(
    [...names, ...entries.map(e => e.name)],
    rows().map(r => r.number),
  )
  const folder = `${number}-${slugify(idea.title)}`
  const quoted = idea.text
    .trim()
    .split(/\r?\n/)
    .map(l => `> ${l}`)
    .join('\n')
  const rd = [
    `# ${number} — ${idea.title}`,
    '',
    `Type: ${idea.kind ?? 'feature'}`,
    '',
    '## What',
    '<2–5 sentences: what the feature does and why. Being written by the ticket writer.>',
    '',
    '## Behaviour',
    '- <observable behaviour>',
    '',
    '## Scope',
    'In: <...>',
    'Out: <...>',
    '',
    '## Touchpoints',
    '- <path — why>',
    '',
    '## Docs',
    '- README.md — <section to add or change, or "no change: <why>">',
    '',
    '## Open questions',
    '- <Must be empty before this ticket can be marked ready>',
    '',
    '## Original request',
    quoted,
    '',
  ].join('\n')
  const ev = [
    `# Eval — ${number} — ${idea.title}`,
    '',
    '## Checks',
    '1. <how to run it — pass criterion>',
    '2. Docs and README updated — read the files under ## Docs in rd.md and README.md; pass when they describe the change as built.',
    '',
    '## Not checked by automation',
    '- <...>',
    '',
  ].join('\n')
  await $.fs.write(abs(`${dir()}/${folder}/rd.md`), rd)
  await $.fs.write(abs(`${dir()}/${folder}/eval.md`), ev)
  const text = await $.fs.read(abs(boardPath()))
  await $.fs.write(
    abs(boardPath()),
    addRow(text, { number, title: idea.title, status: 'draft', mode: idea.mode, blockedBy: idea.blockedBy, notes }),
  )
  await refresh($, true)
  return { number, folder }
}

export async function loadFilters($: $) {
  try {
    const saved = (await $.store.get(`filters:${S.cwd}`)) as Partial<Filters> | undefined
    if (saved !== undefined && saved !== null && typeof saved === 'object') S.filters = { ...DEFAULT_FILTERS, ...saved, search: '' }
  } catch {
    // defaults
  }
}

export async function loadStartFlags($: $) {
  try {
    const saved = (await $.store.get(`start:${S.cwd}`)) as Partial<StartFlags> | undefined
    if (saved !== undefined && saved !== null && typeof saved === 'object')
      S.startFlags = { isGithubSkipped: saved.isGithubSkipped === true, isBannerDismissed: saved.isBannerDismissed === true }
  } catch {
    // defaults
  }
}

/** Remembers a Start screen choice for this project (in the pane store, never in the project's files). */
export async function setStartFlag($: $, change: Partial<StartFlags>) {
  S.startFlags = { ...S.startFlags, ...change }
  redraw($)
  try {
    await $.store.set(`start:${S.cwd}`, S.startFlags)
  } catch {
    // a convenience
  }
}

/** A short, human line for one tool call: the file, the command or the pattern it was given. */
export function toolDetail(e: Record<string, unknown>): string {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const path = pick('file_path') || pick('notebook_path') || pick('path')
  const short = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}…` : s)
  if (path !== '') return short(path.replace(`${S.cwd}/`, ''))
  return short((pick('command') || pick('pattern') || pick('query') || pick('url') || pick('description') || pick('prompt')).split('\n')[0]!)
}

export function logAgentTool(agentId: string, e: Record<string, unknown>) {
  const log = S.agentLog.get(agentId) ?? []
  log.push({ at: Date.now(), tool: String(e.tool ?? ''), detail: toolDetail(e) })
  if (log.length > 40) log.splice(0, log.length - 40)
  S.agentLog.set(agentId, log)
}

export async function loadScheme($: $) {
  try {
    const saved = await $.store.get('colors')
    if (saved === 'auto' || saved === 'light' || saved === 'dark') S.scheme = saved
  } catch {
    // default dark
  }
}

export async function setSchemeChoice($: $, scheme: Scheme) {
  S.scheme = scheme
  redraw($)
  try {
    await $.store.set('colors', scheme)
  } catch {
    // a convenience
  }
}

export async function saveFilters($: $) {
  try {
    const { search: _search, ...keep } = S.filters
    await $.store.set(`filters:${S.cwd}`, keep)
  } catch {
    // remembered filters are a convenience
  }
}

export async function loadJobs($: $) {
  try {
    const saved = (await $.store.get(`jobs:${S.cwd}`)) as Job[] | undefined
    if (Array.isArray(saved)) for (const j of saved) if (Date.now() - j.startedAt < 6 * 3600_000) S.jobs.set(j.agentId, j)
  } catch {
    // none
  }
}

export async function saveJobs($: $) {
  try {
    await $.store.set(`jobs:${S.cwd}`, [...S.jobs.values()])
  } catch {
    // best effort
  }
}

export function jobFor(number: string): Job | undefined {
  return [...S.jobs.values()].find(j => j.number === number)
}


const LIVE = new Set(['pending', 'running', 'waiting'])
export const isLive = (a: AgentInfo) => LIVE.has(a.status)

/** Re-reads this session's agents; redraws only when something changed. */
export async function loadAgents($: $): Promise<void> {
  try {
    // A resumed agent can be listed again under the same id: keep the latest entry, so keys stay unique.
    const listed = await $.agent.list()
    const next = listed.filter((a, i) => listed.findLastIndex(b => b.id === a.id) === i)
    const sig = (l: AgentInfo[]) => l.map(a => `${a.id}:${a.status}`).join(',')
    if (sig(next) === sig(S.agents)) return
    S.agents = next
    if (S.isOpen) redraw($)
  } catch {
    // agent.list is unavailable (older Claude Code): the panel just stays empty.
  }
}

/** The ticket an agent works on: one of our writer jobs, or "ticket 0007" / "#0007" / "0007" in its description. */
export function ticketOfAgent(a: AgentInfo): string | undefined {
  const job = S.jobs.get(a.id)
  if (job !== undefined) return job.number
  const m = /(?:ticket\s*#?|#)(\d{1,4})\b/i.exec(a.description) ?? /\b(\d{4})\b/.exec(a.description)
  return m === null ? undefined : m[1]!.padStart(4, '0')
}

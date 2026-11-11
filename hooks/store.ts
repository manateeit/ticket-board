// The pane's in-memory state and everything that reads or writes the tickets folder.
import type { AgentInfo, EngineInterface } from 'claude-code'

import { addRow, parseBoard, setCells, type Board, type BoardRow, type Column } from './core/board'
import { DEFAULT_FILTERS, KIND_OPTIONS, MODE_OPTIONS, SHOW_OPTIONS, SORT_OPTIONS, kindOf, nextNumber, slugify, today, type Filters, type Item } from './core/query'
import { isLightTheme, type Scheme } from './glass'
import { README_NAMES, hasCode, ideaFile, originUrl, parseGitFile, parseRemote, projectName, type Project, readGitFacts, readmeSummary } from './core/project'
import { allBuilds, bindFromBoard, parseProposal, roadmap, setPlanTicket, ticketRef, type Binding, type Proposal, type Roadmap, type TicketRef } from './core/roadmap'
import { answerQuestion, parseQuestions, parseTitle, type Question } from './core/ticket'
import { answerDesignQuestion, approveDesignText } from './core/designfile'

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
  /** The design and plan the board is bound to (texts, when found), read on every refresh. */
  binding?: Binding
  /** File names in `design/changes/` next to the bound DESIGN.md; undefined when there is no such folder. */
  changes?: string[]
  /** The texts of the redesign notes (`<date>-design-vN.md`) and replan proposals (`<date>-replan.md`, 0016) in `changes`, by file name (0015). A listed note that could not be read has no entry. */
  changeNotes?: Record<string, string>
}

export type View =
  | { kind: 'board' }
  | { kind: 'doc' }
  | { kind: 'ticket'; number: string; tab: 'rd' | 'eval'; from?: View }
  | { kind: 'questions'; number: string }
  | { kind: 'new' }
  | { kind: 'readme' }
  | { kind: 'start' }
  /** The roadmap (0007): `focus` is a build id to open and show, `from` the view Back returns to. */
  | { kind: 'plan'; focus?: string; from?: View }
  /** The design (0007): `section` is the D id shown (the first one when absent). */
  | { kind: 'design'; section?: string; from?: View }
  /** The replan review (0016): the newest replan proposal's items to tick and apply. */
  | { kind: 'replan'; from?: View }
  /** Adopt existing docs (0009): the path box, the converting state, then the review of the proposal. */
  | { kind: 'adopt'; from?: View }

export type PlanMode = 'list' | 'timeline'
/** A writer job. `plan` jobs (0008) write a ticket from a plan build: `build` is its id, `extra` a note kept after the AI status. */
export type Job = { agentId: string; number: string; kind: 'draft' | 'enhance' | 'fold' | 'plan'; startedAt: number; build?: string; extra?: string }

/** A plan ticket whose skeleton exists and whose writer waits for a free slot. */
export type PlanQueued = { number: string; folder: string; build: string; brief: string; extra: string }

export type Options = { ticketsDir: string; pollSeconds: number; autoOpen: boolean; writerModel: string; showVersion: boolean }

export type StartFlags = { isGithubSkipped: boolean; isBannerDismissed: boolean }
const NO_START_FLAGS: StartFlags = { isGithubSkipped: false, isBannerDismissed: false }

export const S = {
  options: { ticketsDir: 'tickets', pollSeconds: 3, autoOpen: true, writerModel: '', showVersion: true } as Options,
  /** This plugin's version from its own manifest, read at session start; '' when it could not be read. */
  version: '',
  cwd: '',
  /** Where tickets/ lives: the main checkout when the session runs in a linked git worktree (agent or EnterWorktree), else cwd. '' until resolved. */
  root: '',
  snap: undefined as Snapshot | undefined,
  view: { kind: 'board' } as View,
  filters: { ...DEFAULT_FILTERS } as Filters,
  /** Board: the page of rows shown (terminal: by the pane's height; desktop: when the rows would not fit the drawing, 0022). Any filter or sort change goes back to 0. */
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
  /** Desktop pane colors: follow the app (`auto`), or dark or light glass always; remembered across sessions. */
  scheme: 'auto' as Scheme,
  /** The Claude app is in light mode (its `theme` setting), read at session start and followed on change; dark until known. */
  isAppLight: false,
  /** Start screen choices remembered per project: Skip on the GitHub line, the banner dismissed. */
  startFlags: { ...NO_START_FLAGS } as StartFlags,
  /** The person chose the board over the Start screen this session ("Set up board only", "Show the board"). */
  showBoard: false,
  /** Plan view: List or Timeline, remembered per project. */
  planMode: 'list' as PlanMode,
  /** Plan view of a plan too large to draw whole (0022): the phase shown, '' for the current one; remembered per project. */
  planPhase: '',
  /** Plan view phases the person opened (true) or closed (false) this session; others follow their %. */
  planOpen: new Map<string, boolean>(),
  /** Tickets from the plan (0008) waiting for a writer slot, oldest first. Kept across redraws, not restarts. */
  planQueue: [] as PlanQueued[],
  /** Plan builds whose writer failed: build id → its ticket and the reason. Create again restarts it. */
  planFailed: new Map<string, { number: string; reason: string }>(),
  /** A Create tickets press is making skeletons. */
  isCreating: false,
  /** The planner writing a replan proposal (0016): its agent, the file it may write and PLAN.md's hash when it started. */
  replanJob: undefined as { agentId: string; path: string; hash: string } | undefined,
  /** Replan review: the item indexes ticked this session. Nothing is ticked by default. */
  replanTicks: new Set<number>(),
  /** An Apply or Dismiss on the replan review is running. */
  isApplying: false,
  /** The agent converting existing docs (0009): its agent, the proposal it may write and the source paths. */
  adoptJob: undefined as { agentId: string; path: string; sources: string[] } | undefined,
  /** The adopt proposal under review (newest unapplied `design/changes/<date>-adopt.md`); undefined when none. */
  adoptFile: undefined as { name: string; path: string; text: string } | undefined,
  /** Adopt review: the ids the person unticked. Every section, phase and build starts ticked. */
  adoptOff: new Set<string>(),
  /** Set when Apply found DESIGN.md or PLAN.md already there: the other names offered (the person can edit them). */
  adoptNames: undefined as { design?: string; plan?: string } | undefined,
  /** Adopt review: which file the preview shows, '' for none. */
  adoptPreview: '' as '' | 'design' | 'plan',
  /** README view on the desktop: which part of a long README is shown (see `readmeParts`). */
  readmePart: 0,
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
    // The last session's agents and the panel's open state must not carry over (0012).
    agents: [],
    showAgents: false,
    planMode: 'list',
    planPhase: '',
    planQueue: [],
    isCreating: false,
    replanJob: undefined,
    isApplying: false,
    adoptJob: undefined,
    adoptFile: undefined,
    adoptNames: undefined,
    adoptPreview: '',
    readmePart: 0,
  })
  S.adoptOff.clear()
  S.replanTicks.clear()
  S.planOpen.clear()
  S.planFailed.clear()
  S.jobs.clear()
  S.agentLog.clear()
  S.watching = ''
  S.drafts.clear()
  S.suggesting.clear()
}

/** The board's version label (`ticket-board 0.4.15`), or '' when switched off or the version is unknown. */
export const versionLabel = () => (S.options.showVersion && S.version !== '' ? `ticket-board ${S.version}` : '')

/** Reads `version` from this plugin's own manifest. Any failure leaves it '' (no label), never an error. */
export async function loadVersion($: $): Promise<void> {
  try {
    const m: unknown = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
    const v = typeof m === 'object' && m !== null ? (m as { version?: unknown }).version : undefined
    S.version = typeof v === 'string' && /^[\w.+-]{1,40}$/.test(v.trim()) ? v.trim() : ''
  } catch {
    S.version = ''
  }
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
  const b = await readBinding($, boardText)
  return { designPath: b.designPath ?? '', planPath: b.planPath ?? '' }
}

async function readBinding($: $, boardText: string | undefined): Promise<Binding> {
  const wanted: string[] = []
  bindFromBoard(boardText, p => (wanted.push(p), undefined))
  const texts = new Map<string, string>()
  for (const p of wanted) {
    const t = await readOr($, p)
    if (t !== undefined) texts.set(p, t)
  }
  return bindFromBoard(boardText, p => texts.get(p))
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

/**
 * Follows the session to the folder it runs in now. The desktop app can start a session in a spare
 * folder (`~/.claude/spares/…`) and move it to the project afterwards, after `session.start` ran, and
 * `/cd` or a worktree move does the same. Without this the board keeps reading the first folder:
 * an empty board and "not a git repository" in a project that has both. Returns whether it moved.
 */
export async function followCwd($: $): Promise<boolean> {
  let now: unknown
  try {
    now = await $.session.cwd()
  } catch {
    return false
  }
  if (typeof now !== 'string' || now === '' || now === S.cwd) return false
  Object.assign(S, {
    cwd: now,
    root: '',
    snap: undefined,
    project: undefined,
    filters: { ...DEFAULT_FILTERS },
    startFlags: { ...NO_START_FLAGS },
    planMode: 'list',
    planPhase: '',
    page: 0,
  })
  S.jobs.clear()
  await loadFilters($)
  await loadStartFlags($)
  await loadPlanMode($)
  await loadJobs($)
  return true
}

/** Re-reads what changed since the last snapshot (by modification time). Returns whether anything changed. */
export async function refresh($: $, force = false): Promise<boolean> {
  if (S.isRefreshing) return false
  S.isRefreshing = true
  try {
    if (await followCwd($)) force = true
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
    const binding = boardEntry === undefined ? undefined : await readBinding($, boardText)
    if (JSON.stringify(binding) !== JSON.stringify(prev?.binding)) changed = true
    const changes = binding?.designPath === undefined ? undefined : await listChanges($, binding.designPath)
    if (JSON.stringify(changes) !== JSON.stringify(prev?.changes)) changed = true
    const changeNotes = binding?.designPath === undefined || changes === undefined ? undefined : await readChangeNotes($, binding.designPath, changes)
    if (JSON.stringify(changeNotes) !== JSON.stringify(prev?.changeNotes)) changed = true
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
    S.snap = { hasBoard: boardEntry !== undefined, boardText, board, boardMtime, files, loadedAt: Date.now(), binding, changes, ...(changeNotes === undefined ? {} : { changeNotes }) }
    if (changed) redraw($)
    return changed
  } finally {
    S.isRefreshing = false
  }
}

export const changesFolder = (designPath: string) => `${designPath.includes('/') ? designPath.slice(0, designPath.lastIndexOf('/')) : '.'}/changes`

/**
 * The redesign notes among `names` (`<date>-design-vN.md`), read: the History shows the sections
 * each one changed. The replan proposals (`<date>-replan.md`) too: the replan review reads them (0016).
 */
async function readChangeNotes($: $, designPath: string, names: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const name of names.filter(n => /(design-v\d+|replan)\.md$/i.test(n))) {
    const text = await readOr($, `${changesFolder(designPath)}/${name}`)
    if (text !== undefined) out[name] = text
  }
  return out
}

/** The `changes/` folder beside DESIGN.md (design/changes/): its .md names, or undefined when it does not exist or is empty. */
async function listChanges($: $, designPath: string): Promise<string[] | undefined> {
  const folder = changesFolder(designPath)
  try {
    const entries = await $.fs.list(abs(folder))
    const names = entries.filter(e => e.kind === 'file' && /\.md$/i.test(e.name)).map(e => e.name).sort()
    return names.length === 0 ? undefined : names
  } catch {
    return undefined
  }
}

/** The newest replan proposal next to the bound design (0016). `text` is undefined when the file could not be read. */
export type LatestProposal = { name: string; path: string; text?: string; proposal?: Proposal }

export function latestProposal(): LatestProposal | undefined {
  const snap = S.snap
  const designPath = snap?.binding?.designPath
  if (snap?.changes === undefined || designPath === undefined) return undefined
  const name = snap.changes.filter(n => /replan\.md$/i.test(n)).at(-1)
  if (name === undefined) return undefined
  const path = `${changesFolder(designPath)}/${name}`
  const text = snap.changeNotes?.[name]
  return text === undefined ? { name, path } : { name, path, text, proposal: parseProposal(text, name) }
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

export type RoadmapView = {
  /** Set when a plan is bound and has at least one phase or build. */
  rm?: Roadmap
  /** One short line when the plan is named or present but could not be used; the board then shows as with no plan. */
  warning?: string
  designPath: string
  planPath: string
  /** Ticket number → its `Plan:` / `Design:` lines as the roadmap read them. */
  refs: Map<string, TicketRef>
  /** Ticket number → phase id of the build it is linked to (`P2`); '' when off-plan. */
  phaseOf: Map<string, string>
}

let roadmapMemo: { snap?: Snapshot; value?: RoadmapView } = {}

/** A plan without phase headings has one phase with id ''; the board shows it as "Plan". */
export const phaseName = (id: string) => (id === '' ? 'Plan' : id)

/**
 * The board's roadmap, from the design and plan it is bound to, computed by hooks/core/roadmap.ts.
 * Undefined when there is no plan at all. Never throws: a plan that cannot be used gives a warning.
 */
export function roadmapView(): RoadmapView | undefined {
  const snap = S.snap
  if (snap === undefined) return undefined
  if (roadmapMemo.snap === snap) return roadmapMemo.value
  let value: RoadmapView | undefined
  try {
    value = computeRoadmap(snap)
  } catch (e) {
    value = { warning: `Could not read the plan: ${(e as Error).message}`, designPath: '', planPath: '', refs: new Map(), phaseOf: new Map() }
  }
  roadmapMemo = { snap, value }
  return value
}

let fullMemo: { snap?: Snapshot; value?: Roadmap } = {}

/**
 * The bound design and plan computed together, also when only one of them exists (the Design view
 * works without a plan). Undefined with no board binding or neither file. Never throws.
 */
export function fullRoadmap(): Roadmap | undefined {
  const snap = S.snap
  const b = snap?.binding
  if (snap === undefined || b === undefined || (b.design === undefined && b.plan === undefined)) return undefined
  if (fullMemo.snap === snap) return fullMemo.value
  let value: Roadmap | undefined
  try {
    value = roadmap(b.design, b.plan, ticketRefs(snap))
  } catch {
    value = undefined
  }
  fullMemo = { snap, value }
  return value
}

function ticketRefs(snap: Snapshot): TicketRef[] {
  const listed = new Set(rows().map(r => r.number))
  return [
    ...rows().map(r => ticketRef(r, snap.files.get(r.number)?.rd)),
    ...[...snap.files.values()].filter(f => !listed.has(f.number)).map(f => ticketRef({ number: f.number, status: 'unlisted' }, f.rd)),
  ]
}

function computeRoadmap(snap: Snapshot): RoadmapView | undefined {
  const b = snap.binding
  if (b === undefined) return undefined
  const base = { designPath: b.designPath ?? '', planPath: b.planPath ?? '', refs: new Map<string, TicketRef>(), phaseOf: new Map<string, string>() }
  if (b.plan === undefined) {
    const w = b.warnings.find(x => x.startsWith('plan'))
    return w === undefined ? undefined : { ...base, warning: `${w}; showing tickets only` }
  }
  if (b.plan.trim() === '') return undefined
  const tickets = ticketRefs(snap)
  const rm = roadmap(b.design, b.plan, tickets)
  if (rm.plan.phases.length === 0) return { ...base, warning: `${base.planPath} has no phases or builds the board can read; showing tickets only` }
  const builds = allBuilds(rm.plan)
  for (const t of tickets) {
    base.refs.set(t.number, t)
    const linked = builds.find(x => (rm.links.byBuild[x.id] ?? []).some(r => r.number === t.number))
    const phase = linked !== undefined ? phaseName(linked.phase) : t.plan === undefined ? '' : (/^([A-Za-z]+\d+)\./.exec(t.plan)?.[1] ?? t.plan)
    base.phaseOf.set(t.number, phase)
  }
  return { ...base, rm }
}

/** Board rows plus ticket folders that have no row (shown with a warning). */
export function items(): (Item & { isUnlisted: boolean; blockedBy: string[] })[] {
  const files = S.snap?.files ?? new Map<string, TicketFiles>()
  const rv = roadmapView()
  const phaseOf = (n: string) => (rv?.rm === undefined ? undefined : (rv.phaseOf.get(n) ?? ''))
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
      phase: phaseOf(r.number),
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
      phase: phaseOf(f.number),
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

/** Answers one open question of a design section in DESIGN.md (the only file written). */
export async function saveDesignAnswer($: $, sectionId: string, question: string, answer: string) {
  const path = S.snap?.binding?.designPath
  if (path === undefined) throw new Error('No DESIGN.md is bound to this board')
  const text = await $.fs.read(abs(path))
  await $.fs.write(abs(path), answerDesignQuestion(text, sectionId, question, answer, today(Date.now())))
  await refresh($, true)
}

/** Sets `status: approved` in DESIGN.md: a person's action, never an agent's. Writes only DESIGN.md. */
export async function approveDesign($: $) {
  const path = S.snap?.binding?.designPath
  if (path === undefined) throw new Error('No DESIGN.md is bound to this board')
  const text = await $.fs.read(abs(path))
  await $.fs.write(abs(path), approveDesignText(text, today(Date.now())))
  await refresh($, true)
}

export async function loadPlanMode($: $) {
  try {
    const saved = await $.store.get(`plan-mode:${S.cwd}`)
    if (saved === 'list' || saved === 'timeline') S.planMode = saved
  } catch {
    // default list
  }
  try {
    const phase = await $.store.get(`plan-phase:${S.cwd}`)
    if (typeof phase === 'string') S.planPhase = phase
  } catch {
    // default: the current phase
  }
}

/** The phase a large plan shows (0022), remembered per project (in the pane store). */
export async function setPlanPhase($: $, phase: string) {
  S.planPhase = phase
  redraw($)
  try {
    await $.store.set(`plan-phase:${S.cwd}`, phase)
  } catch {
    // a convenience
  }
}

/** List or Timeline in the Plan view, remembered per project (in the pane store). */
export async function setPlanMode($: $, mode: PlanMode) {
  S.planMode = mode
  redraw($)
  try {
    await $.store.set(`plan-mode:${S.cwd}`, mode)
  } catch {
    // a convenience
  }
}

export function folderOf(number: string): string | undefined {
  return S.snap?.files.get(number)?.folder
}

/** Reserves the next number: creates the folder with skeleton files and adds a draft row. */
export async function createSkeleton(
  $: $,
  idea: {
    title: string
    text: string
    mode: string
    blockedBy: string[]
    kind?: string
    /** From a plan build (0008): its id for the `Plan:` line, the `Design:` value and the covered `Done when` lines as eval checks. */
    plan?: string
    design?: string
    checks?: string[]
  },
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
    ...(idea.plan === undefined ? [] : [`Plan: ${idea.plan}`]),
    ...(idea.design === undefined || idea.design === '' ? [] : [`Design: ${idea.design}`]),
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
  const checks = idea.checks ?? []
  const ev = [
    `# Eval — ${number} — ${idea.title}`,
    '',
    '## Checks',
    ...(checks.length === 0
      ? ['1. <how to run it — pass criterion>']
      : checks.flatMap((c, i) => [`${i + 1}. ${c}`, '   - Run: <command — the ticket writer fills this in>', `   - Pass: ${c}`])),
    `${Math.max(checks.length, 1) + 1}. Docs and README updated — read the files under ## Docs in rd.md and README.md; pass when they describe the change as built.`,
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

/** Writes `tickets/BOARD.md` from the plugin's template (and `TEMPLATE/rd.md`, `eval.md` when missing). Throws on a failed write. */
export async function createBoardFiles($: $): Promise<void> {
  const root = $.plugin.root
  await $.fs.write(abs(boardPath()), await $.fs.read(abs(`${root}/templates/BOARD.md`)))
  for (const f of ['rd.md', 'eval.md']) {
    const path = `${dir()}/TEMPLATE/${f}`
    if (!(await $.fs.exists(abs(path)))) await $.fs.write(abs(path), await $.fs.read(abs(`${root}/skills/ticket/TEMPLATE/${f}`)))
  }
}

/** Adds a new ticket's number to its build's `Ticket` cell in the bound PLAN.md. Only the pane writes PLAN.md. */
export async function addPlanTicket($: $, buildId: string, number: string): Promise<void> {
  const path = S.snap?.binding?.planPath
  if (path === undefined) throw new Error('No PLAN.md is bound to this board')
  const text = await $.fs.read(abs(path))
  const next = setPlanTicket(text, buildId, number)
  if (next !== text) await $.fs.write(abs(path), next)
}

/** Saved filters, each field kept only when it is one the pane knows; anything else (an old or bad value) is the default. */
export function filtersFrom(saved: Record<string, unknown>): Filters {
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback)
  const d = DEFAULT_FILTERS
  return {
    show: pick(saved.show, SHOW_OPTIONS, d.show),
    sort: pick(saved.sort, SORT_OPTIONS, d.sort),
    mode: pick(saved.mode, MODE_OPTIONS, d.mode),
    kind: pick(saved.kind, KIND_OPTIONS, d.kind),
    desc: saved.desc === true,
    hideDone: saved.hideDone === true,
    phase: typeof saved.phase === 'string' && saved.phase !== '' ? saved.phase : d.phase,
    search: '',
  }
}

export async function loadFilters($: $) {
  try {
    const saved = await $.store.get(`filters:${S.cwd}`)
    if (saved !== undefined && saved !== null && typeof saved === 'object') S.filters = filtersFrom(saved as Record<string, unknown>)
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
    // default: follow the app
  }
}

/** Reads the Claude app's light or dark mode from its `theme` setting; unreadable means dark. */
export async function loadAppTheme($: $) {
  try {
    const rows = await $.config.list()
    S.isAppLight = isLightTheme(rows.find(row => row.key === 'theme')?.value)
  } catch {
    S.isAppLight = false
  }
}

/** The app's theme changed (`config.set` on `theme`): redraw when its light/dark mode did. */
export function followAppTheme($: $, value: unknown) {
  const isLight = isLightTheme(value)
  if (isLight === S.isAppLight) return
  S.isAppLight = isLight
  redraw($)
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
    if (Array.isArray(saved))
      for (const j of saved as unknown[]) {
        const job = j as Partial<Job> | null
        const ok = typeof job === 'object' && job !== null && typeof job.agentId === 'string' && typeof job.number === 'string' && typeof job.startedAt === 'number' && typeof job.kind === 'string'
        if (ok && Date.now() - job.startedAt! < 6 * 3600_000) S.jobs.set(job.agentId!, job as Job)
      }
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

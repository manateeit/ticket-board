// The roadmap: DESIGN.md and PLAN.md (format in docs/STANDARD.md) joined to the board's tickets.
// Pure functions, no tokens: everything is recomputed from the file texts on every refresh.
// Only `bindFromBoard` reads files, through the reader callback it is given.
// The rules are PLAN-design-plan.md sections 3 and 4.

import { cells, isTableLine, replaceCell, type BoardRow } from './board'
import { parseDesignRefs, parsePlanRef, parseQuestions, type DesignRef } from './ticket'

// ── Design ────────────────────────────────────────────────────────────────

export type DesignQuestion = { text: string; isResolved: boolean }

export type DesignSection = {
  /** `D3`, always upper case. */
  id: string
  title: string
  /** 1 when the section has no `Rev:` line. */
  rev: number
  why: string
  what: string
  doneWhen: string[]
  questions: DesignQuestion[]
  isDropped: boolean
}

export type Design = {
  name: string
  version: number | undefined
  status: string
  updated: string
  /** Numbered sections only; unnumbered ones (Vision, Non-goals…) are context. */
  sections: DesignSection[]
  warnings: string[]
}

type FrontMatter = { values: Record<string, string>; body: string[] }

/** `---` front matter: `key: value  # comment` lines. */
function frontMatter(lines: string[]): FrontMatter {
  const values: Record<string, string> = {}
  let i = 0
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++
  if ((lines[i] ?? '').trim() !== '---') return { values, body: lines }
  const close = lines.findIndex((l, j) => j > i && l.trim() === '---')
  if (close === -1) return { values, body: lines }
  for (const line of lines.slice(i + 1, close)) {
    const m = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line)
    if (m !== null) values[m[1]!.toLowerCase()] = m[2]!.replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '').trim()
  }
  return { values, body: lines.slice(close + 1) }
}

const intOf = (v: string | undefined): number | undefined => {
  const m = /^\s*(\d+)/.exec(v ?? '')
  return m === null ? undefined : Number(m[1])
}

const firstHeading = (lines: string[]) => /^#\s+(.+?)\s*$/.exec(lines.find(l => /^#\s/.test(l)) ?? '')?.[1]

/** `## D3 · Title`, `## d3 — Title`, `## D3: Title`, `## D7 · ~~Title~~`, `## ~~D7 · Title~~`. */
const D_HEADING = /^##\s+(?:~~\s*)?D(\d+)\s*(?:~~\s*)?[·—–:]\s*(.*?)\s*$/i
const P_HEADING = /^##\s+(?:~~\s*)?P(\d+)\s*(?:~~\s*)?[·—–:]\s*(.*?)\s*$/i

function splitH2(lines: string[]): { head: string; body: string[] }[] {
  const out: { head: string; body: string[] }[] = []
  for (const line of lines) {
    if (/^##\s/.test(line)) out.push({ head: line, body: [] })
    else out[out.length - 1]?.body.push(line)
  }
  return out
}

const FIELD = /^\s*(?:\*\*)?(rev|status|why|what|done when|goal|appetite|exit)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*?)\s*$/i

function parseSection(id: string, rawTitle: string, heading: string, body: string[], warnings: string[]): DesignSection {
  const sec: DesignSection = {
    id,
    title: rawTitle.replace(/~~/g, '').trim(),
    rev: 1,
    why: '',
    what: '',
    doneWhen: [],
    questions: [],
    isDropped: heading.includes('~~'),
  }
  let field = ''
  let qStart = -1
  body.forEach((line, i) => {
    if (qStart !== -1) return
    if (/^###\s/.test(line)) {
      if (/^###\s+open questions/i.test(line)) qStart = i
      else field = ''
      return
    }
    const m = FIELD.exec(line)
    if (m !== null) {
      field = m[1]!.toLowerCase()
      const v = m[2]!
      if (field === 'rev') {
        const n = intOf(v)
        if (n === undefined) warnings.push(`${id}: Rev "${v}" is not a number`)
        else sec.rev = n
      } else if (field === 'status' && /^dropped\b/i.test(v)) sec.isDropped = true
      else if (field === 'why') sec.why = v
      else if (field === 'what') sec.what = v
      return
    }
    const t = line.trim()
    if (t === '') return
    if (field === 'done when') {
      const b = /^[-*]\s+(.*)$/.exec(t) ?? /^\d+[.)]\s+(.*)$/.exec(t)
      if (b !== null) sec.doneWhen.push(b[1]!.trim())
    } else if (field === 'what') sec.what = `${sec.what} ${t}`.trim()
    else if (field === 'why') sec.why = `${sec.why} ${t}`.trim()
  })
  if (qStart !== -1) {
    const qs = parseQuestions(['## Open questions', ...body.slice(qStart + 1)].join('\n'))
    for (const q of qs) {
      const text = q.text.replace(/^\[[ xX]\]\s*/, '').trim()
      if (text === '' || /^<.*>$/.test(text) || /^none\b/i.test(text)) continue
      sec.questions.push({ text, isResolved: q.isResolved })
    }
  }
  return sec
}

/** Reads DESIGN.md. Never throws: what parsed is returned, with warnings for the rest. */
export function parseDesign(md: string | undefined): Design {
  const design: Design = { name: '', version: undefined, status: '', updated: '', sections: [], warnings: [] }
  if (md === undefined || md.trim() === '') return design
  try {
    const { values, body } = frontMatter(md.split(/\r?\n/))
    if (Object.keys(values).length === 0) design.warnings.push('design: no front matter')
    design.name = values.design ?? firstHeading(body)?.replace(/:\s*design$/i, '') ?? ''
    design.version = intOf(values.version)
    if (values.version !== undefined && design.version === undefined) design.warnings.push(`design: version "${values.version}" is not a number`)
    design.status = (values.status ?? '').toLowerCase()
    design.updated = values.updated ?? ''
    for (const { head, body: lines } of splitH2(body)) {
      const m = D_HEADING.exec(head)
      if (m === null) continue
      const id = `D${Number(m[1])}`
      if (design.sections.some(s => s.id === id)) {
        design.warnings.push(`${id}: used twice; the second one is ignored`)
        continue
      }
      design.sections.push(parseSection(id, m[2]!, head, lines, design.warnings))
    }
  } catch (e) {
    design.warnings.push(`design: ${(e as Error).message}`)
  }
  return design
}

// ── Plan ──────────────────────────────────────────────────────────────────

export type Size = 'S' | 'M' | 'L' | ''

export type Build = {
  /** `P1.3`, `F4`: any letter prefix, upper case. */
  id: string
  phase: string
  name: string
  size: Size
  /** Build ids this one needs first. */
  needs: string[]
  /** Needs that are not build ids (`GitHub origin`); shown, not computed. */
  needsOther: string[]
  /** D ids, upper case. */
  covers: string[]
  doneWhen: string
  /** Ticket numbers from the `Ticket` cell, 4 digits. */
  tickets: string[]
  status: '' | 'deferred' | 'dropped'
}

/** A table row that is not a build (`— | **Self-hosting point.** …`): kept for display, never counted. */
export type Marker = { phase: string; name: string; needs: string[]; needsOther: string[]; doneWhen: string }

export type Phase = {
  /** `P1`; '' for the implicit phase of a plan without phase headings. */
  id: string
  title: string
  goal: string
  appetite: string
  exit: string
  isImplicit: boolean
  builds: Build[]
  markers: Marker[]
}

export type Plan = {
  name: string
  designVersion: number | undefined
  updated: string
  phases: Phase[]
  warnings: string[]
}

type BuildColumn = 'id' | 'name' | 'size' | 'needs' | 'covers' | 'doneWhen' | 'tickets' | 'status'

const PLAN_HEADERS: Record<string, BuildColumn> = {
  '#': 'id',
  'id': 'id',
  'build': 'name',
  'size': 'size',
  'needs': 'needs',
  'covers': 'covers',
  'done when': 'doneWhen',
  'ticket': 'tickets',
  'tickets': 'tickets',
  'status': 'status',
}

const BUILD_ID = /^[A-Za-z]+\d+(?:\.\d+)*$/
const NONE = /^(—|–|-+|none|n\/a)?$/i

const stripMd = (s: string) => s.replace(/\*\*|`|~~/g, '').trim()

function splitNeeds(raw: string): { needs: string[]; needsOther: string[] } {
  const needs: string[] = []
  const needsOther: string[] = []
  if (NONE.test(raw.trim())) return { needs, needsOther }
  for (const part of raw.split(/[,;]/)) {
    const t = stripMd(part)
    if (t === '' || NONE.test(t)) continue
    if (BUILD_ID.test(t)) needs.push(t.toUpperCase())
    else needsOther.push(t)
  }
  return { needs, needsOther }
}

/** Reads PLAN.md. A plan with no phase headings is one implicit phase. Never throws. */
export function parsePlan(md: string | undefined): Plan {
  const plan: Plan = { name: '', designVersion: undefined, updated: '', phases: [], warnings: [] }
  if (md === undefined || md.trim() === '') return plan
  try {
    const { values, body } = frontMatter(md.split(/\r?\n/))
    plan.name = values.plan ?? firstHeading(body)?.replace(/:\s*(build\s+)?plan$/i, '') ?? ''
    plan.designVersion = intOf(values['design-version'])
    plan.updated = values.updated ?? values.date ?? ''
    const seen = new Set<string>()
    let phase: Phase | undefined
    const implicit = (): Phase => {
      const p: Phase = { id: '', title: plan.name, goal: '', appetite: '', exit: '', isImplicit: true, builds: [], markers: [] }
      plan.phases.unshift(p)
      return p
    }
    for (let i = 0; i < body.length; i++) {
      const line = body[i] ?? ''
      if (/^##\s/.test(line)) {
        const m = P_HEADING.exec(line)
        if (m !== null) {
          phase = { id: `P${Number(m[1])}`, title: stripMd(m[2]!), goal: '', appetite: '', exit: '', isImplicit: false, builds: [], markers: [] }
          if (plan.phases.some(p => p.id === phase!.id)) plan.warnings.push(`${phase.id}: phase used twice`)
          plan.phases.push(phase)
        }
        continue
      }
      const f = FIELD.exec(line)
      if (f !== null && phase !== undefined && !phase.isImplicit) {
        const k = f[1]!.toLowerCase()
        if (k === 'goal') phase.goal = f[2]!
        else if (k === 'appetite') phase.appetite = f[2]!
        else if (k === 'exit') phase.exit = f[2]!
        continue
      }
      if (!isTableLine(line)) continue
      const head = cells(line).map(c => stripMd(c).toLowerCase())
      const cols: Partial<Record<BuildColumn, number>> = {}
      head.forEach((h, idx) => {
        const c = PLAN_HEADERS[h]
        if (c !== undefined && cols[c] === undefined) cols[c] = idx
      })
      // Skip any table that is not a build table, to its end.
      if (cols.id === undefined || cols.name === undefined) {
        while (i + 1 < body.length && isTableLine(body[i + 1] ?? '')) i++
        continue
      }
      const into = phase ?? implicit()
      phase = into
      let j = i + 1
      if (/^\s*\|[\s:|-]+\|\s*$/.test(body[j] ?? '')) j++
      for (; j < body.length && isTableLine(body[j] ?? ''); j++) {
        const c = cells(body[j]!)
        const get = (col: BuildColumn) => (cols[col] === undefined ? '' : (c[cols[col]!] ?? ''))
        const id = stripMd(get('id'))
        const { needs, needsOther } = splitNeeds(get('needs'))
        if (!BUILD_ID.test(id)) {
          into.markers.push({ phase: into.id, name: stripMd(get('name')), needs, needsOther, doneWhen: get('doneWhen') })
          continue
        }
        const bid = id.toUpperCase()
        if (seen.has(bid)) {
          plan.warnings.push(`${bid}: build id used twice; the second one is ignored`)
          continue
        }
        seen.add(bid)
        const sizeRaw = stripMd(get('size')).toUpperCase()
        const size: Size = sizeRaw === 'S' || sizeRaw === 'M' || sizeRaw === 'L' ? sizeRaw : ''
        if (size === '' && !NONE.test(sizeRaw)) plan.warnings.push(`${bid}: size "${sizeRaw}" is not S, M or L; counted as unsized`)
        const statusRaw = stripMd(get('status')).toLowerCase()
        const status = statusRaw === 'deferred' || statusRaw === 'dropped' ? statusRaw : ''
        if (status === '' && !NONE.test(statusRaw)) plan.warnings.push(`${bid}: status "${statusRaw}" ignored (only deferred or dropped)`)
        into.builds.push({
          id: bid,
          phase: into.id,
          name: stripMd(get('name')),
          size,
          needs,
          needsOther,
          covers: [...new Set((get('covers').match(/\bD\d+\b/gi) ?? []).map(d => `D${Number(d.slice(1))}`))],
          doneWhen: get('doneWhen'),
          tickets: [...new Set((get('tickets').match(/\d{1,5}/g) ?? []).map(n => n.padStart(4, '0')))],
          status,
        })
      }
      i = j - 1
    }
  } catch (e) {
    plan.warnings.push(`plan: ${(e as Error).message}`)
  }
  return plan
}

export const allBuilds = (plan: Plan): Build[] => plan.phases.flatMap(p => p.builds)

const isCounted = (b: Build) => b.status === ''

// ── Binding ───────────────────────────────────────────────────────────────

export type Binding = {
  designPath: string | undefined
  planPath: string | undefined
  /** File texts, when found. */
  design: string | undefined
  plan: string | undefined
  /** BOARD.md has a `Design: … · Plan: …` line. */
  isBound: boolean
  /** No design and no plan: a blank project (not an error). */
  isBlank: boolean
  warnings: string[]
}

export const DEFAULT_DESIGN = 'design/DESIGN.md'
export const DEFAULT_PLAN = 'design/PLAN.md'

/** The path as written, then with the file name in lower case, then upper case (`.md` kept). */
function caseVariants(path: string): string[] {
  const slash = path.lastIndexOf('/')
  const dir = path.slice(0, slash + 1)
  const file = path.slice(slash + 1)
  const dot = file.lastIndexOf('.')
  const stem = dot > 0 ? file.slice(0, dot) : file
  const ext = dot > 0 ? file.slice(dot) : ''
  return [...new Set([path, dir + file.toLowerCase(), dir + stem.toUpperCase() + ext.toLowerCase(), dir + stem.toUpperCase() + ext])]
}

/** The `Design: <path> · Plan: <path>` line under the BOARD.md title (either half may be missing). */
export function parseBindingLine(boardText: string | undefined): { design?: string; plan?: string } | undefined {
  if (boardText === undefined) return undefined
  for (const line of boardText.split(/\r?\n/)) {
    if (isTableLine(line)) break
    if (!/^\s*(?:\*\*)?(design|plan)(?:\*\*)?\s*:/i.test(line)) continue
    const out: { design?: string; plan?: string } = {}
    for (const part of line.split(/\s[·•|]\s/)) {
      const m = /^\s*(?:\*\*)?(design|plan)(?:\*\*)?\s*:\s*(.+?)\s*$/i.exec(part)
      if (m === null) continue
      const path = m[2]!.replace(/^[`<]|[`>]$/g, '').replace(/^\.\//, '').trim()
      if (path !== '' && !NONE.test(path)) out[m[1]!.toLowerCase() as 'design' | 'plan'] = path
    }
    if (out.design !== undefined || out.plan !== undefined) return out
  }
  return undefined
}

/**
 * Which design and plan files the board is bound to. `readFile` gets a path relative to the
 * project root and returns the text, or `undefined` when there is no such file.
 */
export function bindFromBoard(boardText: string | undefined, readFile: (path: string) => string | undefined): Binding {
  const warnings: string[] = []
  const read = (path: string): string | undefined => {
    try {
      return readFile(path)
    } catch {
      return undefined
    }
  }
  const resolve = (path: string | undefined, what: string, warnMissing: boolean) => {
    if (path === undefined) return { path: undefined, text: undefined }
    for (const p of caseVariants(path)) {
      const text = read(p)
      if (text !== undefined) return { path: p, text }
    }
    if (warnMissing) warnings.push(`${what} file ${path} named in BOARD.md was not found`)
    return { path: undefined, text: undefined }
  }
  const line = parseBindingLine(boardText)
  const d = line === undefined ? resolve(DEFAULT_DESIGN, 'design', false) : resolve(line.design, 'design', true)
  const p = line === undefined ? resolve(DEFAULT_PLAN, 'plan', false) : resolve(line.plan, 'plan', true)
  return {
    designPath: d.path,
    planPath: p.path,
    design: d.text,
    plan: p.text,
    isBound: line !== undefined,
    isBlank: d.text === undefined && p.text === undefined,
    warnings,
  }
}

// ── Tickets ───────────────────────────────────────────────────────────────

export type TicketRef = {
  number: string
  status: string
  /** The rd.md `Plan:` build id; undefined means off-plan. */
  plan: string | undefined
  design: DesignRef[]
}

/** A board row plus its rd.md (when read) as the roadmap sees it. */
export function ticketRef(row: Pick<BoardRow, 'number' | 'status'>, rd: string | undefined): TicketRef {
  return {
    number: row.number,
    status: row.status.toLowerCase(),
    plan: rd === undefined ? undefined : parsePlanRef(rd),
    design: rd === undefined ? [] : parseDesignRefs(rd),
  }
}

export type StaleRef = { ticket: string; section: string; rev: number; now: number }

export type Links = {
  /** Build id → its tickets (from the plan's Ticket cell or the ticket's `Plan:` line). */
  byBuild: Record<string, TicketRef[]>
  /** Tickets whose `Plan:` names a build the plan does not have. */
  missing: { ticket: string; build: string }[]
  /** Ticket listed in one build's Ticket cell while its `Plan:` line names another. */
  mismatched: { ticket: string; cell: string; line: string }[]
  /** No `Plan:` line and not listed in any Ticket cell. */
  offPlan: TicketRef[]
  /** `Design:` references written against an older Rev than the section has now. */
  stale: StaleRef[]
}

/** Attaches each ticket to its build; either link (Ticket cell or `Plan:` line) counts. */
export function linkTickets(plan: Plan, design: Design, tickets: readonly TicketRef[]): Links {
  const builds = allBuilds(plan)
  const ids = new Set(builds.map(b => b.id))
  const byBuild: Record<string, TicketRef[]> = {}
  for (const b of builds) byBuild[b.id] = []
  const byNumber = new Map(tickets.map(t => [t.number, t]))
  const inCell = new Map<string, string>()
  for (const b of builds)
    for (const n of b.tickets) {
      const t = byNumber.get(n)
      if (t === undefined) continue
      if (!inCell.has(n)) inCell.set(n, b.id)
      if (!byBuild[b.id]!.includes(t)) byBuild[b.id]!.push(t)
    }
  const links: Links = { byBuild, missing: [], mismatched: [], offPlan: [], stale: [] }
  for (const t of tickets) {
    if (t.plan === undefined) {
      if (!inCell.has(t.number)) links.offPlan.push(t)
    } else if (!ids.has(t.plan)) links.missing.push({ ticket: t.number, build: t.plan })
    else if (!byBuild[t.plan]!.includes(t)) byBuild[t.plan]!.push(t)
    const cell = inCell.get(t.number)
    if (t.plan !== undefined && cell !== undefined && cell !== t.plan) links.mismatched.push({ ticket: t.number, cell, line: t.plan })
    for (const r of t.design) {
      const sec = design.sections.find(s => s.id === r.id)
      if (sec !== undefined && !sec.isDropped && r.rev !== undefined && r.rev < sec.rev)
        links.stale.push({ ticket: t.number, section: sec.id, rev: r.rev, now: sec.rev })
    }
  }
  for (const list of Object.values(byBuild)) list.sort((a, b) => a.number.localeCompare(b.number))
  return links
}

// ── Progress ──────────────────────────────────────────────────────────────

export type BuildState = 'not-started' | 'shaping' | 'queued' | 'building' | 'built' | 'stuck' | 'deferred' | 'dropped'

export const WEIGHTS: Record<Size, number> = { S: 1, M: 3, L: 8, '': 3 }

export const weightOf = (b: Pick<Build, 'size'>) => WEIGHTS[b.size]

const READY_OR_LATER = new Set(['ready', 'in-progress', 'in-check', 'done', 'blocked'])

/** A build's state from its tickets. Tickets with a status the board does not know are ignored. */
export function buildState(build: Build, tickets: readonly TicketRef[]): BuildState {
  if (build.status !== '') return build.status
  const st = tickets.map(t => t.status).filter(s => ['draft', 'ready', 'in-progress', 'in-check', 'done', 'blocked'].includes(s))
  if (st.length === 0) return 'not-started'
  if (st.includes('blocked')) return 'stuck'
  if (st.includes('draft')) return 'shaping'
  if (st.includes('in-progress') || st.includes('in-check')) return 'building'
  if (st.includes('ready')) return 'queued'
  return 'built'
}

export type PhaseProgress = {
  id: string
  title: string
  pct: number
  countedWeight: number
  builtWeight: number
  counted: number
  built: number
}

export type Progress = {
  states: Record<string, BuildState>
  planPct: number
  countedWeight: number
  builtWeight: number
  phases: PhaseProgress[]
  /** First phase under 100% (phases with nothing counted are skipped); undefined when all done. */
  currentPhase: string | undefined
  /** First not-built build whose needs are all built. */
  nextUp: string | undefined
}

const pctOf = (part: number, whole: number) => (whole === 0 ? 0 : Math.floor((part * 100) / whole))

export function progress(plan: Plan, links: Links): Progress {
  const states: Record<string, BuildState> = {}
  for (const b of allBuilds(plan)) states[b.id] = buildState(b, links.byBuild[b.id] ?? [])
  const phases = plan.phases.map((p): PhaseProgress => {
    const counted = p.builds.filter(isCounted)
    const built = counted.filter(b => states[b.id] === 'built')
    const countedWeight = counted.reduce((s, b) => s + weightOf(b), 0)
    const builtWeight = built.reduce((s, b) => s + weightOf(b), 0)
    return { id: p.id, title: p.title, pct: pctOf(builtWeight, countedWeight), countedWeight, builtWeight, counted: counted.length, built: built.length }
  })
  const countedWeight = phases.reduce((s, p) => s + p.countedWeight, 0)
  const builtWeight = phases.reduce((s, p) => s + p.builtWeight, 0)
  const isDoneOrOut = (id: string) => states[id] === undefined || ['built', 'deferred', 'dropped'].includes(states[id]!)
  const next = allBuilds(plan).find(b => isCounted(b) && states[b.id] !== 'built' && b.needs.every(isDoneOrOut))
  return {
    states,
    planPct: pctOf(builtWeight, countedWeight),
    countedWeight,
    builtWeight,
    phases,
    currentPhase: phases.find(p => p.counted > 0 && p.pct < 100)?.id,
    nextUp: next?.id,
  }
}

// ── Coverage ──────────────────────────────────────────────────────────────

export type CoverageState = 'unplanned' | 'planned' | 'building' | 'built' | 'stale'

export type SectionCoverage = {
  id: string
  title: string
  state: CoverageState
  /** Counted builds that cover the section. */
  builds: string[]
  /** Tickets written against an older Rev of this section. */
  staleTickets: string[]
}

export type Coverage = { sections: SectionCoverage[]; designPct: number; counted: number; built: number }

/** Per numbered, non-dropped section. Stale wins over the other states. */
export function coverage(design: Design, plan: Plan, links: Links): Coverage {
  const prog = progress(plan, links)
  const builds = allBuilds(plan).filter(isCounted)
  const sections = design.sections
    .filter(s => !s.isDropped)
    .map((s): SectionCoverage => {
      const covering = builds.filter(b => b.covers.includes(s.id))
      const st = covering.map(b => prog.states[b.id])
      const staleTickets = [...new Set(links.stale.filter(r => r.section === s.id).map(r => r.ticket))]
      const state: CoverageState =
        staleTickets.length > 0
          ? 'stale'
          : covering.length === 0
            ? 'unplanned'
            : st.every(x => x === 'built')
              ? 'built'
              : st.some(x => x === 'built' || x === 'building' || x === 'stuck')
                ? 'building'
                : 'planned'
      return { id: s.id, title: s.title, state, builds: covering.map(b => b.id), staleTickets }
    })
  const built = sections.filter(s => s.state === 'built').length
  return { sections, designPct: pctOf(built, sections.length), counted: sections.length, built }
}

// ── Hill ──────────────────────────────────────────────────────────────────

export type HillSide = 'uphill' | 'top' | 'downhill'

export type Hill = {
  phase: string
  side: HillSide
  /** 0–100 along the hill: 0–50 uphill (share of builds with a ready-or-later ticket), 50 the top, 50–100 downhill (phase % halved). */
  position: number
  /** Why the phase is still uphill. */
  reasons: string[]
}

/**
 * Uphill while the phase has open design questions on its covered sections, a draft ticket or a
 * build with no ticket; over the top once every build has a ready-or-later ticket; downhill as
 * builds finish.
 */
export function hill(design: Design, plan: Plan, links: Links): Hill[] {
  const prog = progress(plan, links)
  return plan.phases.map((p): Hill => {
    const counted = p.builds.filter(isCounted)
    const pct = prog.phases.find(x => x.id === p.id)?.pct ?? 0
    const covered = new Set(counted.flatMap(b => b.covers))
    const reasons: string[] = []
    const openQ = design.sections.filter(s => covered.has(s.id) && !s.isDropped && s.questions.some(q => !q.isResolved)).map(s => s.id)
    if (openQ.length > 0) reasons.push(`open questions on ${openQ.join(', ')}`)
    const drafts = counted.filter(b => (links.byBuild[b.id] ?? []).some(t => t.status === 'draft')).map(b => b.id)
    if (drafts.length > 0) reasons.push(`draft tickets on ${drafts.join(', ')}`)
    const bare = counted.filter(b => (links.byBuild[b.id] ?? []).length === 0).map(b => b.id)
    if (bare.length > 0) reasons.push(`no ticket for ${bare.join(', ')}`)
    if (counted.length === 0) return { phase: p.id, side: 'uphill', position: 0, reasons }
    if (reasons.length > 0) {
      const ready = counted.filter(b => {
        const ts = links.byBuild[b.id] ?? []
        return ts.length > 0 && ts.every(t => READY_OR_LATER.has(t.status))
      }).length
      return { phase: p.id, side: 'uphill', position: Math.floor((ready * 50) / counted.length), reasons }
    }
    if (pct === 0) return { phase: p.id, side: 'top', position: 50, reasons }
    return { phase: p.id, side: 'downhill', position: 50 + Math.floor(pct / 2), reasons }
  })
}

// ── Checks ────────────────────────────────────────────────────────────────

export type CheckId =
  | 'plan-behind'
  | 'section-no-build'
  | 'build-no-section'
  | 'build-no-ticket'
  | 'ticket-missing-build'
  | 'open-questions'
  | 'stale-tickets'
  | 'off-plan'
  | 'plan-mismatch'

export type Alert = { id: CheckId; severity: 'error' | 'warn' | 'info'; message: string; subjects: string[] }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The roadmap checks, one alert per kind with the ids it is about. Empty for a blank project. */
export function checks(design: Design, plan: Plan, links: Links): Alert[] {
  const out: Alert[] = []
  const add = (id: CheckId, severity: Alert['severity'], message: string, subjects: string[]) => out.push({ id, severity, message, subjects })
  const builds = allBuilds(plan).filter(isCounted)
  const live = design.sections.filter(s => !s.isDropped)
  const hasPlan = plan.phases.length > 0

  if (design.version !== undefined && plan.designVersion !== undefined && plan.designVersion < design.version)
    add('plan-behind', 'warn', `Plan is behind: made from design v${plan.designVersion}, design is v${design.version}`, [])

  const noBuild = live.filter(s => !builds.some(b => b.covers.includes(s.id))).map(s => s.id)
  if (noBuild.length > 0) add('section-no-build', 'warn', `${plural(noBuild.length, 'design section')} with no build: ${noBuild.join(', ')}`, noBuild)

  if (live.length > 0) {
    const noSection = builds.filter(b => b.covers.length === 0).map(b => b.id)
    if (noSection.length > 0) add('build-no-section', 'warn', `${plural(noSection.length, 'build')} covering no design section: ${noSection.join(', ')}`, noSection)
  }

  const noTicket = builds.filter(b => (links.byBuild[b.id] ?? []).length === 0).map(b => b.id)
  if (noTicket.length > 0) add('build-no-ticket', 'info', `${plural(noTicket.length, 'build')} with no ticket: ${noTicket.join(', ')}`, noTicket)

  if (links.missing.length > 0)
    add('ticket-missing-build', 'error', `${plural(links.missing.length, 'ticket')} pointing at a missing build: ${links.missing.map(m => `${m.ticket} → ${m.build}`).join(', ')}`, links.missing.map(m => m.ticket))

  const open = live.filter(s => s.questions.some(q => !q.isResolved)).map(s => s.id)
  if (open.length > 0) add('open-questions', 'warn', `Open design questions in ${open.join(', ')}`, open)

  const stale = [...new Set(links.stale.map(r => r.ticket))]
  if (stale.length > 0) add('stale-tickets', 'warn', `${plural(stale.length, 'stale ticket')}: ${links.stale.map(r => `${r.ticket} (${r.section}@${r.rev}, now Rev ${r.now})`).join(', ')}`, stale)

  if (hasPlan && links.offPlan.length > 0)
    add('off-plan', 'info', `${plural(links.offPlan.length, 'ticket')} off-plan`, links.offPlan.map(t => t.number))

  if (links.mismatched.length > 0)
    add('plan-mismatch', 'warn', `Plan and ticket disagree: ${links.mismatched.map(m => `${m.ticket} is under ${m.cell} but says Plan: ${m.line}`).join(', ')}`, links.mismatched.map(m => m.ticket))

  return out
}

// ── All at once ───────────────────────────────────────────────────────────

export type Roadmap = {
  design: Design
  plan: Plan
  links: Links
  progress: Progress
  coverage: Coverage
  hill: Hill[]
  checks: Alert[]
  isBlank: boolean
}

/** Parses and computes everything from the two file texts and the board's tickets. */
export function roadmap(designMd: string | undefined, planMd: string | undefined, tickets: readonly TicketRef[]): Roadmap {
  const design = parseDesign(designMd)
  const plan = parsePlan(planMd)
  const links = linkTickets(plan, design, tickets)
  return {
    design,
    plan,
    links,
    progress: progress(plan, links),
    coverage: coverage(design, plan, links),
    hill: hill(design, plan, links),
    checks: checks(design, plan, links),
    isBlank: design.sections.length === 0 && plan.phases.length === 0 && designMd === undefined && planMd === undefined,
  }
}

// ── Tickets from the plan (0008) ──────────────────────────────────────────

/** What a Create tickets press does with the builds it was given. */
export type Batch = {
  /** Builds that get a new ticket, in creation order: a needed build in the batch comes before the build that needs it. */
  create: Build[]
  /** Builds that already have a ticket (Ticket cell or a ticket's `Plan:` line). */
  skipped: Build[]
  /** Deferred or dropped builds: never created. */
  left: Build[]
}

/**
 * Splits the selected build ids (duplicates and unknown ids ignored) into those to create, those
 * skipped and those left out, and orders the ones to create so `Needs` inside the batch come first.
 */
export function planBatch(plan: Plan, links: Links, ids: readonly string[]): Batch {
  const wanted = new Set(ids.map(i => i.toUpperCase()))
  const out: Batch = { create: [], skipped: [], left: [] }
  const todo: Build[] = []
  for (const b of allBuilds(plan)) {
    if (!wanted.has(b.id)) continue
    if (b.status !== '') out.left.push(b)
    else if ((links.byBuild[b.id] ?? []).length > 0 || b.tickets.length > 0) out.skipped.push(b)
    else todo.push(b)
  }
  const inBatch = new Map(todo.map(b => [b.id, b]))
  const done = new Set<string>()
  const visiting = new Set<string>()
  const visit = (b: Build) => {
    if (done.has(b.id) || visiting.has(b.id)) return
    visiting.add(b.id)
    for (const n of b.needs) {
      const need = inBatch.get(n)
      if (need !== undefined) visit(need)
    }
    visiting.delete(b.id)
    done.add(b.id)
    out.create.push(b)
  }
  for (const b of todo) visit(b)
  return out
}

/**
 * A new ticket's Blocked by from its build's `Needs`: the tickets of each needed build (existing
 * ones, or `created` earlier in this batch). A needed build with no ticket is left out and listed in `missing`.
 */
export function blockedByFor(build: Build, links: Links, created: ReadonlyMap<string, string>): { blockedBy: string[]; missing: string[] } {
  const blockedBy: string[] = []
  const missing: string[] = []
  for (const n of build.needs) {
    const made = created.get(n)
    const nums = [...(links.byBuild[n] ?? []).map(t => t.number), ...(made === undefined ? [] : [made])]
    if (nums.length === 0) missing.push(n)
    for (const x of nums) if (!blockedBy.includes(x)) blockedBy.push(x)
  }
  return { blockedBy: blockedBy.sort(), missing }
}

/** The row note for needed builds that have no ticket. Empty when nothing is missing. */
export function missingNote(missing: readonly string[]): string {
  return missing.length === 0 ? '' : `needs ${missing.join(', ')}: no ticket yet, not in Blocked by`
}

/** The `Design:` line value for the sections a build covers, at their current Rev: `D1@2, D3@1`. */
export function designLine(design: Design, covers: readonly string[]): string {
  return covers
    .map(id => {
      const s = design.sections.find(x => x.id === id)
      return s === undefined ? id : `${id}@${s.rev}`
    })
    .join(', ')
}

/** Every `Done when` line of the live sections a build covers, in Covers order. */
export function coveredDoneWhen(design: Design, build: Build): string[] {
  return build.covers.flatMap(id => design.sections.find(s => s.id === id && !s.isDropped)?.doneWhen ?? [])
}

/**
 * What the ticket writer is told about one build: the build row, its phase Goal and Exit, and each
 * covered design section with its Rev and `Done when` lines, plus the head lines to write.
 */
export function planBrief(design: Design, plan: Plan, build: Build): string {
  const phase = plan.phases.find(p => p.id === build.phase)
  const needs = [...build.needs, ...build.needsOther]
  const lines = [
    `Build ${build.id} · ${build.name}${build.size === '' ? '' : ` (size ${build.size})`}`,
    `Needs: ${needs.length === 0 ? '—' : needs.join(', ')} · Covers: ${build.covers.length === 0 ? '—' : build.covers.join(', ')}`,
    `Build done when: ${build.doneWhen.trim() === '' ? '—' : build.doneWhen.trim()}`,
    '',
    phase === undefined || phase.id === '' ? 'Phase: (the plan has no phases)' : `Phase ${phase.id} · ${phase.title}`,
    `Phase goal: ${phase?.goal || '—'}`,
    `Phase exit: ${phase?.exit || '—'}`,
    '',
    'Lines under the title of rd.md:',
    'Type: feature',
    `Plan: ${build.id}`,
    ...(build.covers.length === 0 ? [] : [`Design: ${designLine(design, build.covers)}`]),
  ]
  for (const id of build.covers) {
    const s = design.sections.find(x => x.id === id)
    lines.push('')
    if (s === undefined) {
      lines.push(`${id}: not found in the design.`)
      continue
    }
    lines.push(`${s.id} · ${s.title} (Rev ${s.rev})${s.isDropped ? ' (dropped)' : ''}`)
    if (s.why !== '') lines.push(`Why: ${s.why}`)
    if (s.what !== '') lines.push(`What: ${s.what}`)
    lines.push('Done when:')
    if (s.doneWhen.length === 0) lines.push('- (none written)')
    for (const d of s.doneWhen) lines.push(`- ${d}`)
  }
  return lines.join('\n')
}

/**
 * Adds a ticket number to a build's `Ticket` cell in PLAN.md (`—` becomes `0016`; `0004` becomes
 * `0004, 0016`). Every other line is kept as it was. Unchanged when the build or the column is missing.
 */
export function setPlanTicket(md: string, buildId: string, number: string): string {
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  const want = buildId.toUpperCase()
  for (let i = 0; i < lines.length; i++) {
    if (!isTableLine(lines[i] ?? '')) continue
    const head = cells(lines[i]!).map(c => stripMd(c).toLowerCase())
    const idCol = head.findIndex(c => PLAN_HEADERS[c] === 'id')
    const tCol = head.findIndex(c => PLAN_HEADERS[c] === 'tickets')
    let j = i + 1
    for (; j < lines.length && isTableLine(lines[j] ?? ''); j++) {
      if (idCol === -1 || tCol === -1) continue
      const c = cells(lines[j]!)
      if (stripMd(c[idCol] ?? '').toUpperCase() !== want) continue
      const old = (c[tCol] ?? '').trim()
      const have = (old.match(/\d{1,5}/g) ?? []).map(n => n.padStart(4, '0'))
      if (have.includes(number)) return md
      lines[j] = replaceCell(lines[j]!, tCol, have.length === 0 ? number : `${old}, ${number}`)
      return lines.join(eol)
    }
    i = j - 1
  }
  return md
}

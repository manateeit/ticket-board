// The roadmap: DESIGN.md and PLAN.md (format in docs/STANDARD.md) joined to the board's tickets.
// Pure functions, no tokens: everything is recomputed from the file texts on every refresh.
// Only `bindFromBoard` reads files, through the reader callback it is given.
// The rules are PLAN-design-plan.md sections 3 and 4.

import { STATUSES, cells, isTableLine, replaceCell, type BoardRow, type Status } from './board'
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
export const D_HEADING = /^##\s+(?:~~\s*)?D(\d+)\s*(?:~~\s*)?[·—–:]\s*(.*?)\s*$/i
const P_HEADING = /^##\s+(?:~~\s*)?P(\d+)\s*(?:~~\s*)?[·—–:]\s*(.*?)\s*$/i

function splitH2(lines: string[]): { head: string; body: string[] }[] {
  const out: { head: string; body: string[] }[] = []
  for (const line of lines) {
    if (/^##\s/.test(line)) out.push({ head: line, body: [] })
    else out[out.length - 1]?.body.push(line)
  }
  return out
}

/**
 * Where a D section's Open questions are, in its body (the lines after its `##` heading):
 * `start` is the `### Open questions` line, `end` the next `###`/`##` heading or the body's end.
 * The one rule for the reader (`parseSection`) and the answer writer (designfile.ts).
 */
export function questionsBlock(body: readonly string[]): { start: number; end: number } | undefined {
  const start = body.findIndex(l => /^###\s+open questions/i.test(l))
  if (start === -1) return undefined
  const end = body.findIndex((l, i) => i > start && /^###?\s/.test(l))
  return { start, end: end === -1 ? body.length : end }
}

/** A question's text as the pane shows it: without the `[ ]` / `[x]` box. */
export const questionText = (raw: string) => raw.replace(/^\[[ xX]\]\s*/, '').trim()

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
  const block = questionsBlock(body)
  body.forEach((line, i) => {
    if (block !== undefined && i >= block.start) return
    if (/^###\s/.test(line)) {
      field = ''
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
  if (block !== undefined) {
    const qs = parseQuestions(['## Open questions', ...body.slice(block.start + 1, block.end)].join('\n'))
    for (const q of qs) {
      const text = questionText(q.text)
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

/** The `Design: <path> · Plan: <path>` line under the BOARD.md title (either half may be missing; `bindFromBoard` then uses its default). */
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
 * Which design and plan files the board is bound to: each half named on the BOARD.md binding line,
 * else `design/DESIGN.md` / `design/PLAN.md` (in any case) when that file exists. `readFile` gets a path relative to the
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
  // The line overrides only the halves it names; a missing half falls back to its default file.
  const d = line?.design === undefined ? resolve(DEFAULT_DESIGN, 'design', false) : resolve(line.design, 'design', true)
  const p = line?.plan === undefined ? resolve(DEFAULT_PLAN, 'plan', false) : resolve(line.plan, 'plan', true)
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

/** One ticket's stale references (0015), in the order its `Design:` line names them. */
export function staleOf(links: Links, ticket: string): StaleRef[] {
  return links.stale.filter(r => r.ticket === ticket)
}

/** The stale chip's words: `Written against D3 rev 1, now rev 2`. */
export function staleText(r: StaleRef): string {
  return `Written against ${r.section} rev ${r.rev}, now rev ${r.now}`
}

// ── Change notes ──────────────────────────────────────────────────────────

/** A redesign note, `design/changes/<date>-design-vN.md` (format in docs/STANDARD.md, section 8). */
export type ChangeNote = {
  /** The front matter `design-version`, else the `vN` of the file name. */
  version: number | undefined
  date: string
  /** `- Changed D3 (Rev 1 → 2): …` lines: the section and its new Rev (and the old one when given). */
  changed: { id: string; from?: number; rev: number }[]
  /** `- Added D9 · Title` lines. */
  added: string[]
  /** `- Dropped D7 · Title` lines. */
  dropped: string[]
}

/**
 * Reads the changed sections and their new Revs from a redesign note. The `- Changed / Added /
 * Dropped` bullets are read under `## Changes` (anywhere in the note when it has no such heading).
 * Lines it does not recognise are skipped; never throws.
 */
export function parseChangeNote(md: string | undefined, name = ''): ChangeNote {
  const note: ChangeNote = { version: undefined, date: '', changed: [], added: [], dropped: [] }
  const fromName = /^(\d{4}-\d{2}-\d{2})?-?design-v(\d+)\.md$/i.exec(name)
  note.date = fromName?.[1] ?? ''
  note.version = fromName?.[2] === undefined ? undefined : Number(fromName[2])
  if (md === undefined) return note
  const { values, body } = frontMatter(md.split(/\r?\n/))
  note.version = intOf(values['design-version']) ?? note.version
  if (values.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(values.date)) note.date = values.date
  const parts = splitH2(body)
  const changes = parts.find(p => /^##\s+changes\s*$/i.test(p.head))
  const lines = changes?.body ?? body
  for (const line of lines) {
    const c = /^\s*[-*]\s+changed\s+D(\d+)\b[^(\n]*\(\s*rev\s*(?:(\d+)\s*(?:→|->|–>|=>)\s*)?(\d+)\s*\)/i.exec(line)
    if (c !== null) {
      const id = `D${Number(c[1])}`
      if (!note.changed.some(x => x.id === id)) note.changed.push({ id, ...(c[2] === undefined ? {} : { from: Number(c[2]) }), rev: Number(c[3]) })
      continue
    }
    const a = /^\s*[-*]\s+(added|dropped)\s+D(\d+)\b/i.exec(line)
    if (a === null) continue
    const id = `D${Number(a[2])}`
    const list = a[1]!.toLowerCase() === 'added' ? note.added : note.dropped
    if (!list.includes(id)) list.push(id)
  }
  return note
}

/** `D3 now rev 2, D9 added, D7 dropped`; '' when the note names no section. */
export function changeSummary(note: ChangeNote): string {
  return [...note.changed.map(c => `${c.id} now rev ${c.rev}`), ...note.added.map(id => `${id} added`), ...note.dropped.map(id => `${id} dropped`)].join(', ')
}

// ── Progress ──────────────────────────────────────────────────────────────

export type BuildState = 'not-started' | 'shaping' | 'queued' | 'building' | 'built' | 'stuck' | 'deferred' | 'dropped'

export const WEIGHTS: Record<Size, number> = { S: 1, M: 3, L: 8, '': 3 }

export const weightOf = (b: Pick<Build, 'size'>) => WEIGHTS[b.size]

/**
 * What each board status means for a build: the state it pushes the build to (the lowest rank among
 * a build's tickets wins) and whether it counts as ready or later. Keyed by `Status`, so a new status
 * in `STATUSES` is a type error here until it is placed.
 */
const STATUS_BUILD: Record<Status, { state: BuildState; rank: number; isReadyOrLater: boolean }> = {
  blocked: { state: 'stuck', rank: 0, isReadyOrLater: true },
  draft: { state: 'shaping', rank: 1, isReadyOrLater: false },
  'in-progress': { state: 'building', rank: 2, isReadyOrLater: true },
  'in-check': { state: 'building', rank: 2, isReadyOrLater: true },
  ready: { state: 'queued', rank: 3, isReadyOrLater: true },
  done: { state: 'built', rank: 4, isReadyOrLater: true },
}

const isStatus = (s: string): s is Status => (STATUSES as readonly string[]).includes(s)

const READY_OR_LATER: ReadonlySet<string> = new Set(STATUSES.filter(s => STATUS_BUILD[s].isReadyOrLater))

/** A build's state from its tickets. Tickets with a status the board does not know are ignored. */
export function buildState(build: Build, tickets: readonly TicketRef[]): BuildState {
  if (build.status !== '') return build.status
  const st = tickets.map(t => t.status).filter(isStatus)
  if (st.length === 0) return 'not-started'
  return st.map(s => STATUS_BUILD[s]).reduce((a, b) => (b.rank < a.rank ? b : a)).state
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

// ── Replan proposals (0016) ───────────────────────────────────────────────

/** The four groups of a replan proposal, in the order the file and the review screen use. */
export type ReplanGroup = 'add' | 'change' | 'drop' | 'follow-up'

export const REPLAN_GROUPS: readonly { id: ReplanGroup; title: string }[] = [
  { id: 'add', title: 'Add' },
  { id: 'change', title: 'Change' },
  { id: 'drop', title: 'Drop' },
  { id: 'follow-up', title: 'Follow-up' },
]

/** The cells of a build row as an Add or Change item writes them. */
export type ReplanRow = { id: string; name: string; size: string; needs: string; covers: string; doneWhen: string }

export type ReplanItem = {
  /** 0-based position among all the file's items: what the review screen ticks. */
  index: number
  group: ReplanGroup
  /** 0-based line of the `- [ ]` in the file. */
  line: number
  /** `[ ]` open, `[x]` applied, `[-]` dismissed. */
  state: 'open' | 'applied' | 'dismissed'
  /** The item's text after the box. */
  text: string
  /** The indented lines under the item (a leading `Reason:` dropped). */
  reason: string
  /** The build the item is about (always for Add, Change and Drop; optional for Follow-up). */
  build?: string
  /** Add and Change: the build row. */
  row?: ReplanRow
  /** What the review screen shows: `P2.3 · Offline cache`, or the Follow-up ticket's title. */
  title: string
  /** Why the item cannot be applied as written; '' when it can. */
  problem: string
}

export type Proposal = {
  designVersion: number | undefined
  date: string
  /** `plan-hash` from the front matter: `planHash()` of PLAN.md when the proposal was made; '' when missing. */
  planHash: string
  items: ReplanItem[]
  /** At least one Add / Change / Drop / Follow-up heading was found. */
  hasGroups: boolean
}

/**
 * A short fingerprint of PLAN.md (FNV-1a, 32 bits, 8 hex digits) over the text with `\r\n` read as
 * `\n`. The proposal records it as `plan-hash`; Apply refuses when PLAN.md no longer has it.
 */
export function planHash(md: string): string {
  let hash = 0x811c9dc5
  const t = md.replace(/\r\n/g, '\n')
  for (let i = 0; i < t.length; i++) {
    hash ^= t.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const GROUP_HEADING = /^#{2,3}\s+(add|change|drop|follow[- ]?ups?)(?:\s+(?:builds?|tickets?))?\s*$/i
const ITEM = /^ ?[-*]\s+\[([ xX-])\]\s+(.*?)\s*$/

const groupOf = (word: string): ReplanGroup => {
  const w = word.toLowerCase()
  return w === 'add' ? 'add' : w === 'change' ? 'change' : w === 'drop' ? 'drop' : 'follow-up'
}

function parseItem(group: ReplanGroup, text: string): Pick<ReplanItem, 'build' | 'row' | 'title' | 'problem'> {
  if (group === 'add' || group === 'change') {
    if (!text.startsWith('|')) return { title: text, problem: 'write the build as a table row: | # | Build | Size | Needs | Covers | Done when |' }
    const c = cells(text)
    const id = stripMd(c[0] ?? '').toUpperCase()
    if (!BUILD_ID.test(id)) return { title: text, problem: `"${c[0] ?? ''}" is not a build id` }
    if (c.length < 6) return { build: id, title: `${id} · ${stripMd(c[1] ?? '')}`, problem: 'the row needs 6 cells: # | Build | Size | Needs | Covers | Done when' }
    const row: ReplanRow = { id, name: c[1]!, size: c[2]!, needs: c[3]!, covers: c[4]!, doneWhen: c[5]! }
    return { build: id, row, title: `${id} · ${stripMd(row.name)}`, problem: '' }
  }
  const m = /^(?:\*\*)?([A-Za-z]+\d+(?:\.\d+)+)(?:\*\*)?(?:\s*[·—–:-]\s*|\s+|$)(.*)$/.exec(text)
  if (group === 'drop') {
    if (m === null) return { title: text, problem: 'name the build to drop first: P2.2 · Title' }
    return { build: m[1]!.toUpperCase(), title: text, problem: '' }
  }
  if (m === null) return { title: text, problem: '' }
  const title = m[2]!.trim()
  return { build: m[1]!.toUpperCase(), title: title === '' ? text : title, problem: '' }
}

/**
 * Reads a replan proposal (`design/changes/<date>-replan.md`, format in docs/STANDARD.md section 8):
 * one `- [ ]` line per item under `## Add`, `## Change`, `## Drop` and `## Follow-up` (`### Add
 * build`, `## Follow-ups`… work too), each followed by its indented reason. Never throws.
 */
export function parseProposal(md: string | undefined, name = ''): Proposal {
  const fromName = /^(\d{4}-\d{2}-\d{2})/.exec(name)
  const out: Proposal = { designVersion: undefined, date: fromName?.[1] ?? '', planHash: '', items: [], hasGroups: false }
  if (md === undefined) return out
  const all = md.split(/\r?\n/)
  const { values, body } = frontMatter(all)
  const offset = all.length - body.length
  out.designVersion = intOf(values['design-version'])
  if (values.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(values.date)) out.date = values.date
  out.planHash = (values['plan-hash'] ?? '').toLowerCase()
  let group: ReplanGroup | undefined
  let item: ReplanItem | undefined
  body.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) {
      item = undefined
      const g = GROUP_HEADING.exec(line)
      if (g !== null) {
        group = groupOf(g[1]!)
        out.hasGroups = true
      } else if (/^#{1,2}\s/.test(line)) group = undefined
      return
    }
    if (group === undefined) return
    const m = ITEM.exec(line)
    if (m !== null) {
      const box = m[1]!.toLowerCase()
      item = {
        index: out.items.length,
        group,
        line: i + offset,
        state: box === 'x' ? 'applied' : box === '-' ? 'dismissed' : 'open',
        text: m[2]!,
        reason: '',
        ...parseItem(group, m[2]!),
      }
      out.items.push(item)
      return
    }
    if (line.trim() === '') return
    if (item !== undefined && /^\s+\S/.test(line)) {
      const r = line.trim().replace(/^(?:\*\*)?reason(?:\*\*)?\s*:\s*/i, '')
      item.reason = `${item.reason} ${r}`.trim()
      return
    }
    item = undefined
  })
  return out
}

/** Sets one front matter key (added before the closing `---` when missing; a front matter is added when there is none). */
export function setFrontMatterKey(md: string, key: string, value: string): string {
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  let open = 0
  while (open < lines.length && (lines[open] ?? '').trim() === '') open++
  const close = (lines[open] ?? '').trim() === '---' ? lines.findIndex((l, i) => i > open && l.trim() === '---') : -1
  if (close === -1) return ['---', `${key}: ${value}`, '---', ...lines].join(eol)
  const re = new RegExp(`^\\s*${key.replace(/-/g, '\\-')}\\s*:`, 'i')
  const at = lines.findIndex((l, i) => i > open && i < close && re.test(l))
  if (at === -1) lines.splice(close, 0, `${key}: ${value}`)
  else lines[at] = `${key}: ${value}`
  return lines.join(eol)
}

type PlanTable = { phase: string; head: number; end: number; cols: Partial<Record<BuildColumn, number>>; width: number }

/** The build tables of PLAN.md as line ranges: the phase each sits in, its header line and its end (exclusive). */
function planTables(lines: readonly string[]): PlanTable[] {
  const out: PlanTable[] = []
  let phase = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const ph = P_HEADING.exec(line)
    if (ph !== null) {
      phase = `P${Number(ph[1])}`
      continue
    }
    if (!isTableLine(line)) continue
    const head = cells(line).map(c => stripMd(c).toLowerCase())
    const cols: Partial<Record<BuildColumn, number>> = {}
    head.forEach((name, idx) => {
      const c = PLAN_HEADERS[name]
      if (c !== undefined && cols[c] === undefined) cols[c] = idx
    })
    let j = i + 1
    while (j < lines.length && isTableLine(lines[j] ?? '')) j++
    if (cols.id !== undefined && cols.name !== undefined) out.push({ phase, head: i, end: j, cols, width: head.length })
    i = j - 1
  }
  return out
}

const isSeparatorLine = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-')

function findBuildRow(lines: readonly string[], id: string): { table: PlanTable; line: number } | undefined {
  for (const t of planTables(lines))
    for (let j = t.head + 1; j < t.end; j++) {
      if (isSeparatorLine(lines[j]!)) continue
      if (stripMd(cells(lines[j]!)[t.cols.id!] ?? '').toUpperCase() === id) return { table: t, line: j }
    }
  return undefined
}

const ROW_COLS: (keyof ReplanRow & BuildColumn)[] = ['id', 'name', 'size', 'needs', 'covers', 'doneWhen']

export type ReplanApply = {
  /** PLAN.md after the ticked Add / Change / Drop items and the new `design-version`. */
  md: string
  /** Items applied (their indexes), Follow-ups included: the pane makes their tickets. */
  applied: number[]
  /** Ticked items left as they are, with the reason. */
  skipped: { index: number; why: string }[]
  /** Build ids added: each gets a draft ticket. */
  added: string[]
  /** Follow-ups to create as draft tickets. */
  followUps: { index: number; build?: string; title: string; reason: string }[]
}

/**
 * Applies the ticked open items of a proposal to PLAN.md text. Add inserts the row at the end of
 * its phase's build table (`P2.3` goes into `## P2`); Change rewrites the row's cells from `Build`
 * to `Done when` and keeps its Ticket and Status; Drop sets `Status: dropped` (adding the Status
 * column when the table has none) and never deletes the row. Follow-ups change nothing here.
 * When anything was applied, `design-version` becomes `designVersion` and `updated` `date`.
 * Pure; never touches tickets.
 */
export function applyProposal(planMd: string, proposal: Proposal, ticked: readonly number[], designVersion: number | undefined, date: string): ReplanApply {
  const eol = planMd.includes('\r\n') ? '\r\n' : '\n'
  let lines = planMd.split(/\r?\n/)
  const out: ReplanApply = { md: planMd, applied: [], skipped: [], added: [], followUps: [] }
  const want = new Set(ticked)
  for (const it of proposal.items) {
    if (!want.has(it.index) || it.state !== 'open') continue
    const skip = (why: string) => out.skipped.push({ index: it.index, why: `${it.build ?? it.title}: ${why}` })
    if (it.problem !== '') {
      skip(it.problem)
      continue
    }
    const found = it.build === undefined ? undefined : findBuildRow(lines, it.build)
    if (it.group === 'add') {
      if (found !== undefined) {
        skip('already in PLAN.md')
        continue
      }
      const phase = /^([A-Za-z]+\d+)\./.exec(it.build!)?.[1]?.toUpperCase() ?? ''
      const tables = planTables(lines)
      const isImplicit = tables.length > 0 && tables.every(x => x.phase === '')
      const t = [...tables].reverse().find(x => x.phase === phase) ?? (isImplicit ? tables[tables.length - 1] : undefined)
      if (t === undefined) {
        skip(`PLAN.md has no build table for phase ${phase}`)
        continue
      }
      const row = Array.from({ length: t.width }, () => '')
      for (const c of ROW_COLS) if (t.cols[c] !== undefined) row[t.cols[c]!] = c === 'id' ? it.row!.id : it.row![c].replace(/\|/g, '/')
      if (t.cols.tickets !== undefined) row[t.cols.tickets] = '—'
      lines.splice(t.end, 0, `| ${row.join(' | ')} |`.replace(/ {2}\|/g, ' |'))
      out.added.push(it.build!)
    } else if (it.group === 'change') {
      if (found === undefined) {
        skip('not in PLAN.md')
        continue
      }
      let line = lines[found.line]!
      for (const c of ROW_COLS) if (c !== 'id' && found.table.cols[c] !== undefined) line = replaceCell(line, found.table.cols[c]!, it.row![c].replace(/\|/g, '/'))
      lines[found.line] = line
    } else if (it.group === 'drop') {
      if (found === undefined) {
        skip('not in PLAN.md')
        continue
      }
      const t = found.table
      if (t.cols.status !== undefined) lines[found.line] = replaceCell(lines[found.line]!, t.cols.status, 'dropped')
      else
        lines = lines.map((l, j) => {
          if (j < t.head || j >= t.end) return l
          const base = l.replace(/\s+$/, '')
          if (j === t.head) return `${base} Status |`
          if (isSeparatorLine(l)) return `${base}---|`
          return j === found.line ? `${base} dropped |` : `${base} |`
        })
    } else {
      if (it.build !== undefined && found === undefined) {
        skip('not in PLAN.md')
        continue
      }
      out.followUps.push({ index: it.index, ...(it.build === undefined ? {} : { build: it.build }), title: it.title, reason: it.reason })
    }
    out.applied.push(it.index)
  }
  let md = lines.join(eol)
  if (out.applied.length > 0 && designVersion !== undefined) {
    md = setFrontMatterKey(md, 'design-version', String(designVersion))
    if (date !== '') md = setFrontMatterKey(md, 'updated', date)
  }
  out.md = md
  return out
}

/** Ticks applied items `[x]` and dismissed ones `[-]`, and records the plan's new `plan-hash`. Other lines are kept. */
export function markProposal(md: string, proposal: Proposal, marks: ReadonlyMap<number, 'applied' | 'dismissed'>, hash?: string): string {
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  for (const it of proposal.items) {
    const m = marks.get(it.index)
    if (m === undefined) continue
    lines[it.line] = (lines[it.line] ?? '').replace(/\[[ xX-]\]/, m === 'applied' ? '[x]' : '[-]')
  }
  const next = lines.join(eol)
  return hash === undefined ? next : setFrontMatterKey(next, 'plan-hash', hash)
}

// ── Docs follow-up (0016) ─────────────────────────────────────────────────

/** A Follow-up item or change note line that already asks for the docs update. */
export const DOCS_FOLLOW_UP = /update\s+readme\s*\/\s*docs/i

/**
 * The docs follow-up a redesign needs: `Update README/docs for design v3: Reminders, Payments`, one
 * line naming every section the notes change, add or drop whose title README mentions (any case).
 * Undefined when README mentions none of them.
 */
export function docsFollowUp(readme: string | undefined, design: Design, notes: readonly ChangeNote[]): string | undefined {
  if (readme === undefined || readme.trim() === '') return undefined
  const text = readme.toLowerCase()
  const ids = [...new Set(notes.flatMap(n => [...n.changed.map(c => c.id), ...n.added, ...n.dropped]))]
  const titles = ids.map(id => design.sections.find(s => s.id === id)?.title ?? '').filter(t => t.length >= 3 && text.includes(t.toLowerCase()))
  if (titles.length === 0) return undefined
  const v = Math.max(0, ...notes.map(n => n.version ?? 0))
  return `Update README/docs for ${v > 0 ? `design v${v}` : 'the redesign'}: ${[...new Set(titles)].join(', ')}`
}

/** Lines of the section under heading line `head`, up to the next heading: where a new list line goes (after the last non-blank one). */
function appendInSection(lines: string[], head: number, add: string[]): void {
  let end = lines.findIndex((l, i) => i > head && /^#{1,6}\s/.test(l))
  if (end === -1) end = lines.length
  const none = lines.findIndex((l, i) => i > head && i < end && /^\s*[-*]\s+none\b/i.test(l))
  if (none !== -1) {
    lines.splice(none, 1, ...add)
    return
  }
  let at = end
  while (at > head + 1 && lines[at - 1]!.trim() === '') at--
  lines.splice(at, 0, ...add)
}

/** Adds the docs item under `## Follow-up` of a proposal, unless one is there already. Other lines are kept. */
export function withDocsItem(md: string, text: string, reason: string): string {
  if (parseProposal(md).items.some(i => DOCS_FOLLOW_UP.test(i.text))) return md
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  const add = [`- [ ] ${text}`, `  ${reason}`]
  const head = lines.findIndex(l => {
    const g = GROUP_HEADING.exec(l)
    return g !== null && groupOf(g[1]!) === 'follow-up'
  })
  if (head !== -1) {
    appendInSection(lines, head, add)
    return lines.join(eol)
  }
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()
  return [...lines, '', '## Follow-up', ...add, ''].join(eol)
}

/** Lists the docs follow-up under `## Follow-ups` of a redesign note, unless it is there already. */
export function withNoteFollowUp(md: string, text: string): string {
  if (md.split(/\r?\n/).some(l => DOCS_FOLLOW_UP.test(l))) return md
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const lines = md.split(/\r?\n/)
  const head = lines.findIndex(l => /^##\s+follow[- ]?ups?\s*$/i.test(l))
  if (head !== -1) {
    appendInSection(lines, head, [`- ${text}`])
    return lines.join(eol)
  }
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()
  return [...lines, '', '## Follow-ups', `- ${text}`, ''].join(eol)
}

// ── Adopt existing docs (0009) ────────────────────────────────────────────

/** One source file of an adopt proposal: what it became (`D1, P1.2`) or why it was left out. */
export type AdoptSource = { path: string; text: string; isLeftOut: boolean }

/** What the adopt review ticks: a design section, a plan phase or a build of the drafts. */
export type AdoptItem = {
  kind: 'section' | 'phase' | 'build'
  /** `D3`, `P2`, `P2.1`. */
  id: string
  title: string
  /** A build's phase id (`P2`; '' in a plan without phase headings). */
  phase?: string
  /** The `## Reasons` line for this id; '' when the proposal gives none. */
  reason: string
  /** One short line: a section's What, a phase's Goal, a build's size, needs and covers. */
  detail: string
}

export type AdoptProposal = {
  /** `YYYY-MM-DD` from the front matter, else from the file name. */
  date: string
  /** The project's name for the drafts: front matter `design`, else the draft's own name. */
  name: string
  /** The pane applied it (front matter `applied: <date>`): no longer offered for review. */
  isApplied: boolean
  sources: AdoptSource[]
  /** The DESIGN.md and PLAN.md drafts (the fenced blocks under `## DESIGN.md` and `## PLAN.md`). */
  design?: string
  plan?: string
  items: AdoptItem[]
  /** Format problems and the parsers' warnings on the drafts. */
  warnings: string[]
}

const ADOPT_DESIGN = /^##\s+(?:proposed\s+)?(?:design(?:\.md)?|design\s+draft)\s*$/i
const ADOPT_PLAN = /^##\s+(?:proposed\s+)?(?:plan(?:\.md)?|plan\s+draft)\s*$/i
const FENCE = /^\s*(`{3,}|~{3,})/

/** The fenced block right under heading line `head` (blank lines allowed before it): its text and the line after its closing fence. */
function fencedAfter(lines: readonly string[], head: number): { text: string; end: number } | undefined {
  let i = head + 1
  while (i < lines.length && lines[i]!.trim() === '') i++
  const open = FENCE.exec(lines[i] ?? '')
  if (open === null) return undefined
  const mark = open[1]!
  const out: string[] = []
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j]!.trim()
    if (t.startsWith(mark) && /^(`+|~+)$/.test(t) && t[0] === mark[0]) return { text: out.join('\n'), end: j + 1 }
    out.push(lines[j]!)
  }
  return { text: out.join('\n'), end: lines.length }
}

/** The `- ` lines under an H2 heading (`## Sources`, `## Reasons`), each with its indented continuation lines. */
function listUnder(lines: readonly string[], heading: RegExp): string[] {
  const head = lines.findIndex(l => heading.test(l))
  if (head === -1) return []
  const out: string[] = []
  for (let i = head + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (/^#{1,2}\s/.test(line)) break
    const m = /^[-*]\s+(.*)$/.exec(line)
    if (m !== null) out.push(m[1]!.trim())
    else if (/^\s+\S/.test(line) && out.length > 0) out[out.length - 1] = `${out[out.length - 1]} ${line.trim()}`
  }
  return out.filter(l => l !== '' && !/^none\b/i.test(l))
}

/**
 * Reads an adopt proposal (`design/changes/<date>-adopt.md`, format in docs/STANDARD.md section 9):
 * `## Sources` (one line per source file), `## Reasons` (`- D1: …`, one per section, phase and
 * build), and the DESIGN.md and PLAN.md drafts as fenced blocks under `## DESIGN.md` and
 * `## PLAN.md`. The review items are every section, phase and build of the drafts. Never throws.
 */
export function parseAdopt(md: string | undefined, name = ''): AdoptProposal {
  const fromName = /^(\d{4}-\d{2}-\d{2})/.exec(name)
  const out: AdoptProposal = { date: fromName?.[1] ?? '', name: '', isApplied: false, sources: [], items: [], warnings: [] }
  if (md === undefined || md.trim() === '') {
    out.warnings.push('the proposal is empty')
    return out
  }
  const lines = md.split(/\r?\n/)
  const { values } = frontMatter(lines)
  if (values.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(values.date)) out.date = values.date
  out.isApplied = (values.applied ?? '') !== ''
  const dHead = lines.findIndex(l => ADOPT_DESIGN.test(l))
  const pHead = lines.findIndex(l => ADOPT_PLAN.test(l))
  const d = dHead === -1 ? undefined : fencedAfter(lines, dHead)
  const p = pHead === -1 ? undefined : fencedAfter(lines, pHead)
  if (d !== undefined) out.design = d.text
  if (p !== undefined) out.plan = p.text
  if (dHead !== -1 && d === undefined) out.warnings.push('the DESIGN.md draft is not in a fenced block')
  if (pHead !== -1 && p === undefined) out.warnings.push('the PLAN.md draft is not in a fenced block')
  if (dHead === -1 && pHead === -1) out.warnings.push('no ## DESIGN.md or ## PLAN.md draft')
  // Sources and reasons are read outside the drafts only.
  const outside = lines.map((l, i) => ((d !== undefined && i > dHead && i < d.end) || (p !== undefined && i > pHead && i < p.end) ? '' : l))
  for (const s of listUnder(outside, /^##\s+sources?\s*$/i)) {
    const m = /^`?([^`]+?)`?\s*(?::|→|->|—|–)\s*(.*)$/.exec(s)
    const path = (m?.[1] ?? s).trim()
    const text = (m?.[2] ?? '').trim()
    out.sources.push({ path, text, isLeftOut: /^(left out|not used|skipped|ignored)\b/i.test(text) })
  }
  const reasons = new Map<string, string>()
  for (const r of listUnder(outside, /^##\s+reasons?\s*$/i)) {
    const m = /^(?:\*\*)?([A-Za-z]+\d+(?:\.\d+)*)(?:\*\*)?\s*(?::|·|—|–|-)\s*(.*)$/.exec(r)
    if (m !== null && !reasons.has(m[1]!.toUpperCase())) reasons.set(m[1]!.toUpperCase(), m[2]!.trim())
  }
  const design = parseDesign(out.design)
  const plan = parsePlan(out.plan)
  out.name = values.design ?? values.name ?? (design.name || plan.name)
  out.warnings.push(...design.warnings.filter(w => !/no front matter/.test(w)), ...plan.warnings)
  const seen = new Set<string>()
  const add = (it: Omit<AdoptItem, 'reason'>) => {
    if (seen.has(it.id)) return
    seen.add(it.id)
    out.items.push({ ...it, reason: reasons.get(it.id) ?? '' })
  }
  for (const s of design.sections) {
    const qs = s.questions.filter(q => !q.isResolved).length
    add({ kind: 'section', id: s.id, title: s.title, detail: s.isDropped ? 'dropped' : [s.what, qs === 0 ? '' : `${qs} open question${qs === 1 ? '' : 's'}`].filter(Boolean).join(' · ') })
  }
  for (const ph of plan.phases) {
    if (!ph.isImplicit) add({ kind: 'phase', id: ph.id, title: ph.title, detail: ph.goal })
    for (const b of ph.builds) {
      const needs = [...b.needs, ...b.needsOther]
      add({
        kind: 'build',
        id: b.id,
        title: b.name,
        phase: ph.id,
        detail: [b.size || 'unsized', needs.length === 0 ? '' : `needs ${needs.join(', ')}`, b.covers.length === 0 ? 'covers nothing' : `covers ${b.covers.join(', ')}`, b.status].filter(Boolean).join(' · '),
      })
    }
  }
  return out
}

/** The ids Apply leaves out: the unticked ones, plus every build of an unticked phase. */
export function adoptLeftOut(p: AdoptProposal, off: ReadonlySet<string>): Set<string> {
  const out = new Set<string>()
  for (const it of p.items) if (off.has(it.id) || (it.kind === 'build' && it.phase !== undefined && it.phase !== '' && off.has(it.phase))) out.add(it.id)
  return out
}

/** Removes the `## ` blocks whose heading matches `re` with an id in `ids` (the heading up to the next `## `). */
function withoutBlocks(md: string, re: RegExp, prefix: string, ids: ReadonlySet<string>): string {
  const keep: string[] = []
  let skipping = false
  for (const line of md.split(/\r?\n/)) {
    if (/^##\s/.test(line)) {
      const m = re.exec(line)
      skipping = m !== null && ids.has(`${prefix}${Number(m[1])}`)
    }
    if (!skipping) keep.push(line)
  }
  return keep.join('\n')
}

/** Strips the ids in `ids` from a comma list cell (`D1, D3` → `D1`); `—` when nothing is left. */
function withoutIds(cell: string, ids: ReadonlySet<string>): string {
  const parts = cell
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s !== '' && !NONE.test(s))
  const kept = parts.filter(s => !ids.has(stripMd(s).toUpperCase()))
  if (kept.length === parts.length) return cell.trim()
  return kept.length === 0 ? '—' : kept.join(', ')
}

export type AdoptResult = {
  /** DESIGN.md as Apply writes it (`status: draft`, `version: 1`); undefined when the proposal has no design. */
  design?: string
  /** PLAN.md as Apply writes it (`design-version: 1`); undefined when the proposal has no plan. */
  plan?: string
  sections: number
  phases: number
  builds: number
}

/**
 * The files Apply writes from a proposal and the ids left out: the drafts without the left-out
 * sections, phases and builds (a build of a left-out phase goes too; a left-out id is struck from
 * the `Covers` and `Needs` cells of the rest). Every id that stays keeps its number: nothing is
 * renumbered, so an id is never reused.
 */
export function adoptResult(p: AdoptProposal, off: ReadonlySet<string>, date: string): AdoptResult {
  const out = adoptLeftOut(p, off)
  const res: AdoptResult = { sections: 0, phases: 0, builds: 0 }
  if (p.design !== undefined && p.design.trim() !== '') {
    let md = withoutBlocks(p.design, D_HEADING, 'D', out).replace(/\s*$/, '\n')
    if (frontMatter(md.split('\n')).values.design === undefined && p.name !== '') md = setFrontMatterKey(md, 'design', p.name)
    md = setFrontMatterKey(setFrontMatterKey(setFrontMatterKey(md, 'version', '1'), 'status', 'draft'), 'updated', date)
    res.design = md
    res.sections = parseDesign(md).sections.filter(s => !s.isDropped).length
  }
  if (p.plan !== undefined && p.plan.trim() !== '') {
    const lines = withoutBlocks(p.plan, P_HEADING, 'P', out).split('\n')
    for (const t of planTables(lines).reverse())
      for (let j = t.end - 1; j > t.head; j--) {
        const line = lines[j]!
        if (isSeparatorLine(line)) continue
        const c = cells(line)
        if (out.has(stripMd(c[t.cols.id!] ?? '').toUpperCase())) {
          lines.splice(j, 1)
          continue
        }
        let next = line
        for (const col of [t.cols.covers, t.cols.needs]) {
          if (col === undefined || c[col] === undefined) continue
          const v = withoutIds(c[col]!, out)
          if (v !== c[col]!.trim()) next = replaceCell(next, col, v)
        }
        lines[j] = next
      }
    let md = lines.join('\n').replace(/\s*$/, '\n')
    if (frontMatter(md.split('\n')).values.plan === undefined && p.name !== '') md = setFrontMatterKey(md, 'plan', p.name)
    md = setFrontMatterKey(setFrontMatterKey(md, 'design-version', '1'), 'updated', date)
    res.plan = md
    const plan = parsePlan(md)
    res.phases = plan.phases.filter(x => !x.isImplicit).length
    res.builds = allBuilds(plan).length
  }
  return res
}

/**
 * Sets the `Design: … · Plan: …` binding line under the BOARD.md title (replacing the one there). A half
 * not given (`undefined`) keeps the path the existing line names for it. Other lines are kept.
 */
export function setBindingLine(board: string, design: string | undefined, plan: string | undefined): string {
  if (design === undefined && plan === undefined) return board
  const kept = parseBindingLine(board)
  const d = design ?? kept?.design
  const p = plan ?? kept?.plan
  const text = [d === undefined ? '' : `Design: ${d}`, p === undefined ? '' : `Plan: ${p}`].filter(Boolean).join(' · ')
  if (text === '') return board
  const eol = board.includes('\r\n') ? '\r\n' : '\n'
  const lines = board.split(/\r?\n/)
  const tableAt = lines.findIndex(l => isTableLine(l))
  const before = tableAt === -1 ? lines.length : tableAt
  const at = lines.findIndex((l, i) => i < before && /^\s*(?:\*\*)?(design|plan)(?:\*\*)?\s*:/i.test(l))
  if (at !== -1) {
    lines[at] = text
    return lines.join(eol)
  }
  const title = lines.findIndex((l, i) => i < before && /^#\s/.test(l))
  if (title === -1) return [text, '', ...lines].join(eol)
  const add = ['', text]
  if ((lines[title + 1] ?? '').trim() !== '') add.push('')
  lines.splice(title + 1, 0, ...add)
  return lines.join(eol)
}

/**
 * The paths typed into the adopt box (comma or newline separated), relative to the project root
 * `root`. An error for empty input or a path outside the project (an absolute path elsewhere, `~`,
 * or `..` climbing out). Whether each one exists is checked by the caller.
 */
export function adoptPaths(input: string, root: string): { paths: string[]; error?: string } {
  const raw = input
    .split(/[\n,]/)
    .map(s => s.trim().replace(/^["'`]|["'`]$/g, '').trim())
    .filter(s => s !== '')
  if (raw.length === 0) return { paths: [], error: 'Type one or more file or folder paths inside the project' }
  const base = root.replace(/\/+$/, '')
  const paths: string[] = []
  for (const p of raw) {
    if (p.startsWith('~')) return { paths: [], error: `${p} is outside the project` }
    let rel = p
    if (p.startsWith('/')) {
      if (p !== base && !p.startsWith(`${base}/`)) return { paths: [], error: `${p} is outside the project` }
      rel = p.slice(base.length + 1)
    }
    const parts: string[] = []
    for (const part of rel.split('/')) {
      if (part === '' || part === '.') continue
      if (part === '..') {
        if (parts.length === 0) return { paths: [], error: `${p} is outside the project` }
        parts.pop()
      } else parts.push(part)
    }
    const norm = parts.length === 0 ? '.' : parts.join('/')
    if (!paths.includes(norm)) paths.push(norm)
  }
  return { paths }
}

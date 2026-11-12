// Numbering, slugs, filtering and sorting — pure helpers.
import { statusRank } from './board'
import { headField } from './ticket'

export function nextNumber(folderNames: readonly string[], boardNumbers: readonly string[] = []): string {
  let max = 0
  for (const n of folderNames) {
    const m = /^(\d{1,5})-/.exec(n)
    if (m !== null) max = Math.max(max, Number(m[1]))
  }
  for (const n of boardNumbers) if (/^\d+$/.test(n)) max = Math.max(max, Number(n))
  return String(max + 1).padStart(4, '0')
}

export function slugify(title: string, max = 45): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '') || 'ticket'
}

/** A short working title from a free-text idea: its first sentence, at most ~60 chars. */
export function titleFromIdea(idea: string): string {
  const first = idea.trim().split(/\r?\n/)[0] ?? ''
  const sentence = (first.split(/(?<=[.!?])\s/)[0] ?? first).replace(/[.!?]+$/, '').trim()
  const t = sentence.length > 60 ? `${sentence.slice(0, 57).replace(/\s+\S*$/, '')}…` : sentence
  return t.charAt(0).toUpperCase() + t.slice(1) || 'New ticket'
}

export const SHOW_OPTIONS = ['needs-me', 'not-done', 'all', 'draft', 'ready', 'in-progress', 'in-check', 'blocked', 'done'] as const
export type Show = (typeof SHOW_OPTIONS)[number]
export const SORT_OPTIONS = ['number', 'number-desc', 'status', 'questions', 'updated', 'title', 'kind', 'mode', 'phase'] as const
export type Sort = (typeof SORT_OPTIONS)[number]
export const MODE_OPTIONS = ['any', 'solo', 'team'] as const
export type ModeFilter = (typeof MODE_OPTIONS)[number]

export const KINDS = ['feature', 'bug', 'chore'] as const
export type Kind = (typeof KINDS)[number]
export const KIND_OPTIONS = ['any', ...KINDS] as const
export type KindFilter = (typeof KIND_OPTIONS)[number]

/** `any`, `off-plan`, or a phase id (`P2`). Applies only while a plan is bound. */
export type PhaseFilter = string
export const OFF_PLAN = 'off-plan'

export type Filters = { show: Show; sort: Sort; mode: ModeFilter; search: string; kind: KindFilter; desc: boolean; hideDone?: boolean; phase?: PhaseFilter }
export const DEFAULT_FILTERS: Filters = { show: 'all', sort: 'number', mode: 'any', search: '', kind: 'any', desc: false, hideDone: false, phase: 'any' }

export type Item = {
  number: string
  title: string
  status: string
  mode: string
  owner: string
  notes: string
  openQuestions: number
  updatedMs: number
  kind?: Kind
  /** The plan phase of the build the ticket is linked to (`P2`); '' when off-plan; undefined when no plan is bound. */
  phase?: string
}

export function matches(item: Item, f: Filters): boolean {
  const s = item.status
  // "Hide done" sticks across every tab except the Done tab itself.
  if (f.hideDone === true && s === 'done' && f.show !== 'done') return false
  switch (f.show) {
    case 'needs-me':
      if (s !== 'draft' && s !== 'blocked') return false
      break
    case 'not-done':
      if (s === 'done') return false
      break
    case 'all':
      break
    default:
      if (s !== f.show) return false
  }
  if (f.mode !== 'any' && item.mode.toLowerCase() !== f.mode) return false
  if (f.kind !== undefined && f.kind !== 'any' && (item.kind ?? 'feature') !== f.kind) return false
  // With no plan bound items carry no phase, and a remembered phase filter is ignored.
  if (f.phase !== undefined && f.phase !== 'any' && item.phase !== undefined) {
    if (f.phase === OFF_PLAN ? item.phase !== '' : item.phase !== f.phase) return false
  }
  const q = f.search.trim().toLowerCase()
  if (q !== '') {
    const hay = `${item.number} ${item.title} ${item.notes} ${item.owner} ${item.status} ${item.kind ?? ''}`.toLowerCase()
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false
  }
  return true
}

export function sortItems<T extends Item>(items: T[], sort: Sort): T[] {
  const byNum = (a: Item, b: Item) => a.number.localeCompare(b.number)
  const out = [...items]
  switch (sort) {
    case 'number':
      return out.sort(byNum)
    case 'number-desc':
      return out.sort((a, b) => byNum(b, a))
    case 'status':
      return out.sort((a, b) => statusRank(a.status) - statusRank(b.status) || byNum(a, b))
    case 'questions':
      return out.sort((a, b) => b.openQuestions - a.openQuestions || byNum(a, b))
    case 'updated':
      return out.sort((a, b) => b.updatedMs - a.updatedMs || byNum(a, b))
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || byNum(a, b))
    case 'kind':
      return out.sort((a, b) => KINDS.indexOf(a.kind ?? 'feature') - KINDS.indexOf(b.kind ?? 'feature') || byNum(a, b))
    case 'mode':
      return out.sort((a, b) => a.mode.localeCompare(b.mode) || byNum(a, b))
    case 'phase':
      return out.sort((a, b) => comparePhase(a.phase, b.phase) || byNum(a, b))
  }
}

/** Phase order: `P2` before `P10`; off-plan ('' or none) last. */
export function comparePhase(a: string | undefined, b: string | undefined): number {
  const isOffA = a === undefined || a === ''
  const isOffB = b === undefined || b === ''
  if (isOffA || isOffB) return Number(isOffA) - Number(isOffB)
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function query<T extends Item>(items: T[], f: Filters): T[] {
  const sorted = sortItems(items.filter(i => matches(i, f)), f.sort)
  return f.desc === true ? sorted.reverse() : sorted
}

/** Feature, bug or chore: an explicit `Type:` line in the rd.md head (above the first `## `) wins, else words in the title. */
export function kindOf(title: string, rd?: string): Kind {
  const v = rd === undefined ? undefined : headField(rd, 'type')
  const m = v === undefined ? null : /^(feature|bug|chore)\b/i.exec(v)
  if (m !== null) return m[1]!.toLowerCase() as Kind
  const t = title.toLowerCase()
  if (/\b(fix|fixes|bug|broken|crash|crashes|error|regression|fails?|failing|wrong|incorrect|not working|doesn'?t)\b/.test(t)) return 'bug'
  if (/\b(chore|refactor|rename|cleanup|clean up|bump|upgrade|migrate|ci|lint|docs?)\b/.test(t)) return 'chore'
  return 'feature'
}

/** The board the router reads and updates when the `ticketsDir` setting is left at its default. */
export const DEFAULT_BOARD = 'tickets/BOARD.md'

/**
 * `Run tickets 0011, 0013 and 0014.` `board` is the resolved board path (`<ticketsDir>/BOARD.md`): a
 * non-default one is named in the line so the router works on the board the pane shows. With the
 * default the line reads as it always has. `waitFor` (blockers not done yet) adds `— but only once
 * 0003 is done` right after the run sentence, before any router tail, so callers never edit the text.
 */
export function runLine(numbers: readonly string[], asRouter = false, board = DEFAULT_BOARD, waitFor: readonly string[] = []): string {
  const head = numbers.slice(0, -1).join(', ')
  const line = numbers.length === 1 ? `Run ticket ${numbers[0]}` : `Run tickets ${head} and ${numbers[numbers.length - 1]}`
  const wait = waitFor.length === 0 ? '' : ` — but only once ${waitFor.join(', ')} ${waitFor.length === 1 ? 'is' : 'are'} done`
  if (asRouter) return `${line}${wait}${wait === '' ? '' : ' —'}${routerTail(board)}`
  return board === DEFAULT_BOARD ? `${line}${wait}.` : `${line} (board: ${board})${wait}.`
}

/** Makes a run line work in any session: the router already is one, any other session takes the role from the file. */
export function routerTail(board = DEFAULT_BOARD): string {
  const which = board === DEFAULT_BOARD ? '' : ` The board is ${board} and the ticket folders are in ${board.replace(/\/?BOARD\.md$/, '') || '.'}/.`
  return ` as the router. If this session is not already the router, first read .claude/agents/router.md and follow it exactly: dispatch worker and checker agents, update ${board}, and never write the code yourself.${which} A ticket moves to in-check only after its worker has updated README.md and the docs listed under ## Docs in its rd.md.`
}

/**
 * A slash command the pane fills (`/ticket`, brainstorm, design, planning), with the board named the
 * way `runLine` names it so the skill acts on the board the pane shows. With the default board the
 * command reads as it always has.
 */
export function withBoard(command: string, board = DEFAULT_BOARD): string {
  return board === DEFAULT_BOARD ? command : `${command} (board: ${board})`
}

export function today(nowMs: number): string {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * The Notes column conventions; templates/BOARD.md and .claude/agents/router.md list the same ones.
 * A one-word outcome comes only from the prefix a note starts with (case does not matter), never
 * from a word further in: "merged f681c3c (local…)" → Merged, "done after red tests in round 2" →
 * no badge. The full notes live on the ticket page.
 */
export const NOTE_PREFIXES: readonly { prefix: string; label: string; hue: string }[] = [
  { prefix: 'merged ', label: 'Merged', hue: 'green' },
  { prefix: 'failed:', label: 'Failing', hue: 'red' },
  { prefix: 'blocked:', label: 'Blocked', hue: 'red' },
  { prefix: 'dropped:', label: 'Dropped', hue: 'slate' },
  { prefix: 'decided:', label: 'Decided', hue: 'violet' },
  { prefix: 'moved from GitHub issue', label: 'From GitHub', hue: 'sky' },
]
/** `hue` names a color of the pane's palette (HUE in hooks/glass.tsx), so it follows the color scheme. */
export function resultOf(notes: string): { label: string; hue: string } | undefined {
  const n = notes.trimStart().toLowerCase()
  const hit = NOTE_PREFIXES.find(p => n.startsWith(p.prefix.toLowerCase()))
  return hit === undefined ? undefined : { label: hit.label, hue: hit.hue }
}

/** Every note the pane writes starts with this; the pane replaces only these (or an empty note), never a router's or a person's. */
export const PANE_NOTE_PREFIX = 'AI '

/** True for a note the pane owns: empty, or carrying the pane's exact prefix ("AI-reviewed by router" is not one). */
export function isPaneNote(notes: string): boolean {
  return notes.trim() === '' || notes.startsWith(PANE_NOTE_PREFIX)
}

/** The text as a pane note: the pane's prefix in front, unless it already has it. */
export function paneNote(text: string): string {
  return text.startsWith(PANE_NOTE_PREFIX) ? text : `${PANE_NOTE_PREFIX}${text}`
}

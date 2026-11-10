// Numbering, slugs, filtering and sorting — pure helpers.
import { statusRank } from './board'

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
export const SORT_OPTIONS = ['number', 'number-desc', 'status', 'questions', 'updated', 'title', 'kind', 'mode'] as const
export type Sort = (typeof SORT_OPTIONS)[number]
export const MODE_OPTIONS = ['any', 'solo', 'team'] as const
export type ModeFilter = (typeof MODE_OPTIONS)[number]

export const KINDS = ['feature', 'bug', 'chore'] as const
export type Kind = (typeof KINDS)[number]
export const KIND_OPTIONS = ['any', ...KINDS] as const
export type KindFilter = (typeof KIND_OPTIONS)[number]

export type Filters = { show: Show; sort: Sort; mode: ModeFilter; search: string; kind: KindFilter; desc: boolean; hideDone?: boolean }
export const DEFAULT_FILTERS: Filters = { show: 'all', sort: 'number', mode: 'any', search: '', kind: 'any', desc: false, hideDone: false }

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
  }
}

export function query<T extends Item>(items: T[], f: Filters): T[] {
  const sorted = sortItems(items.filter(i => matches(i, f)), f.sort)
  return f.desc === true ? sorted.reverse() : sorted
}

/** Feature, bug or chore: an explicit `Type:` line in rd.md wins, else words in the title. */
export function kindOf(title: string, rd?: string): Kind {
  const m = rd === undefined ? null : /^\s*(?:\*\*)?type(?:\*\*)?\s*:\s*(?:\*\*)?\s*(feature|bug|chore)\b/im.exec(rd.split(/\r?\n/).slice(0, 12).join('\n'))
  if (m !== null) return m[1]!.toLowerCase() as Kind
  const t = title.toLowerCase()
  if (/\b(fix|fixes|bug|broken|crash|crashes|error|regression|fails?|failing|wrong|incorrect|not working|doesn'?t)\b/.test(t)) return 'bug'
  if (/\b(chore|refactor|rename|cleanup|clean up|bump|upgrade|migrate|ci|lint|docs?)\b/.test(t)) return 'chore'
  return 'feature'
}

/** `Run tickets 0011, 0013 and 0014.` */
export function runLine(numbers: readonly string[], asRouter = false): string {
  const head = numbers.slice(0, -1).join(', ')
  const line = numbers.length === 1 ? `Run ticket ${numbers[0]}` : `Run tickets ${head} and ${numbers[numbers.length - 1]}`
  return asRouter ? `${line}${ROUTER_TAIL}` : `${line}.`
}

/** Makes a run line work in any session: the router already is one, any other session takes the role from the file. */
export const ROUTER_TAIL =
  ' as the router. If this session is not already the router, first read .claude/agents/router.md and follow it exactly: dispatch worker and checker agents, update tickets/BOARD.md, and never write the code yourself.'

export function today(nowMs: number): string {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** A one-word outcome from a board row's notes ("merged f681c3c (local…)" → Merged); the full notes live on the ticket page. */
const RESULTS: [RegExp, string, string][] = [
  [/\bmerged\b/i, 'Merged', '#34D399'],
  [/\b(abandon|dropped|won'?t do|wontfix)/i, 'Dropped', '#94A3B8'],
  [/\b(fail|red|broken)\b/i, 'Failing', '#F87171'],
  [/\bblocked\b/i, 'Blocked', '#F87171'],
  [/\b(decided|scope)\b/i, 'Decided', '#A78BFA'],
  [/\bmoved from github issue\b/i, 'From GitHub', '#7DD3FC'],
]
export function resultOf(notes: string): { label: string; hex: string } | undefined {
  if (notes.trim() === '' || notes.trim() === '—') return undefined
  for (const [re, label, hex] of RESULTS) if (re.test(notes)) return { label, hex }
  return undefined
}

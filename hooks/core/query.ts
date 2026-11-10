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
export const SORT_OPTIONS = ['number', 'number-desc', 'status', 'questions', 'updated'] as const
export type Sort = (typeof SORT_OPTIONS)[number]
export const MODE_OPTIONS = ['any', 'solo', 'team'] as const
export type ModeFilter = (typeof MODE_OPTIONS)[number]

export type Filters = { show: Show; sort: Sort; mode: ModeFilter; search: string }
export const DEFAULT_FILTERS: Filters = { show: 'all', sort: 'number', mode: 'any', search: '' }

export type Item = {
  number: string
  title: string
  status: string
  mode: string
  owner: string
  notes: string
  openQuestions: number
  updatedMs: number
}

export function matches(item: Item, f: Filters): boolean {
  const s = item.status
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
  const q = f.search.trim().toLowerCase()
  if (q !== '') {
    const hay = `${item.number} ${item.title} ${item.notes} ${item.owner} ${item.status}`.toLowerCase()
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
  }
}

export function query<T extends Item>(items: T[], f: Filters): T[] {
  return sortItems(items.filter(i => matches(i, f)), f.sort)
}

/** `Run tickets 0011, 0013 and 0014.` */
export function runLine(numbers: readonly string[]): string {
  if (numbers.length === 1) return `Run ticket ${numbers[0]}.`
  const head = numbers.slice(0, -1).join(', ')
  return `Run tickets ${head} and ${numbers[numbers.length - 1]}.`
}

export function today(nowMs: number): string {
  const d = new Date(nowMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

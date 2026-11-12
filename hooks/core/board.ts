// Parsing and editing tickets/BOARD.md.
// Every edit rewrites one table line only; the rest of the file is kept byte for byte.

export const STATUSES = ['draft', 'ready', 'in-progress', 'in-check', 'done', 'blocked'] as const
export type Status = (typeof STATUSES)[number]

export type Column = 'number' | 'title' | 'status' | 'mode' | 'blockedBy' | 'owner' | 'notes'

export type BoardRow = {
  number: string
  title: string
  status: string
  mode: string
  blockedBy: string[]
  blockedByRaw: string
  owner: string
  notes: string
  /** 0-based line index in the file. */
  line: number
}

export type Board = {
  rows: BoardRow[]
  /** Column name → cell index (0-based, among the cells between the pipes). */
  columns: Partial<Record<Column, number>>
  headerLine: number
  /** Line index of the last table line (separator when there are no rows). */
  lastLine: number
  /** Cell widths of the header line (inner text width, padding excluded). */
  widths: number[]
  eol: string
}

const HEADER_NAMES: Record<string, Column> = {
  '#': 'number',
  'no': 'number',
  'number': 'number',
  'ticket': 'title',
  'title': 'title',
  'status': 'status',
  'mode': 'mode',
  'blocked by': 'blockedBy',
  'blocked-by': 'blockedBy',
  'owner': 'owner',
  'notes': 'notes',
}

/** Splits a table line on pipes that are not escaped, keeping each segment's raw text. */
export function rawSegments(line: string): string[] {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '\\|'
      i++
      continue
    }
    if (ch === '|') {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/** The cells of a table line (text between the outer pipes), trimmed and unescaped. */
export function cells(line: string): string[] {
  const seg = rawSegments(line.trim())
  return seg.slice(1, seg.length - 1).map(c => c.trim().replace(/\\\|/g, '|'))
}

export function isTableLine(line: string): boolean {
  return line.trim().startsWith('|')
}

function isSeparator(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-')
}

/** Ticket numbers in a Blocked by cell (or typed by a person), padded like row numbers. `—`, `none` and blank are []. */
export function parseBlockedBy(raw: string): string[] {
  const t = raw.trim()
  if (t === '' || /^(—|–|-|none|n\/a)$/i.test(t)) return []
  return (t.match(/\d{1,5}/g) ?? []).map(n => n.padStart(4, '0'))
}

/** The Blocked by cell for a list of ticket numbers: padded, comma-joined, `—` when empty. */
export function formatBlockedBy(numbers: readonly string[]): string {
  return numbers.length === 0 ? '—' : numbers.map(n => n.padStart(4, '0')).join(', ')
}

export function parseBoard(text: string): Board | undefined {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!isTableLine(line)) continue
    const head = cells(line).map(c => c.toLowerCase())
    const columns: Partial<Record<Column, number>> = {}
    head.forEach((h, idx) => {
      const col = HEADER_NAMES[h]
      if (col !== undefined && columns[col] === undefined) columns[col] = idx
    })
    if (columns.number === undefined || columns.status === undefined) continue
    if (!isSeparator(lines[i + 1] ?? '')) continue
    const widths = rawSegments(line.trim())
      .slice(1, -1)
      .map(s => Math.max(s.trim().length, s.length - 2))
    const rows: BoardRow[] = []
    let last = i + 1
    for (let j = i + 2; j < lines.length; j++) {
      const l = lines[j] ?? ''
      if (!isTableLine(l)) break
      last = j
      const c = cells(l)
      const get = (col: Column) => (columns[col] === undefined ? '' : (c[columns[col]!] ?? ''))
      const num = get('number').replace(/^#/, '')
      if (!/^\d{1,5}$/.test(num)) continue
      const blockedByRaw = get('blockedBy')
      rows.push({
        number: num.padStart(4, '0'),
        title: get('title'),
        status: get('status').toLowerCase(),
        mode: get('mode'),
        blockedBy: parseBlockedBy(blockedByRaw),
        blockedByRaw,
        owner: get('owner'),
        notes: get('notes'),
        line: j,
      })
    }
    return { rows, columns, headerLine: i, lastLine: last, widths, eol }
  }
  return undefined
}

export function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/(?<!\\)\|/g, '\\|').trim()
}

/** Replaces one cell's text in a raw table line, keeping the line's spacing style. */
export function replaceCell(line: string, index: number, value: string): string {
  const lead = line.match(/^\s*/)?.[0] ?? ''
  const seg = rawSegments(line.slice(lead.length))
  const at = index + 1
  const old = seg[at]
  if (old === undefined) return line
  const v = escapeCell(value)
  const inner = old.replace(/^ /, '').replace(/ $/, '')
  const padded = inner.trimEnd().length < inner.length && v.length <= inner.length ? v.padEnd(inner.length) : v
  seg[at] = ` ${padded} `
  return lead + seg.join('|')
}

export class BoardEditError extends Error {}

/** Cell edits for one row. Blocked by takes ticket numbers; the board module writes its cell format. */
export type CellChanges = Partial<Record<Exclude<Column, 'blockedBy'>, string>> & { blockedBy?: readonly string[] }

/** Header label of each column, for messages about a column the board does not have. */
export const COLUMN_LABEL: Record<Column, string> = {
  number: '#',
  title: 'Ticket',
  status: 'Status',
  mode: 'Mode',
  blockedBy: 'Blocked by',
  owner: 'Owner',
  notes: 'Notes',
}

/**
 * Sets cells of ticket `number`'s row. `expectStatus`, when given, must match the
 * row's current status or the edit is refused (someone else moved it meanwhile).
 * Returns the new text and the columns it could not write because the board has no such column.
 */
export function setCells(
  text: string,
  number: string,
  changes: CellChanges,
  expectStatus?: string,
): { text: string; skipped: Column[] } {
  const board = parseBoard(text)
  if (board === undefined) throw new BoardEditError('No ticket table found in BOARD.md')
  const row = board.rows.find(r => r.number === number)
  if (row === undefined) throw new BoardEditError(`Ticket ${number} is no longer on the board`)
  if (expectStatus !== undefined && row.status !== expectStatus)
    throw new BoardEditError(`Ticket ${number} moved to ${row.status} meanwhile`)
  const lines = text.split(/\r?\n/)
  let line = lines[row.line] ?? ''
  const skipped: Column[] = []
  for (const [col, value] of Object.entries(changes) as [Column, string | readonly string[] | undefined][]) {
    if (value === undefined) continue
    const idx = board.columns[col]
    if (idx === undefined) {
      skipped.push(col)
      continue
    }
    line = replaceCell(line, idx, typeof value === 'string' ? value : formatBlockedBy(value))
  }
  if (skipped.length > 0 && line === lines[row.line]) return { text, skipped }
  lines[row.line] = line
  return { text: lines.join(board.eol), skipped }
}

export type NewRow = {
  number: string
  title: string
  status: string
  mode: string
  blockedBy: string[]
  owner?: string
  notes?: string
}

/** Appends a row after the last table line, padded like the header. */
export function addRow(text: string, row: NewRow): string {
  const board = parseBoard(text)
  if (board === undefined) throw new BoardEditError('No ticket table found in BOARD.md')
  if (board.rows.some(r => r.number === row.number))
    throw new BoardEditError(`Ticket ${row.number} is already on the board`)
  const values: Record<Column, string> = {
    number: row.number,
    title: row.title,
    status: row.status,
    mode: row.mode,
    blockedBy: formatBlockedBy(row.blockedBy),
    owner: row.owner ?? '—',
    notes: row.notes ?? '',
  }
  const count = board.widths.length
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const col = (Object.keys(board.columns) as Column[]).find(c => board.columns[c] === i)
    const v = escapeCell(col === undefined ? '' : values[col])
    out.push(` ${v.padEnd(board.widths[i] ?? 0)} `)
  }
  const line = `|${out.join('|')}|`
  const lines = text.split(/\r?\n/)
  lines.splice(board.lastLine + 1, 0, line)
  return lines.join(board.eol)
}

/** Status order used for sorting and the counts strip. */
export function statusRank(status: string): number {
  const i = (STATUSES as readonly string[]).indexOf(status)
  return i === -1 ? STATUSES.length : i
}

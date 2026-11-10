// The desktop look: one dark "liquid glass" container that paints its own
// background, frosted cards inside it, and an SVG hero. The terminal keeps the
// plain theme-colored look.
import type { RenderChildren } from 'claude-code'

import type { UI } from './views'

export const G = {
  /** The container's own backdrop, so the pane never depends on the app's theme. */
  base: '#0A0F1E',
  ink: '#EEF2FF',
  soft: '#A5B4CF',
  faint: '#6B7A99',
  accent: '#7DD3FC',
  card: 'rgba(255,255,255,0.055)',
  cardHover: 'rgba(255,255,255,0.11)',
  edge: 'rgba(255,255,255,0.14)',
  edgeHover: 'rgba(125,211,252,0.55)',
}

export const STATUS_HEX: Record<string, string> = {
  draft: '#FBBF24',
  ready: '#34D399',
  'in-progress': '#60A5FA',
  'in-check': '#C084FC',
  done: '#94A3B8',
  blocked: '#F87171',
  unlisted: '#F87171',
}

/** Theme keys the views use, mapped onto the glass palette. */
const KEY_HEX: Record<string, string> = {
  text: G.ink,
  subtle: G.soft,
  suggestion: '#60A5FA',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  permission: '#C084FC',
  claude: '#FDBA74',
  merged: '#C084FC',
  planMode: '#5EEAD4',
  promptBorder: G.edge,
}

export const tint = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Wraps the surface's elements so every Text is readable on the glass backdrop
 * (default ink color, theme keys mapped to the glass palette) and Markdown is
 * drawn as glass-colored text.
 */
export function glassUI(ui: UI): UI {
  const color = (c: unknown) => (typeof c === 'string' ? (KEY_HEX[c] ?? c) : G.ink)
  const Text = ((p: Record<string, unknown>) => {
    const dim = p.dimColor === true
    const { dimColor: _d, ...rest } = p
    return ui.Text({ ...rest, color: dim && p.color === undefined ? G.soft : color(p.color) } as never)
  }) as unknown as UI['Text']
  const Box = ((p: Record<string, unknown>) => {
    const hover = p.hover as { backgroundColor?: string } | undefined
    const fix = (c: unknown) => (typeof c === 'string' && c in KEY_HEX ? (c === 'promptBorder' ? G.cardHover : KEY_HEX[c]) : c)
    return ui.Box({
      ...p,
      ...(p.backgroundColor !== undefined ? { backgroundColor: fix(p.backgroundColor) } : {}),
      ...(p.borderColor !== undefined ? { borderColor: fix(p.borderColor) } : {}),
      ...(hover?.backgroundColor !== undefined ? { hover: { ...hover, backgroundColor: fix(hover.backgroundColor) } } : {}),
    } as never)
  }) as unknown as UI['Box']
  const Markdown = ((p: { key?: string; text: string }) => ui.Box({ flexDirection: 'column', gap: 1, children: markdown(ui, p.text) } as never)) as unknown as UI['Markdown']
  return { ...ui, Text, Box, Markdown }
}

/** A small markdown reader for the glass look: headings, paragraphs (hard-wrapped lines joined), "Label: text" leads, decision callouts, lists, quotes, tables, code, inline `code` (status names as pills), **bold**, *italic* and [links](url). */
export function markdown(ui: UI, text: string): RenderChildren {
  const { Text, Box } = ui
  const out: RenderChildren[] = []
  const inline = (s: string, base: string) =>
    s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map(part => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const word = part.slice(1, -1)
        const hex = STATUS_HEX[word]
        return hex !== undefined
          ? ui.Text({ color: hex, backgroundColor: tint(hex, 0.16), weight: 'semibold', children: ` ${word} ` } as never)
          : ui.Text({ color: G.accent, mono: true, backgroundColor: 'rgba(125,211,252,0.08)', children: ` ${word} ` } as never)
      }
      if (part.startsWith('**') && part.endsWith('**')) return ui.Text({ color: G.ink, weight: 'semibold', children: part.slice(2, -2) } as never)
      if (/^\[[^\]]+\]\([^)]+\)$/.test(part)) return ui.Text({ color: G.accent, underline: true, children: part.slice(1, part.indexOf(']')) } as never)
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return ui.Text({ color: base, italic: true, children: part.slice(1, -1) } as never)
      return ui.Text({ color: base, children: part } as never)
    })

  /** "Decision 2026-11-09 (human): …" / "Status flow: …" → a bold lead and the rest. */
  const lead = (p: string) => {
    const m = /^([A-Z][\w ./-]{0,40}?(?: \d{4}-\d{2}-\d{2})?(?: \([^)]{1,30}\))?):\s+(.*)$/s.exec(p)
    return m === null ? undefined : { label: m[1]!, rest: m[2]! }
  }

  const paragraph = (p: string): void => {
    const io = /^In:\s+(.*?)\s+Out:\s+(.*)$/s.exec(p)
    if (io !== null) {
      out.push(
        <Box flexDirection="row" gap={2} flexWrap="wrap">
          {[['IN SCOPE', io[1]!, STATUS_HEX.ready!], ['OUT OF SCOPE', io[2]!, STATUS_HEX.blocked!]].map(([label, body, hex]) => (
            <Box flexDirection="column" flexGrow={1} width="48%" minWidth={24} backgroundColor={tint(hex!, 0.06)} borderStyle="round" borderColor={tint(hex!, 0.35)} paddingX={2} paddingY={1}>
              <Text color={hex} size="caption" weight="bold">
                {label}
              </Text>
              <Text>{inline(body!, G.ink)}</Text>
            </Box>
          ))}
        </Box>,
      )
      return
    }
    // "(moved from GitHub issue #4; …)" — an aside.
    if (/^\(.*\)$/s.test(p)) {
      out.push(
        <Text color={G.faint} size="footnote" italic>
          {p.slice(1, -1)}
        </Text>,
      )
      return
    }
    const l = lead(p)
    if (l !== undefined && /^(decision|decided|note|warning|important|todo)\b/i.test(l.label)) {
      const warn = /^(warning|important|todo)/i.test(l.label)
      const hex = warn ? STATUS_HEX.draft! : '#A78BFA'
      out.push(
        <Box flexDirection="column" backgroundColor={tint(hex, 0.08)} borderStyle="round" borderColor={tint(hex, 0.45)} paddingX={2} paddingY={1}>
          <Text color={hex} size="footnote" weight="bold">
            {l.label.toUpperCase()}
          </Text>
          <Text>{inline(l.rest, G.ink)}</Text>
        </Box>,
      )
      return
    }
    if (l !== undefined) {
      out.push(
        <Box flexDirection="column">
          <Text color={G.faint} size="caption" weight="bold">
            {l.label.toUpperCase()}
          </Text>
          <Text>{inline(l.rest, G.ink)}</Text>
        </Box>,
      )
      return
    }
    out.push(<Text>{inline(p, G.soft)}</Text>)
  }

  let para: string[] = []
  type Li = { depth: number; bullet: string; text: string }
  let list: Li[] = []
  let table: string[][] = []
  const item = (l: Li) => {
    const box = /^\[( |x|X)\]\s+(.*)$/s.exec(l.text)
    const checked = box !== null && box[1] !== ' '
    const mark = box === null ? l.bullet : checked ? '☑' : '☐'
    const hex = box === null ? G.accent : checked ? STATUS_HEX.ready! : G.soft
    return (
      <Box flexDirection="row" gap={1} paddingLeft={1 + l.depth * 2}>
        <Text color={hex}>{mark}</Text>
        <Box flexShrink={1}>
          <Text>{inline(box === null ? l.text : box[2]!, checked ? G.soft : G.ink)}</Text>
        </Box>
      </Box>
    )
  }
  const grid = (rows: string[][]) => {
    const cols = Math.max(...rows.map(r => r.length))
    const w = `${Math.floor(100 / cols)}%`
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={G.edge}>
        {rows.map((r, n) => (
          <Box flexDirection="row" paddingX={1} paddingY={n === 0 ? 1 : 0} backgroundColor={n === 0 ? 'rgba(255,255,255,0.05)' : n % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0)'}>
            {Array.from({ length: cols }, (_, c) => (
              <Box width={w} paddingRight={1} flexShrink={0}>
                {n === 0 ? (
                  <Text color={G.faint} size="caption" weight="bold">
                    {(r[c] ?? '').replace(/[`*]/g, '').toUpperCase()}
                  </Text>
                ) : (
                  <Text>{inline(r[c] ?? '', G.ink)}</Text>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  }
  const flush = () => {
    if (para.length > 0) paragraph(para.join(' '))
    para = []
    if (list.length > 0) out.push(<Box flexDirection="column" gap={0}>{list.map(item)}</Box>)
    list = []
    if (table.length > 0) out.push(grid(table))
    table = []
  }
  let code: string[] | undefined
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (line.startsWith('```')) {
      if (code === undefined) {
        flush()
        code = []
      } else {
        out.push(
          <Box flexDirection="column" backgroundColor="rgba(0,0,0,0.3)" borderStyle="round" borderColor={G.edge} paddingX={2} paddingY={1}>
            {code.map(c => (
              <Text color={G.accent} mono size="footnote">
                {c === '' ? ' ' : c}
              </Text>
            ))}
          </Box>,
        )
        code = undefined
      }
      continue
    }
    if (code !== undefined) {
      code.push(line)
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    const hd = /^(#{1,6})\s+(.*)$/.exec(line)
    if (hd) {
      flush()
      const level = hd[1]!.length
      out.push(
        <Box paddingTop={level <= 2 ? 1 : 0}>
          <Text color={level === 1 ? G.ink : G.accent} size={level === 1 ? 'title' : level === 2 ? 'heading' : 'body'} weight="semibold">
            {hd[2]!.replace(/[`*]/g, '')}
          </Text>
        </Box>,
      )
      continue
    }
    if (/^\s*\|/.test(line)) {
      if (table.length === 0) flush()
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue
      table.push(line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
      continue
    }
    if (table.length > 0) flush()
    if (/^\s*>/.test(line)) {
      flush()
      out.push(
        <Box paddingLeft={2} backgroundColor="rgba(255,255,255,0.03)">
          <Text color={G.soft} italic>
            {line.replace(/^\s*>\s?/, '')}
          </Text>
        </Box>,
      )
      continue
    }
    const li = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line)
    if (li) {
      if (para.length > 0) flush()
      list.push({ depth: Math.floor(li[1]!.length / 2), bullet: /\d/.test(li[2]!) ? li[2]! : '•', text: li[3]! })
      continue
    }
    // An indented line under a list item is that item's wrapped tail.
    if (list.length > 0 && /^\s+\S/.test(line)) {
      list[list.length - 1]!.text += ` ${line.trim()}`
      continue
    }
    // A line that only continues the sentence above ("(any status → …)") joins it; a list item's wrapped tail joins nothing.
    if (list.length > 0) flush()
    para.push(line.trim())
  }
  if (code !== undefined) para.push(...code)
  flush()
  return out
}

export type HeroInput = {
  title: string
  path: string
  counts: ReadonlyArray<readonly [string, number]>
  total: number
  done: number
  needsMe: number
}

/** The frosted hero card: drifting aurora blobs behind glass, the board's counts as pills, and a progress ring. */
export function heroSvg(h: HeroInput): string {
  const W = 640
  const H = 196
  const pct = h.total === 0 ? 0 : h.done / h.total
  const R = 34
  const C = 2 * Math.PI * R
  let x = 32
  const pills = h.counts
    .map(([s, n]) => {
      const label = `${s} ${n}`
      const w = 34 + [...label].reduce((a, ch) => a + (/[ilrtf\-. ]/.test(ch) ? 4.2 : /[0-9]/.test(ch) ? 7.6 : 7.4), 0)
      const c = STATUS_HEX[s] ?? G.accent
      const pill = `<g transform="translate(${x.toFixed(1)},136)">
  <rect width="${w.toFixed(1)}" height="28" rx="14" fill="${tint(c, 0.16)}" stroke="${tint(c, 0.55)}"/>
  <circle cx="13" cy="14" r="3.5" fill="${c}"/>
  <text x="22" y="18.5" fill="${c}" font-size="12.5" font-weight="600">${esc(label)}</text>
</g>`
      x += w + 8
      return x > W - 150 ? '' : pill
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', sans-serif">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#111a35"/><stop offset="1" stop-color="#0a0f1e"/>
  </linearGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="34"/></filter>
  <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.03"/>
  </linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.65"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0.45"/>
  </linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#7dd3fc"/>
  </linearGradient>
  <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7d2fe"/>
  </linearGradient>
  <clipPath id="card"><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="26"/></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="30" fill="url(#bg)"/>
<g clip-path="url(#card)" filter="url(#blur)" opacity="0.95">
  <circle cx="120" cy="40" r="90" fill="#6366f1"><animate attributeName="cx" values="120;190;120" dur="14s" repeatCount="indefinite"/></circle>
  <circle cx="520" cy="60" r="100" fill="#06b6d4"><animate attributeName="cy" values="60;130;60" dur="11s" repeatCount="indefinite"/></circle>
  <circle cx="340" cy="190" r="90" fill="#ec4899" opacity="0.75"><animate attributeName="cx" values="340;260;340" dur="16s" repeatCount="indefinite"/></circle>
  <circle cx="600" cy="200" r="70" fill="#22c55e" opacity="0.5"><animate attributeName="r" values="70;95;70" dur="9s" repeatCount="indefinite"/></circle>
</g>
<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="26" fill="url(#glass)" stroke="url(#rim)" stroke-width="1.2"/>
<path d="M38 13 H${W - 38}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1"/>
<text x="32" y="58" fill="#a5b4cf" font-size="12" font-weight="600" letter-spacing="2.2">TICKET BOARD</text>
<text x="32" y="94" fill="url(#title)" font-size="30" font-weight="700" letter-spacing="-0.5">${esc(h.title)}</text>
<text x="32" y="118" fill="#a5b4cf" font-size="12.5" font-family="ui-monospace, 'SF Mono', Menlo, monospace">${esc(h.path)} · ${h.total} ticket${h.total === 1 ? '' : 's'}${h.needsMe > 0 ? ` · ${h.needsMe} need you` : ''}</text>
${pills}
<g transform="translate(${W - 84},${H / 2})">
  <circle r="${R + 12}" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.18"/>
  <circle r="${R}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="7"/>
  <circle r="${R}" fill="none" stroke="url(#ring)" stroke-width="7" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}">
    <animate attributeName="stroke-dasharray" from="0 ${C.toFixed(1)}" to="${(C * pct).toFixed(1)} ${C.toFixed(1)}" dur="1.2s" fill="freeze"/>
  </circle>
  <text y="5" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="700">${Math.round(pct * 100)}%</text>
  <text y="22" text-anchor="middle" fill="#a5b4cf" font-size="9.5" letter-spacing="1.2">DONE</text>
</g>
</svg>`
}

/** A thin glass status bar: one segment per status, sized by its share of the board. */
export function barSvg(counts: ReadonlyArray<readonly [string, number]>, total: number): string {
  const W = 640
  let x = 0
  const segs = counts
    .map(([s, n]) => {
      const w = total === 0 ? 0 : (n / total) * W
      const r = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, w - 3).toFixed(1)}" height="6" rx="3" fill="${STATUS_HEX[s] ?? G.accent}" fill-opacity="0.85"/>`
      x += w
      return r
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="6" viewBox="0 0 ${W} 6"><rect width="${W}" height="6" rx="3" fill="#ffffff" fill-opacity="0.06"/>${segs}</svg>`
}

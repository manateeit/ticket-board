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
  const Markdown = ((p: { key?: string; text: string }) => ui.Box({ flexDirection: 'column', children: markdown(ui, p.text) } as never)) as unknown as UI['Markdown']
  return { ...ui, Text, Box, Markdown }
}

/** A small markdown reader for the glass look: headings, lists, quotes, tables, code, inline `code` and **bold**. */
export function markdown(ui: UI, text: string): RenderChildren {
  const { Text, Box } = ui
  const out: RenderChildren[] = []
  let code = false
  const inline = (s: string, base: string) =>
    s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map(part =>
      part.startsWith('`') && part.endsWith('`')
        ? ui.Text({ color: G.accent, mono: true, children: part.slice(1, -1) } as never)
        : part.startsWith('**') && part.endsWith('**')
          ? ui.Text({ color: G.ink, bold: true, children: part.slice(2, -2) } as never)
          : ui.Text({ color: base, children: part } as never),
    )
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (line.startsWith('```')) {
      code = !code
      continue
    }
    if (code) {
      out.push(<Text color={G.accent} mono>{line === '' ? ' ' : line}</Text>)
      continue
    }
    if (line.trim() === '') continue
    const hd = /^(#{1,6})\s+(.*)$/.exec(line)
    if (hd) {
      const level = hd[1]!.length
      out.push(
        <Box paddingTop={level <= 2 ? 1 : 0}>
          <Text color={level === 1 ? G.ink : G.accent} bold size={level === 1 ? 'title' : level === 2 ? 'heading' : 'body'} weight="semibold">
            {hd[2]!.replace(/[`*]/g, '')}
          </Text>
        </Box>,
      )
      continue
    }
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue
      out.push(<Text color={G.soft} mono wrap="truncate">{line.trim()}</Text>)
      continue
    }
    if (/^\s*>/.test(line)) {
      out.push(
        <Box paddingLeft={2}>
          <Text color={G.soft} italic>
            {line.replace(/^\s*>\s?/, '')}
          </Text>
        </Box>,
      )
      continue
    }
    const li = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line)
    if (li) {
      const bullet = /\d/.test(li[2]!) ? li[2]! : '•'
      out.push(
        <Box flexDirection="row" gap={1} paddingLeft={2 + Math.floor(li[1]!.length / 2) * 2}>
          <Text color={G.accent}>{bullet}</Text>
          <Box flexShrink={1}>
            <Text>{inline(li[3]!, G.ink)}</Text>
          </Box>
        </Box>,
      )
      continue
    }
    out.push(<Text>{inline(line, G.soft)}</Text>)
  }
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

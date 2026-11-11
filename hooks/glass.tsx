// The desktop look: one dark "liquid glass" container that paints its own
// background, frosted cards inside it, and an SVG hero. The terminal keeps the
// plain theme-colored look.
import type { RenderChildren } from 'claude-code'

import type { UI } from './views'

/** Accent hues per glass: pastel on the dark glass, Tailwind 700-800 tones that keep 4.5:1 on white and on slate-100. */
const HUES = {
  dark: { amber: '#FBBF24', green: '#34D399', blue: '#60A5FA', purple: '#C084FC', slate: '#94A3B8', red: '#F87171', violet: '#A78BFA', rose: '#FB7185', orange: '#FDBA74', teal: '#5EEAD4', sky: '#7DD3FC' },
  light: { amber: '#92400E', green: '#166534', blue: '#4338CA', purple: '#7E22CE', slate: '#475569', red: '#B91C1C', violet: '#6D28D9', rose: '#BE123C', orange: '#9A3412', teal: '#115E59', sky: '#075985' },
}

const SURFACES = {
  dark: {
    /** The container's own backdrop, so the pane never depends on the app's theme. */
    base: '#0A0F1E',
    ink: '#EEF2FF',
    soft: '#A5B4CF',
    faint: '#8A99B8',
    accent: '#7DD3FC',
    card: 'rgba(255,255,255,0.055)',
    cardHover: 'rgba(255,255,255,0.11)',
    edge: 'rgba(255,255,255,0.14)',
    edgeHover: 'rgba(125,211,252,0.55)',
    /** Overlay color for row stripes and inset panels. */
    wash: '255,255,255',
    /** How strongly a status pill is tinted behind its label. */
    chip: 0.16,
  },
  /** The light glass (0019): slate-100 ground, white cards with slate-200 borders, slate-900 text, an indigo accent. */
  light: {
    base: '#F1F5F9',
    ink: '#0F172A',
    soft: '#334155',
    faint: '#475569',
    accent: '#4F46E5',
    card: '#FFFFFF',
    cardHover: '#EEF2FF',
    edge: '#E2E8F0',
    edgeHover: 'rgba(79,70,229,0.55)',
    wash: '15,23,42',
    chip: 0.08,
  },
}

/** The Colors setting: `auto` (shown as "app") follows the Claude app's light or dark mode; `dark` and `light` fix the glass. */
export type Scheme = 'auto' | 'dark' | 'light'
export const SCHEMES: Scheme[] = ['auto', 'dark', 'light']
/** The glass actually drawn. */
export type Look = 'dark' | 'light'

/**
 * The palette views read at draw time: the chosen scheme, the glass it draws (`look`) and the app's
 * own mode (`isAppLight`, from the app's `theme` setting; dark until known).
 */
export const G = { ...SURFACES.dark, scheme: 'auto' as Scheme, look: 'dark' as Look, isAppLight: false }
export const HUE = { ...HUES.dark }

const statusHex = () => ({
  draft: HUE.amber,
  ready: HUE.green,
  'in-progress': HUE.blue,
  'in-check': HUE.purple,
  // On the light glass Done is an emerald chip (emerald-800: the mockup's #047857 falls just under 4.5:1 on a striped row); on the dark glass a quiet slate.
  done: G.look === 'light' ? '#065F46' : HUE.slate,
  blocked: HUE.red,
  unlisted: HUE.red,
})
export const STATUS_HEX: Record<string, string> = statusHex()

/** Theme keys the views use, mapped onto the glass palette. */
const keyHex = (): Record<string, string> => ({
  text: G.ink,
  subtle: G.soft,
  inactive: G.faint,
  suggestion: HUE.blue,
  success: HUE.green,
  warning: HUE.amber,
  error: HUE.red,
  permission: HUE.purple,
  claude: HUE.orange,
  merged: HUE.purple,
  planMode: HUE.teal,
  promptBorder: G.edge,
})
let KEY_HEX = keyHex()

/** The app's theme setting names its mode: `light`, `light-daltonized`, … are light; anything else (or nothing) is dark. */
export const isLightTheme = (value: unknown) => typeof value === 'string' && value.startsWith('light')

/** The glass a scheme draws: `auto` follows the app. */
export const lookOf = (scheme: Scheme, isAppLight: boolean): Look => (scheme === 'auto' ? (isAppLight ? 'light' : 'dark') : scheme)

/** Switches every palette in place; views read G / HUE / STATUS_HEX at draw time. */
export function setScheme(scheme: Scheme, isAppLight = false) {
  const look = lookOf(scheme, isAppLight)
  Object.assign(G, SURFACES[look], { scheme, look, isAppLight })
  Object.assign(HUE, HUES[look])
  Object.assign(STATUS_HEX, statusHex())
  KEY_HEX = keyHex()
}

/**
 * The desktop draws its own controls (Button, Link, Select, Input) in the app's colors, made for the
 * app's own ground. They need a plate only where the glass and the app disagree: light glass in a
 * dark app, or dark glass in a light app.
 */
export const needsPlate = () => (G.look === 'light') !== G.isAppLight

/** A plate in the app's ground: slate-700 under a dark app, white with a slate-300 border under a light one. */
const PLATE = {
  dark: { backgroundColor: '#334155', borderColor: '#475569', ink: '#F1F5F9', soft: '#CBD5E1' },
  light: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', ink: '#0F172A', soft: '#475569' },
}
const plateOf = () => PLATE[G.isAppLight ? 'light' : 'dark']

/** Text color inside a control group: the plate's when there is one, else the glass's. */
export const groupInk = (soft = false) => (needsPlate() ? (soft ? plateOf().soft : plateOf().ink) : soft ? G.faint : G.ink)

const plateStyle = () => {
  const p = plateOf()
  return { backgroundColor: p.backgroundColor, borderStyle: 'round', borderColor: p.borderColor, paddingX: 1 }
}

/** The elements the desktop draws as its own controls, in the app's colors. */
const CONTROLS = new Set(['Button', 'Link', 'Select', 'Input'])
type El = { type?: unknown; props?: Record<string, unknown> }
const isControl = (c: unknown): c is El => typeof c === 'object' && c !== null && CONTROLS.has((c as El).type as string)
/** A primary Button is the host's filled button: its own fill and label, readable on any ground. */
const isFilled = (c: El) => c.type === 'Button' && c.props?.variant === 'primary' && c.props?.plain !== true
const flat = (c: unknown): unknown[] => (Array.isArray(c) ? c.flatMap(flat) : c === null || c === undefined || c === false || c === true || c === '' ? [] : [c])

/**
 * One group of the app's controls that spans table cells (the sort headers, a row's actions).
 * Where glass and app disagree it sits on ONE rounded plate in the app's ground, its padding and
 * gap inside; where they agree it is a plain Box with the same layout, no plate. Its key starts
 * with `plate-`, so the glass Box leaves its insides alone.
 */
export function Plate(ui: UI, key: string, children: RenderChildren, layout: Record<string, unknown> = {}) {
  return ui.Box({ key: `plate-${key}`, ...layout, ...(needsPlate() ? plateStyle() : {}), children } as never)
}

/** A see-through layer for stripes and insets: white on dark, ink on light. */
export const wash = (alpha: number) => `rgba(${G.wash},${G.look === 'dark' ? alpha : Math.min(1, alpha * 1.6)})`

export const tint = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Where glass and app disagree, the app's controls in a Box are grouped onto plates: a Box that
 * holds only controls becomes one plate; in a Box that mixes them with text, each run of adjacent
 * controls goes on one plate, laid out as the Box lays out its children. Never one plate per
 * button of a group. A Box with a fixed `width` is a table cell (its row draws its own group, see
 * `Plate`), and a `plate-` Box is already a plate: both are left alone.
 */
function plated(ui: UI, p: Record<string, unknown>): Record<string, unknown> {
  if (!needsPlate() || p.width !== undefined || (typeof p.key === 'string' && p.key.startsWith('plate-'))) return p
  const kids = flat(p.children)
  const controls = kids.filter(isControl)
  if (controls.length === 0 || controls.every(isFilled)) return p
  if (controls.length === kids.length) return { ...p, ...plateStyle() }
  const out: unknown[] = []
  let run: El[] = []
  const flush = () => {
    if (run.length > 0 && !run.every(isFilled)) {
      const first = run[0]!.props ?? {}
      const name = String(first.key ?? first.label ?? out.length)
      out.push(
        ui.Box({
          key: `plate-${name}`,
          flexDirection: p.flexDirection ?? 'row',
          ...(p.flexDirection === 'column' ? {} : { alignItems: 'center' }),
          ...(p.flexWrap !== undefined ? { flexWrap: p.flexWrap } : {}),
          gap: p.gap ?? 1,
          flexShrink: 0,
          ...plateStyle(),
          children: run,
        } as never),
      )
    } else out.push(...run)
    run = []
  }
  for (const k of kids) {
    if (isControl(k)) run.push(k)
    else {
      flush()
      out.push(k)
    }
  }
  flush()
  return { ...p, children: out }
}

/**
 * Wraps the surface's elements so every Text is readable on the glass backdrop
 * (default ink color, theme keys mapped to the glass palette) and Markdown is
 * drawn as glass-colored text. The app's own controls have no plate of their own
 * (0019): only where glass and app disagree does each group of them get one (`plated`).
 */
export function glassUI(ui: UI): UI {
  const color = (c: unknown) => (typeof c !== 'string' ? G.ink : (KEY_HEX[c] ?? c))
  const Text = ((p: Record<string, unknown>) => {
    const dim = p.dimColor === true
    const { dimColor: _d, ...rest } = p
    return ui.Text({ ...rest, color: dim && p.color === undefined ? G.soft : color(p.color) } as never)
  }) as unknown as UI['Text']
  const Box = ((given: Record<string, unknown>) => {
    const p = plated(ui, given)
    const hover = p.hover as { backgroundColor?: string } | undefined
    const fix = (c: unknown) => (typeof c === 'string' && c in KEY_HEX ? (c === 'promptBorder' ? G.cardHover : KEY_HEX[c]) : c)
    return ui.Box({
      ...p,
      ...(p.backgroundColor !== undefined ? { backgroundColor: fix(p.backgroundColor) } : {}),
      ...(p.borderColor !== undefined ? { borderColor: fix(p.borderColor) } : {}),
      ...(hover?.backgroundColor !== undefined ? { hover: { ...hover, backgroundColor: fix(hover.backgroundColor) } } : {}),
    } as never)
  }) as unknown as UI['Box']
  const Markdown = ((p: { key?: string; text: string }) => ui.Box({ flexDirection: 'column', gap: 1, children: markdown({ ...ui, Text, Box }, p.text) } as never)) as unknown as UI['Markdown']
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
          ? ui.Text({ color: hex, backgroundColor: tint(hex, G.chip), weight: 'semibold', children: ` ${word} ` } as never)
          : ui.Text({ color: G.accent, mono: true, backgroundColor: tint(G.accent, 0.08), children: ` ${word} ` } as never)
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
      const hex = warn ? STATUS_HEX.draft! : HUE.violet
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
          <Box flexDirection="row" paddingX={1} paddingY={n === 0 ? 1 : 0} backgroundColor={n === 0 ? wash(0.05) : n % 2 === 0 ? wash(0.02) : wash(0)}>
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
          <Box flexDirection="column" backgroundColor={G.look === 'dark' ? 'rgba(0,0,0,0.3)' : wash(0.06)} borderStyle="round" borderColor={G.edge} paddingX={2} paddingY={1}>
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
        <Box paddingLeft={2} backgroundColor={wash(0.03)}>
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
  <circle r="${R + 12}" fill="#808080" fill-opacity="0.18" stroke="#ffffff" stroke-opacity="0.18"/>
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="6" viewBox="0 0 ${W} 6"><rect width="${W}" height="6" rx="3" fill="#808080" fill-opacity="0.2"/>${segs}</svg>`
}

/**
 * The Roadmap card's phase rail: one segment per phase, filled to the phase's %, a check mark at
 * 100%. A static image (no script, no animation, not interactive), so it never captures scroll.
 */
export function railSvg(phases: ReadonlyArray<{ pct: number }>, hex: string): string {
  const W = 640
  const H = 14
  const gap = 6
  const n = Math.max(1, phases.length)
  const seg = (W - gap * (n - 1)) / n
  const parts = phases
    .map((p, i) => {
      const x = i * (seg + gap)
      const pct = Math.max(0, Math.min(100, p.pct))
      const fill = (seg * pct) / 100
      const check =
        pct >= 100
          ? `<path d="M${(x + seg / 2 - 5).toFixed(1)} 7 l3.5 3.5 l6.5 -7" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
          : ''
      return `<rect x="${x.toFixed(1)}" y="0" width="${seg.toFixed(1)}" height="${H}" rx="4" fill="#808080" fill-opacity="0.2"/><rect x="${x.toFixed(1)}" y="0" width="${fill.toFixed(1)}" height="${H}" rx="4" fill="${hex}" fill-opacity="0.85"/>${check}`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts}</svg>`
}

/** A thin bar with a light sweeping across it, for "Claude is working". SMIL runs in a drawn image, so no iframe and no scroll capture. */
export function workingSvg(hex: string): string {
  const W = 640
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="3" viewBox="0 0 ${W} 3" preserveAspectRatio="none"><defs><linearGradient id="sweep" x1="0" x2="1"><stop offset="0" stop-color="${hex}" stop-opacity="0"/><stop offset="0.5" stop-color="${hex}" stop-opacity="1"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="3" rx="1.5" fill="${hex}" fill-opacity="0.15"/><rect y="0" width="220" height="3" rx="1.5" fill="url(#sweep)"><animate attributeName="x" from="-220" to="${W}" dur="1.6s" repeatCount="indefinite"/></rect></svg>`
}

/** A small spinning arc with a pulsing core. */
export function spinnerSvg(hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="${hex}" stroke-opacity="0.2" stroke-width="2.5"/><path d="M11 3 a8 8 0 0 1 8 8" fill="none" stroke="${hex}" stroke-width="2.5" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 11 11" to="360 11 11" dur="0.9s" repeatCount="indefinite"/></path><circle cx="11" cy="11" r="2.5" fill="${hex}"><animate attributeName="r" values="1.5;3;1.5" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;1;0.5" dur="1.2s" repeatCount="indefinite"/></circle></svg>`
}

// ---------- Plan view (0007): static drawings, no script, no animation, not interactive ----------

/** One phase's progress bar. */
export function phaseBarSvg(pct: number, hex: string): string {
  const W = 160
  const H = 8
  const fill = (W * Math.max(0, Math.min(100, pct))) / 100
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="4" fill="#808080" fill-opacity="0.2"/><rect width="${fill.toFixed(1)}" height="${H}" rx="4" fill="${hex}" fill-opacity="0.85"/></svg>`
}

export type TimelineInput = {
  phases: { id: string; builds: { id: string; name: string; needs: string[]; hex: string }[] }[]
}

/**
 * Lanes per phase, one box per build placed by its depth in the `Needs` graph, and one arrow per
 * `Needs` pair whose builds are both in the plan.
 */
export function timelineSvg(t: TimelineInput, ink: string, faint: string): string {
  const all = t.phases.flatMap(p => p.builds)
  const byId = new Map(all.map(b => [b.id, b]))
  const depth = new Map<string, number>()
  const depthOf = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const b = byId.get(id)
    const d = b === undefined ? 0 : Math.max(0, ...b.needs.filter(n => byId.has(n)).map(n => depthOf(n, seen) + 1))
    depth.set(id, d)
    return d
  }
  for (const b of all) depthOf(b.id, new Set())
  const LABEL = 70
  const BOX_W = 104
  const COL = 124
  const ROW = 30
  const PAD = 8
  const pos = new Map<string, { x: number; y: number }>()
  let y = 0
  const lanes: string[] = []
  t.phases.forEach((p, i) => {
    const perDepth = new Map<number, number>()
    for (const b of p.builds) {
      const d = depth.get(b.id) ?? 0
      const row = perDepth.get(d) ?? 0
      perDepth.set(d, row + 1)
      pos.set(b.id, { x: LABEL + d * COL, y: y + PAD + row * ROW })
    }
    const rows = Math.max(1, ...perDepth.values())
    const h = rows * ROW + PAD * 2 - 6
    lanes.push(
      `<rect class="lane" data-phase="${esc(p.id)}" x="0" y="${y}" width="100%" height="${h}" rx="6" fill="#808080" fill-opacity="${i % 2 === 0 ? 0.08 : 0.04}"/><text x="8" y="${y + h / 2 + 4}" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="${faint}">${esc(p.id || 'Plan')}</text>`,
    )
    y += h + 6
  })
  const maxDepth = Math.max(0, ...depth.values())
  const W = Math.max(640, LABEL + (maxDepth + 1) * COL)
  const boxes = all
    .map(b => {
      const at = pos.get(b.id)!
      const label = `${b.id} ${b.name}`
      const short = label.length > 15 ? `${label.slice(0, 14)}…` : label
      return `<g class="build" data-build="${esc(b.id)}"><rect x="${at.x}" y="${at.y}" width="${BOX_W}" height="22" rx="5" fill="${b.hex}" fill-opacity="0.18" stroke="${b.hex}" stroke-opacity="0.7"/><text x="${at.x + 6}" y="${at.y + 15}" font-family="system-ui,sans-serif" font-size="11" fill="${ink}">${esc(short)}</text></g>`
    })
    .join('')
  const arrows = all
    .flatMap(b =>
      b.needs
        .filter(n => byId.has(n))
        .map(n => {
          const from = pos.get(n)!
          const to = pos.get(b.id)!
          const x1 = from.x + BOX_W
          const y1 = from.y + 11
          const x2 = to.x - 2
          const y2 = to.y + 11
          const mid = (x1 + x2) / 2
          return `<path class="dep" data-need="${esc(n)}>${esc(b.id)}" d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}" fill="none" stroke="${faint}" stroke-width="1.5" marker-end="url(#arrow)"/>`
        }),
    )
    .join('')
  const H = Math.max(20, y)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${faint}"/></marker></defs>${lanes.join('')}${arrows}${boxes}</svg>`
}

/** The hill chart: one dot per phase at its position (0–50 uphill, 50 the top, 50–100 downhill). */
export function hillSvg(dots: { id: string; position: number }[], hex: string, faint: string): string {
  const W = 640
  const H = 120
  const base = 100
  const top = 20
  const yAt = (p: number) => base - (base - top) * Math.sin((Math.max(0, Math.min(100, p)) / 100) * Math.PI)
  const curve = Array.from({ length: 41 }, (_, i) => {
    const p = i * 2.5
    return `${i === 0 ? 'M' : 'L'}${((p / 100) * (W - 40) + 20).toFixed(1)} ${yAt(p).toFixed(1)}`
  }).join(' ')
  const marks = dots
    .map((d, i) => {
      const x = (Math.max(0, Math.min(100, d.position)) / 100) * (W - 40) + 20
      const y = yAt(d.position)
      return `<circle class="hill-dot" data-phase="${esc(d.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${hex}"/><text x="${x.toFixed(1)}" y="${(y - 10 - (i % 2) * 11).toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${hex}">${esc(d.id || 'Plan')}</text>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${curve}" fill="none" stroke="${faint}" stroke-width="2"/><line x1="${W / 2}" y1="${top - 6}" x2="${W / 2}" y2="${base + 8}" stroke="${faint}" stroke-dasharray="3 4" stroke-opacity="0.6"/><text x="20" y="${H - 4}" font-family="system-ui,sans-serif" font-size="10" fill="${faint}">figuring it out</text><text x="${W - 20}" y="${H - 4}" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" fill="${faint}">making it happen</text>${marks}</svg>`
}

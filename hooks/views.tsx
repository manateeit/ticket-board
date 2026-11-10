// The pane's views: Board, Ticket, Questions, New ticket, BOARD.md.
import type { Elements, EngineInterface, RenderChildren } from 'claude-code'

import { STATUSES } from './core/board'
import { MODE_OPTIONS, SHOW_OPTIONS, SORT_OPTIONS, query, runLine, titleFromIdea, type Filters } from './core/query'
import { isReadyable, readiness } from './core/ticket'
import { startJob, suggestAnswer } from './ai'
import {
  S,
  boardPath,
  createSkeleton,
  dir,
  editRow,
  items,
  jobFor,
  redraw,
  refresh,
  rowOf,
  saveAnswer,
  saveFilters,
  say,
  statusOf,
  type View,
} from './store'

type $ = EngineInterface
export type UI = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Input' | 'Select' | 'Markdown'>
export type Frame = { rows: number; columns: number }

const SHOW_LABEL: Record<string, string> = {
  'needs-me': 'Needs me (draft + blocked)',
  'not-done': 'Not done',
  all: 'All',
}
const SORT_LABEL: Record<string, string> = {
  number: 'Number ↑',
  'number-desc': 'Number ↓',
  status: 'Status',
  questions: 'Open questions',
  updated: 'Recently edited',
}
const TONE: Record<string, string> = {
  draft: 'warning',
  ready: 'success',
  'in-progress': 'suggestion',
  'in-check': 'permission',
  done: 'subtle',
  blocked: 'error',
  unlisted: 'error',
}

export function go($: $, view: View) {
  S.view = view
  S.confirm = undefined
  S.message = undefined
  redraw($)
}

function fail($: $, err: unknown) {
  say($, err instanceof Error ? err.message : String(err), 'error')
}

async function fill($: $, text: string, note: string) {
  try {
    const r = await $.prompt.fill({ text, mode: 'replace' })
    say($, r.isFilled ? note : 'The prompt box is busy — copy this instead: ' + text, r.isFilled ? 'success' : 'warning')
  } catch (err) {
    fail($, err)
  }
}

function blockersOpen(blockedBy: string[]): string[] {
  return blockedBy.filter(n => statusOf(n) !== 'done')
}

/** Ready tickets whose blockers are all done. */
export function runnable(): string[] {
  return items()
    .filter(i => i.status === 'ready' && blockersOpen(i.blockedBy).length === 0)
    .map(i => i.number)
}

export function runTicket($: $, number: string) {
  const open = blockersOpen(rowOf(number)?.blockedBy ?? [])
  const text = open.length === 0 ? `Run ticket ${number}.` : `Run ticket ${number} once ${open.join(', ')} ${open.length === 1 ? 'is' : 'are'} done.`
  void fill($, text, 'In your prompt box — press Enter to send it')
}

function setFilters($: $, change: Partial<Filters>) {
  S.filters = { ...S.filters, ...change }
  S.page = 0
  void saveFilters($)
  redraw($)
}

function Header(ui: UI, title: string, $: $, back?: View) {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="row" gap={1}>
      {back !== undefined && <Button key="back" label="‹ Back" plain onPress={() => go($, back)} />}
      <Text bold wrap="truncate">
        {title}
      </Text>
    </Box>
  )
}

function Message(ui: UI): RenderChildren {
  const { Text } = ui
  if (S.message === undefined) return null
  return <Text color={S.message.tone}>{S.message.text}</Text>
}

// ---------- Board ----------

function boardView($: $, ui: UI, frame: Frame): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const all = items()
  const counts = STATUSES.map(s => [s, all.filter(i => i.status === s).length] as const).filter(([, n]) => n > 0)
  const list = query(all, S.filters)
  const pageSize = Math.max(4, frame.rows - 14)
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const page = Math.min(S.page, pages - 1)
  const shown = list.slice(page * pageSize, page * pageSize + pageSize)
  const run = runnable()
  const unlisted = all.filter(i => i.isUnlisted).length
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {counts.length === 0 ? (
          <Text dimColor>No tickets yet</Text>
        ) : (
          counts.map(([s, n]) => (
            <Text color={TONE[s]}>
              {s} {n}
            </Text>
          ))
        )}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="new" label="+ New ticket" hotkey="n" variant="primary" onPress={() => go($, { kind: 'new' })} />
        {run.length > 0 && (
          <Button key="runall" label={`▶ Run ready (${run.length})`} hotkey="x" onPress={() => void fill($, runLine(run), 'In your prompt box — press Enter to send it to the router')} />
        )}
        <Button key="doc" label="BOARD.md" hotkey="b" onPress={() => go($, { kind: 'doc' })} />
        <Button key="refresh" label="Refresh" hotkey="r" onPress={() => void refresh($, true).then(() => say($, "Refreshed"), () => undefined)} />
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Select
          key="show"
          label="Show"
          value={S.filters.show}
          options={SHOW_OPTIONS.map(v => ({ value: v, label: SHOW_LABEL[v] ?? v }))}
          onSelect={v => setFilters($, { show: v as Filters['show'] })}
        />
        <Select
          key="sort"
          label="Sort"
          value={S.filters.sort}
          options={SORT_OPTIONS.map(v => ({ value: v, label: SORT_LABEL[v] ?? v }))}
          onSelect={v => setFilters($, { sort: v as Filters['sort'] })}
        />
        <Select
          key="mode"
          label="Mode"
          value={S.filters.mode}
          options={MODE_OPTIONS.map(v => ({ value: v, label: v === 'any' ? 'Any mode' : v }))}
          onSelect={v => setFilters($, { mode: v as Filters['mode'] })}
        />
      </Box>
      <Input
        key="search"
        label="Search"
        placeholder="number, title, notes…"
        value={S.filters.search}
        submitLabel="Filter"
        onInput={v => setFilters($, { search: v })}
        onSubmit={v => setFilters($, { search: v })}
      />
      {Message(ui)}
      <Box flexDirection="column">
        {shown.length === 0 && (
          <Text dimColor>
            {all.length === 0 ? 'The board has no tickets. Press + New ticket.' : `Nothing matches (${all.length} tickets on the board). Try Show: All.`}
          </Text>
        )}
        {shown.map(i => {
          const job = jobFor(i.number)
          const marks = [
            i.openQuestions > 0 ? `?${i.openQuestions}` : '',
            i.status === 'draft' && isReadyable(checksFor(i.number)) ? '✓' : '',
            blockersOpen(i.blockedBy).length > 0 && i.status !== 'done' ? '⛔' : '',
            job !== undefined ? '✎' : '',
            i.isUnlisted ? '⚠' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <Box key={`row-${i.number}`} flexDirection="row" gap={1} hover={{ backgroundColor: "promptBorder" }}>
              <Button key={`open-${i.number}`} label={i.number} plain onPress={() => go($, { kind: 'ticket', number: i.number, tab: 'rd' })} />
              <Text color={TONE[i.status]}>{i.status.padEnd(11)}</Text>
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="truncate">{i.title}</Text>
              </Box>
              {marks !== '' && <Text color="warning">{marks}</Text>}
            </Box>
          )
        })}
      </Box>
      {pages > 1 && (
        <Box flexDirection="row" gap={1}>
          <Button key="prev" label="‹ Prev" plain onPress={() => ((S.page = Math.max(0, page - 1)), redraw($))} />
          <Text dimColor>
            page {page + 1}/{pages} · {list.length} tickets
          </Text>
          <Button key="next" label="Next ›" plain onPress={() => ((S.page = Math.min(pages - 1, page + 1)), redraw($))} />
        </Box>
      )}
      <Text dimColor>
        ?N open questions · ✓ can be marked ready · ⛔ waits on a ticket · ✎ AI writing{unlisted > 0 ? ' · ⚠ folder not on board' : ''}
      </Text>
    </Box>
  )
}

export function checksFor(number: string) {
  const f = S.snap?.files.get(number)
  return readiness({ rd: f?.rd, ev: f?.ev, blockedBy: rowOf(number)?.blockedBy ?? [], statusOf })
}

// ---------- Ticket ----------

async function setStatus($: $, number: string, to: string, from: string, notes?: string) {
  try {
    await editRow($, number, notes === undefined ? { status: to } : { status: to, notes }, from)
    say($, `${number} → ${to}`)
  } catch (err) {
    await refresh($, true)
    fail($, err)
  }
}

function ticketView($: $, ui: UI, number: string, tab: 'rd' | 'eval'): RenderChildren {
  const { Box, Text, Button, Input, Select, Markdown } = ui
  const row = rowOf(number)
  const f = S.snap?.files.get(number)
  const title = row?.title || f?.title || '(untitled)'
  const status = row?.status ?? 'unlisted'
  const checks = checksFor(number)
  const canReady = isReadyable(checks)
  const open = (f?.questions ?? []).filter(q => !q.isResolved)
  const answered = (f?.questions ?? []).filter(q => q.isResolved)
  const job = jobFor(number)
  const waiting = blockersOpen(row?.blockedBy ?? [])
  const path = f === undefined ? undefined : `${dir()}/${f.folder}`
  const isConfirming = (k: string) => S.confirm === `${number}:${k}`
  const confirm = (k: string) => {
    S.confirm = `${number}:${k}`
    redraw($)
  }

  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, `${number} — ${title}`, $, { kind: 'board' })}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text color={TONE[status]} bold>
          {status}
        </Text>
        {row !== undefined && <Text dimColor>mode {row.mode || '—'}</Text>}
        {row !== undefined && <Text dimColor>blocked by {row.blockedBy.length === 0 ? '—' : row.blockedBy.join(', ')}</Text>}
        {row !== undefined && row.owner !== '' && row.owner !== '—' && <Text dimColor>owner {row.owner}</Text>}
      </Box>
      {row !== undefined && row.notes !== '' && <Text dimColor>Notes: {row.notes}</Text>}
      {row === undefined && <Text color="error">⚠ BOARD.md has no row for this ticket folder.</Text>}
      {f === undefined && <Text color="error">⚠ No folder {dir()}/{number}-… for this row.</Text>}
      {Message(ui)}

      {status === 'draft' && (
        <Box flexDirection="column">
          <Text bold>Ready check</Text>
          {checks.map(c => (
            <Text color={c.isOk ? 'success' : c.isHard ? 'error' : 'warning'}>
              {c.isOk ? '✓' : c.isHard ? '✗' : '!'} {c.label}
              {c.detail !== undefined ? ` — ${c.detail}` : ''}
            </Text>
          ))}
        </Box>
      )}

      {job !== undefined && (
        <Box flexDirection="row" gap={1}>
          <Text color="claude">✎ AI is {job.kind === 'draft' ? 'writing' : job.kind === 'enhance' ? 'enhancing' : 'folding answers into'} this ticket…</Text>
          <Button key="viewagent" label="Watch" plain onPress={() => void $.ui.view({ agentId: job.agentId }).catch(() => undefined)} />
        </Box>
      )}

      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0}>
        {status === 'ready' && <Button key="run" label="▶ Run this ticket" hotkey="x" variant="primary" onPress={() => runTicket($, number)} />}
        {f !== undefined && (open.length > 0 || answered.length > 0) && (
          <Button
            key="questions"
            label={open.length > 0 ? `Answer questions (${open.length})` : `Questions (${answered.length} answered)`}
            hotkey="q"
            variant={status === 'draft' && open.length > 0 ? 'primary' : 'secondary'}
            onPress={() => go($, { kind: 'questions', number })}
          />
        )}
        {status === 'draft' && canReady && (
          <Button key="ready" label="✓ Mark ready" hotkey="m" variant="primary" onPress={() => void setStatus($, number, 'ready', 'draft')} />
        )}
        {status === 'ready' && <Button key="draft" label="Back to draft" hotkey="d" onPress={() => void setStatus($, number, 'draft', 'ready')} />}
        {status === 'draft' && f !== undefined && job === undefined && (
          <Button key="enhance" label="✎ Enhance with AI" hotkey="e" onPress={() => void startJob($, number, 'enhance')} />
        )}
        {status === 'blocked' && (
          <>
            <Button key="unblock-draft" label="Unblock → draft" onPress={() => void setStatus($, number, 'draft', 'blocked')} />
            <Button key="unblock-ready" label="Unblock → ready" onPress={() => void setStatus($, number, 'ready', 'blocked')} />
          </>
        )}
        {row !== undefined && status !== 'blocked' && status !== 'done' && (
          <Button key="block" label="Block…" onPress={() => confirm('block')} />
        )}
      </Box>

      {isConfirming('block') && (
        <Input
          key={`block-${number}`}
          label="Why is it blocked? (goes in Notes)"
          autoFocus
          submitLabel="Mark blocked"
          onSubmit={reason => {
            S.confirm = undefined
            void setStatus($, number, 'blocked', status, `blocked: ${reason.trim() || 'no reason given'}`)
          }}
        />
      )}

      {row !== undefined && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Select
            key={`mode-${number}`}
            label="Mode"
            value={row.mode === 'team' ? 'team' : 'solo'}
            options={[{ value: 'solo' }, { value: 'team' }]}
            onSelect={v => void editRow($, number, { mode: v }).then(() => say($, `Mode → ${v}`), err => fail($, err))}
          />
          <Input
            key={`blockedby-${number}`}
            label="Blocked by"
            value={row.blockedBy.join(', ')}
            placeholder="ticket numbers, e.g. 0003, 0007"
            submitLabel="Save"
            onSubmit={v => {
              const nums = (v.match(/\d{1,4}/g) ?? []).map(n => n.padStart(4, '0')).filter(n => n !== number)
              void editRow($, number, { blockedBy: nums.length === 0 ? '—' : nums.join(', ') }).then(() => say($, 'Blocked by saved'), err => fail($, err))
            }}
          />
        </Box>
      )}

      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button
          key="discuss"
          label="Discuss in chat"
          plain
          onPress={() => void fill($, `Let's look at ticket ${number} (${path ?? dir()}/rd.md). `, 'Started a message in your prompt box')}
        />
        {path !== undefined && (
          <Button key="copy" label="Copy path" plain onPress={p => void $.ui.copy({ text: path, surface: p.surface }).then(() => say($, `Copied ${path}`))} />
        )}
        {row !== undefined && (
          <Button key="override" label="Change status…" plain onPress={() => confirm('override')} />
        )}
      </Box>

      {isConfirming('override') && row !== undefined && (
        <Box flexDirection="column">
          <Text color="warning">
            The router normally moves in-progress / in-check / done. Change it by hand only to fix the board.
          </Text>
          <Box flexDirection="row" gap={1}>
            <Select
              key={`override-${number}`}
              label="Set status"
              value={S.overrideTo || status}
              options={STATUSES.map(s => ({ value: s }))}
              onSelect={v => ((S.overrideTo = v), redraw($))}
            />
            <Button
              key="override-ok"
              label="Apply"
              variant="primary"
              onPress={() => {
                const to = S.overrideTo || status
                S.confirm = undefined
                S.overrideTo = ''
                if (to !== status) void setStatus($, number, to, status)
              }}
            />
            <Button key="override-cancel" label="Cancel" plain onPress={() => ((S.confirm = undefined), redraw($))} />
          </Box>
        </Box>
      )}

      {f !== undefined && (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Button key="tab-rd" label={tab === 'rd' ? '[rd.md]' : 'rd.md'} plain onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
            <Button key="tab-eval" label={tab === 'eval' ? '[eval.md]' : 'eval.md'} plain onPress={() => go($, { kind: 'ticket', number, tab: 'eval' })} />
          </Box>
          <Markdown key={`md-${number}-${tab}`} text={(tab === 'rd' ? f.rd : f.ev) ?? `_No ${tab === 'rd' ? 'rd' : 'eval'}.md yet._`} />
        </Box>
      )}
      {waiting.length > 0 && status === 'ready' && <Text color="warning">Waits for {waiting.join(', ')} before the router will start it.</Text>}
    </Box>
  )
}

// ---------- Questions ----------

function questionsView($: $, ui: UI, number: string): RenderChildren {
  const { Box, Text, Button, Input } = ui
  const f = S.snap?.files.get(number)
  const qs = f?.questions ?? []
  const open = qs.filter(q => !q.isResolved)
  const answered = qs.filter(q => q.isResolved)
  const job = jobFor(number)
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, `${number} — open questions`, $, { kind: 'ticket', number, tab: 'rd' })}
      {Message(ui)}
      {open.length === 0 && <Text color="success">✓ No open questions left.</Text>}
      {open.map((q, n) => {
        const key = `q-${number}-${q.index}`
        const draft = S.drafts.get(key) ?? ''
        return (
          <Box key={`box-${key}`} flexDirection="column">
            <Text bold>
              {n + 1}. {q.text}
            </Text>
            {q.detail !== '' && <Text dimColor>{q.detail}</Text>}
            <Input
              key={key}
              label="Answer"
              value={draft}
              rows={2}
              autoFocus={n === 0 ? true : undefined}
              placeholder="Type the decision, then Save"
              submitLabel="Save"
              onInput={v => void S.drafts.set(key, v)}
              onSubmit={v => {
                if (v.trim() === '') return say($, 'Type an answer first', 'warning')
                void saveAnswer($, number, q, v)
                  .then(() => {
                    S.drafts.delete(key)
                    say($, `Saved answer to question ${n + 1}`)
                  })
                  .catch(err => fail($, err))
              }}
            />
            <Box flexDirection="row" gap={1}>
              <Button
                key={`suggest-${key}`}
                label={S.suggesting.has(key) ? 'Thinking…' : 'Suggest (AI)'}
                plain
                onPress={() => {
                  if (S.suggesting.has(key)) return
                  S.suggesting.add(key)
                  redraw($)
                  void suggestAnswer($, number, q).then(s => {
                    S.suggesting.delete(key)
                    if (s !== undefined) S.drafts.set(key, s)
                    redraw($)
                  })
                }}
              />
              <Button
                key={`discuss-${key}`}
                label="Discuss in chat"
                plain
                onPress={() =>
                  void fill($, `Ticket ${number} (${dir()}/${f?.folder}/rd.md) asks: "${q.text}" — help me decide. `, 'Started a message in your prompt box')
                }
              />
            </Box>
          </Box>
        )
      })}
      {answered.length > 0 && (
        <Box flexDirection="column">
          <Text bold dimColor>
            Answered ({answered.length})
          </Text>
          {answered.map(q => (
            <Text dimColor>
              ✓ {q.text}
              {'\n'}
              {'   '}
              {q.detail.split('\n').slice(-1)[0] ?? ''}
            </Text>
          ))}
          {job === undefined ? (
            <Button
              key="fold"
              label="✎ Fold answers into the ticket (AI)"
              onPress={() => void startJob($, number, 'fold')}
            />
          ) : (
            <Text color="claude">✎ AI is working on this ticket…</Text>
          )}
        </Box>
      )}
      {open.length === 0 && rowOf(number)?.status === 'draft' && (
        <Button key="toticket" label="Back to the ticket to mark it ready" variant="primary" onPress={() => go($, { kind: 'ticket', number, tab: 'rd' })} />
      )}
    </Box>
  )
}

// ---------- New ticket ----------

export async function createTicket($: $, withAI: boolean) {
  const idea = (S.drafts.get('new-idea') ?? '').trim()
  if (idea === '') return say($, 'Describe the ticket first', 'warning')
  const blockedBy = ((S.drafts.get('new-blocked') ?? '').match(/\d{1,4}/g) ?? []).map(n => n.padStart(4, '0'))
  try {
    const { number } = await createSkeleton(
      $,
      { title: titleFromIdea(idea), text: idea, mode: S.newMode, blockedBy },
      withAI ? 'AI drafting…' : 'Skeleton — fill in rd.md and eval.md',
    )
    S.drafts.delete('new-idea')
    S.drafts.delete('new-blocked')
    go($, { kind: 'ticket', number, tab: 'rd' })
    if (withAI) await startJob($, number, 'draft', idea)
    else say($, `Created ${number} as a draft skeleton`)
  } catch (err) {
    fail($, err)
  }
}

async function draftInChat($: $) {
  const idea = (S.drafts.get('new-idea') ?? '').trim()
  if (idea === '') return say($, 'Describe the ticket first', 'warning')
  const hasOwn = await $.fs.exists('.claude/skills/ticket/SKILL.md').catch(() => false)
  await fill($, `/${hasOwn ? 'ticket' : 'ticket-board:ticket'} ${idea}`, 'In your prompt box — press Enter to draft it in chat')
}

function newView($: $, ui: UI): RenderChildren {
  const { Box, Text, Button, Input, Select } = ui
  const idea = S.drafts.get('new-idea') ?? ''
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, 'New ticket', $, { kind: 'board' })}
      <Text dimColor>
        Describe the feature or fix in your own words. The AI explores the code and writes rd.md + eval.md in the /ticket format, as a draft — it asks
        you anything it cannot decide.
      </Text>
      <Input
        key="new-idea"
        label="Idea"
        rows={5}
        autoFocus
        value={idea}
        placeholder="e.g. Let people export the board as CSV from the settings page"
        submitLabel="Create + enhance"
        onInput={v => void S.drafts.set('new-idea', v)}
        onSubmit={v => {
          S.drafts.set('new-idea', v)
          void createTicket($, true)
        }}
      />
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Select key="new-mode" label="Mode" value={S.newMode} options={[{ value: 'solo' }, { value: 'team' }]} onSelect={v => ((S.newMode = v), redraw($))} />
        <Input
          key="new-blocked"
          label="Blocked by"
          value={S.drafts.get('new-blocked') ?? ''}
          placeholder="—"
          submitLabel="Set"
          onInput={v => void S.drafts.set('new-blocked', v)}
          onSubmit={v => void S.drafts.set('new-blocked', v)}
        />
      </Box>
      {Message(ui)}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Button key="create-ai" label="✎ Create draft + enhance with AI" variant="primary" onPress={() => void createTicket($, true)} />
        <Button key="create-plain" label="Create empty draft" onPress={() => void createTicket($, false)} />
        <Button key="create-chat" label="Draft in chat instead" plain onPress={() => void draftInChat($)} />
      </Box>
    </Box>
  )
}

// ---------- BOARD.md ----------

function docView($: $, ui: UI): RenderChildren {
  const { Box, Markdown } = ui
  return (
    <Box flexDirection="column" gap={1}>
      {Header(ui, boardPath(), $, { kind: 'board' })}
      <Markdown key="board-doc" text={S.snap?.boardText || '_BOARD.md is empty._'} />
    </Box>
  )
}

// ---------- No board ----------

async function setUp($: $) {
  try {
    const root = $.plugin.root
    const board = await $.fs.read(`${root}/templates/BOARD.md`)
    await $.fs.write(boardPath(), board)
    for (const f of ['rd.md', 'eval.md']) {
      const path = `${dir()}/TEMPLATE/${f}`
      if (!(await $.fs.exists(path))) await $.fs.write(path, await $.fs.read(`${root}/skills/ticket/TEMPLATE/${f}`))
    }
    await refresh($, true)
    say($, `Created ${boardPath()} — press + New ticket to add the first one`)
  } catch (err) {
    fail($, err)
  }
}

function setupView($: $, ui: UI): RenderChildren {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>No ticket board here yet</Text>
      <Text dimColor>
        This project has no {boardPath()}. Setting up creates it (the draft → ready → in-progress → in-check → done board) plus {dir()}/TEMPLATE/ with
        the rd.md and eval.md templates.
      </Text>
      {Message(ui)}
      <Button key="setup" label="Set up board" variant="primary" autoFocus onPress={() => void setUp($)} />
    </Box>
  )
}

export function drawPane($: $, ui: UI, frame: Frame): RenderChildren {
  const { Text } = ui
  if (S.snap === undefined) {
    void refresh($)
    return <Text dimColor>Loading {boardPath()}…</Text>
  }
  if (!S.snap.hasBoard) return setupView($, ui)
  if (S.snap.board === undefined)
    return <Text color="error">{boardPath()} has no ticket table (a markdown table with # and Status columns).</Text>
  const v = S.view
  switch (v.kind) {
    case 'board':
      return boardView($, ui, frame)
    case 'doc':
      return docView($, ui)
    case 'ticket':
      return ticketView($, ui, v.number, v.tab)
    case 'questions':
      return questionsView($, ui, v.number)
    case 'new':
      return newView($, ui)
  }
}

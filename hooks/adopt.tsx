// Adopt existing docs (0009): the Start screen's "I already have docs…". The person names files or
// folders, one background agent converts them into a proposal (`design/changes/<date>-adopt.md`),
// and this review shows the proposed DESIGN.md and PLAN.md with one checkbox per section, phase and
// build. Nothing is written to DESIGN.md, PLAN.md or BOARD.md until Apply selected.
import type { EngineInterface, RenderChildren } from 'claude-code'

import { ADOPT_FOLDER, applyAdopt, cancelAdoptNames, loadAdopt, startAdopt } from './ai'
import { adoptLeftOut, adoptResult, parseAdopt, type AdoptItem, type AdoptProposal } from './core/roadmap'
import { today } from './core/query'
import { Card, Toast } from './desk'
import { G, STATUS_HEX } from './glass'
import { S, redraw, type View } from './store'
import { fail, go, type UI } from './views'
import { viewName } from './plan'

type $ = EngineInterface
type AdoptView = Extract<View, { kind: 'adopt' }>

const PATHS = 'adopt-paths'
const DESIGN_NAME = 'adopt-design-name'
const PLAN_NAME = 'adopt-plan-name'

export const ADOPT_HINT = 'Nothing is written to DESIGN.md, PLAN.md or BOARD.md until you press Apply selected. Your files are never changed.'

/** The Start button: opens the adopt view and looks for a proposal waiting for review. */
export function openAdopt($: $) {
  go($, { kind: 'adopt', from: S.view })
  void loadAdopt($).catch(() => undefined)
}

function convert($: $) {
  void startAdopt($, S.drafts.get(PATHS) ?? '').catch(err => fail($, err))
}

function toggle($: $, id: string) {
  if (S.adoptOff.has(id)) S.adoptOff.delete(id)
  else S.adoptOff.add(id)
  redraw($)
}

/** After Apply: the Plan or Design view, Back going to Start (where the stepper has moved on). The message stays. */
function apply($: $, names?: { design?: string; plan?: string }) {
  void applyAdopt($, names)
    .then(to => {
      if (to === undefined) return
      S.view = { kind: to, from: { kind: 'start' } }
      S.confirm = undefined
      S.adoptPreview = ''
      redraw($)
    })
    .catch(err => fail($, err))
}

function applyRenamed($: $) {
  const n = S.adoptNames
  if (n === undefined) return
  const pick = (key: string, fallback: string | undefined) => (fallback === undefined ? undefined : (S.drafts.get(key) ?? fallback).trim())
  const design = pick(DESIGN_NAME, n.design)
  const plan = pick(PLAN_NAME, n.plan)
  apply($, { ...(design === undefined ? {} : { design }), ...(plan === undefined ? {} : { plan }) })
}

function cancelNames($: $) {
  S.drafts.delete(DESIGN_NAME)
  S.drafts.delete(PLAN_NAME)
  cancelAdoptNames($)
}

function again($: $) {
  S.adoptFile = undefined
  S.adoptOff.clear()
  S.adoptNames = undefined
  S.adoptPreview = ''
  redraw($)
}

function preview($: $, which: 'design' | 'plan') {
  S.adoptPreview = S.adoptPreview === which ? '' : which
  redraw($)
}

type Review = { p: AdoptProposal; out: Set<string>; ticked: number; design?: string; plan?: string }

function review(): Review | undefined {
  const f = S.adoptFile
  if (f === undefined) return undefined
  const p = parseAdopt(f.text, f.name)
  const out = adoptLeftOut(p, S.adoptOff)
  const r = adoptResult(p, S.adoptOff, today(Date.now()))
  return { p, out, ticked: p.items.filter(i => !out.has(i.id)).length, ...(r.design === undefined ? {} : { design: r.design }), ...(r.plan === undefined ? {} : { plan: r.plan }) }
}

/** A file as Markdown without its front matter (the preview). */
const body = (md: string) => md.replace(/^\s*---\n[\s\S]*?\n---\n/, '')

/** Why an item is left out though it is ticked: its phase is unticked. */
const byPhase = (it: AdoptItem, out: Set<string>) => (out.has(it.id) && !S.adoptOff.has(it.id) && it.phase !== undefined ? `left out with ${it.phase}` : '')

const label = (it: AdoptItem) => `${it.id} · ${it.title}`

// ---------- Desktop ----------

function deskItem($: $, ui: UI, it: AdoptItem, out: Set<string>): RenderChildren {
  const { Box, Text, Button } = ui
  const on = !out.has(it.id)
  const note = byPhase(it, out)
  return (
    <Box key={`ad-item-${it.id}`} flexDirection="column" {...(it.kind === 'build' ? { paddingLeft: 3 } : {})}>
      <Button key={`ad-tick-${it.id}`} label={`${on ? '☑' : '☐'} ${label(it)}`} plain onPress={() => toggle($, it.id)} />
      {it.detail === '' ? null : (
        <Text key={`ad-detail-${it.id}`} color={G.faint} size="footnote">
          {it.detail}
        </Text>
      )}
      <Text key={`ad-reason-${it.id}`} color={G.soft} size="footnote">
        {it.reason === '' ? 'No reason given.' : it.reason}
      </Text>
      {note === '' ? null : (
        <Text key={`ad-note-${it.id}`} color={STATUS_HEX.draft!} size="footnote">
          {note}
        </Text>
      )}
    </Box>
  )
}

export function deskAdopt($: $, ui: UI, v: AdoptView): RenderChildren {
  const { Box, Text, Button, Input, Markdown } = ui
  const job = S.adoptJob
  const d = review()
  const crumb = (
    <Box key="crumb" flexDirection="row" gap={1} alignItems="center">
      <Button key="back" label={`‹ ${viewName(v.from)}`} plain onPress={() => go($, v.from ?? { kind: 'start' })} />
      <Text color={G.faint}>/ Adopt existing docs</Text>
    </Box>
  )
  const title = (
    <Box key="adopt-title" flexDirection="column">
      <Text color={G.ink} size="title" weight="bold">
        Adopt existing docs
      </Text>
      <Text key="adopt-sub" color={G.faint} size="footnote">
        {d === undefined ? 'AI converts your files to the design and plan standard; you review the result.' : `${S.adoptFile!.path} · ${d.ticked} of ${d.p.items.length} ticked`}
      </Text>
    </Box>
  )
  if (job !== undefined)
    return (
      <Box flexDirection="column" gap={1}>
        {crumb}
        {title}
        {Toast(ui)}
        {Card(
          ui,
          [
            <Text key="adopt-running" color={G.ink}>{`Converting ${job.sources.join(', ')}…`}</Text>,
            <Text key="adopt-running-note" color={G.soft} size="footnote">
              {`The agent reads them and writes ${job.path}, and nothing else. The review opens here when it is done.`}
            </Text>,
          ],
          { key: 'adopt-running-card', title: 'Converting' },
        )}
      </Box>
    )
  if (d === undefined)
    return (
      <Box flexDirection="column" gap={1}>
        {crumb}
        {title}
        {Toast(ui)}
        {Card(
          ui,
          [
            <Input
              key={PATHS}
              label="Files or folders to convert (inside this project)"
              rows={2}
              value={S.drafts.get(PATHS) ?? ''}
              placeholder="notes/roadmap.md, docs/spec/"
              submitLabel="Convert"
              onInput={t => void S.drafts.set(PATHS, t)}
              onSubmit={t => {
                S.drafts.set(PATHS, t)
                convert($)
              }}
            />,
            <Box key="adopt-pick-actions" flexDirection="row" gap={1} flexWrap="wrap">
              <Button key="adopt-convert" label="✨ Convert with AI" variant="primary" onPress={() => convert($)} />
            </Box>,
            <Text key="adopt-pick-note" color={G.soft} size="footnote">
              {`Separate paths with commas or new lines. One agent reads them and writes a proposal to ${ADOPT_FOLDER}/<date>-adopt.md. ${ADOPT_HINT}`}
            </Text>,
          ],
          { key: 'adopt-pick', title: 'Your docs' },
        )}
      </Box>
    )
  const sections = d.p.items.filter(i => i.kind === 'section')
  const planItems = d.p.items.filter(i => i.kind !== 'section')
  const names = S.adoptNames
  return (
    <Box flexDirection="column" gap={1}>
      {crumb}
      {title}
      {Toast(ui)}
      {d.p.warnings.length === 0
        ? null
        : Card(
            ui,
            d.p.warnings.map((w, i) => (
              <Text key={`ad-warn-${i}`} color={STATUS_HEX.draft!} size="footnote">
                {`⚠ ${w}`}
              </Text>
            )),
            { key: 'adopt-warnings', title: 'Warnings' },
          )}
      {Card(
        ui,
        d.p.sources.length === 0
          ? [
              <Text key="ad-src-none" color={G.faint} size="footnote">
                The proposal lists no sources.
              </Text>,
            ]
          : d.p.sources.map((s, i) => (
              <Text key={`ad-src-${i}`} color={s.isLeftOut ? G.soft : G.ink} size="footnote">
                {`${s.path} → ${s.text || '—'}`}
              </Text>
            )),
        { key: 'adopt-sources', title: 'Sources' },
      )}
      {Card(
        ui,
        [
          ...(sections.length === 0
            ? [
                <Text key="ad-none-design" color={G.faint} size="footnote">
                  No design sections proposed.
                </Text>,
              ]
            : sections.map(it => deskItem($, ui, it, d.out))),
          d.design === undefined ? null : (
            <Box key="ad-preview-design-box" flexDirection="row" gap={1}>
              <Button key="adopt-preview-design" label={S.adoptPreview === 'design' ? 'Hide DESIGN.md' : 'Show DESIGN.md as it will be written'} plain onPress={() => preview($, 'design')} />
            </Box>
          ),
          S.adoptPreview === 'design' && d.design !== undefined ? <Markdown key="adopt-preview-md" text={body(d.design)} /> : null,
        ],
        { key: 'adopt-design', title: `Proposed DESIGN.md · ${sections.length} section${sections.length === 1 ? '' : 's'}` },
      )}
      {Card(
        ui,
        [
          ...(planItems.length === 0
            ? [
                <Text key="ad-none-plan" color={G.faint} size="footnote">
                  No phases or builds proposed.
                </Text>,
              ]
            : planItems.map(it => deskItem($, ui, it, d.out))),
          d.plan === undefined ? null : (
            <Box key="ad-preview-plan-box" flexDirection="row" gap={1}>
              <Button key="adopt-preview-plan" label={S.adoptPreview === 'plan' ? 'Hide PLAN.md' : 'Show PLAN.md as it will be written'} plain onPress={() => preview($, 'plan')} />
            </Box>
          ),
          S.adoptPreview === 'plan' && d.plan !== undefined ? <Markdown key="adopt-preview-md" text={body(d.plan)} /> : null,
        ],
        { key: 'adopt-plan', title: `Proposed PLAN.md · ${planItems.length} phase${planItems.length === 1 ? '' : 's'} and build${planItems.length === 1 ? '' : 's'}` },
      )}
      {names === undefined
        ? null
        : Card(
            ui,
            [
              <Text key="ad-names-text" color={STATUS_HEX.draft!}>
                A file with that name already exists and is never overwritten. Pick another name or cancel.
              </Text>,
              names.design === undefined ? null : (
                <Input key={DESIGN_NAME} label="DESIGN.md as" value={S.drafts.get(DESIGN_NAME) ?? names.design} submitLabel="Set" onInput={t => void S.drafts.set(DESIGN_NAME, t)} onSubmit={t => void S.drafts.set(DESIGN_NAME, t)} />
              ),
              names.plan === undefined ? null : (
                <Input key={PLAN_NAME} label="PLAN.md as" value={S.drafts.get(PLAN_NAME) ?? names.plan} submitLabel="Set" onInput={t => void S.drafts.set(PLAN_NAME, t)} onSubmit={t => void S.drafts.set(PLAN_NAME, t)} />
              ),
              <Box key="ad-names-actions" flexDirection="row" gap={1} flexWrap="wrap">
                <Button key="adopt-rename-apply" label="Apply with these names" variant="primary" onPress={() => applyRenamed($)} />
                <Button key="adopt-cancel" label="Cancel" onPress={() => cancelNames($)} />
              </Box>,
            ],
            { key: 'adopt-names', title: 'Already exists', accent: STATUS_HEX.draft! },
          )}
      <Box key="adopt-actions" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
        <Button key="adopt-apply" label={`Apply selected (${d.ticked})`} {...(d.ticked > 0 ? { variant: 'primary' as const } : { dimColor: true })} onPress={() => apply($)} />
        <Button key="adopt-again" label="Convert other files" onPress={() => again($)} />
      </Box>
      <Text key="adopt-hint" color={G.faint} size="footnote">
        {ADOPT_HINT}
      </Text>
    </Box>
  )
}

// ---------- Terminal ----------

export function adoptView($: $, ui: UI, v: AdoptView): RenderChildren {
  const { Box, Text, Button, Input, Markdown } = ui
  const job = S.adoptJob
  const d = review()
  const head = (
    <Box key="crumb" flexDirection="row" gap={1}>
      <Button key="back" label={`‹ ${viewName(v.from)}`} plain onPress={() => go($, v.from ?? { kind: 'start' })} />
      <Text bold wrap="truncate">
        {`Adopt existing docs${d === undefined ? '' : ` · ${S.adoptFile!.path} · ${d.ticked} of ${d.p.items.length} ticked`}`}
      </Text>
    </Box>
  )
  const message = S.message === undefined ? null : <Text key="message" color={S.message.tone}>{S.message.text}</Text>
  if (job !== undefined)
    return (
      <Box flexDirection="column" gap={1}>
        {head}
        {message}
        <Text key="adopt-running">{`Converting ${job.sources.join(', ')}… the agent writes ${job.path} and nothing else.`}</Text>
      </Box>
    )
  if (d === undefined)
    return (
      <Box flexDirection="column" gap={1}>
        {head}
        {message}
        <Text>1. Name the files or folders with your docs (inside this project).</Text>
        <Input
          key={PATHS}
          label="Files or folders"
          value={S.drafts.get(PATHS) ?? ''}
          placeholder="notes/roadmap.md, docs/spec/"
          submitLabel="Convert"
          onInput={t => void S.drafts.set(PATHS, t)}
          onSubmit={t => {
            S.drafts.set(PATHS, t)
            convert($)
          }}
        />
        <Text>2. One agent converts them to a proposal in {ADOPT_FOLDER}/.</Text>
        <Text>3. You review it here: tick what to keep, then Apply selected.</Text>
        <Button key="adopt-convert" label="Convert with AI" onPress={() => convert($)} />
        <Text dimColor>{ADOPT_HINT}</Text>
      </Box>
    )
  const items = d.p.items
  const names = S.adoptNames
  return (
    <Box flexDirection="column" gap={1}>
      {head}
      {message}
      {d.p.warnings.map((w, i) => (
        <Text key={`ad-warn-${i}`} color="warning">{`⚠ ${w}`}</Text>
      ))}
      <Box key="adopt-sources" flexDirection="column">
        <Text bold>Sources</Text>
        {d.p.sources.length === 0 ? <Text key="ad-src-none" dimColor>{'  none listed'}</Text> : null}
        {d.p.sources.map((s, i) => (
          <Text key={`ad-src-${i}`} dimColor={s.isLeftOut}>{`  ${s.path} → ${s.text || '—'}`}</Text>
        ))}
      </Box>
      {(['section', 'plan'] as const).map(group => {
        const list = items.filter(i => (group === 'section' ? i.kind === 'section' : i.kind !== 'section'))
        return (
          <Box key={`adopt-${group === 'section' ? 'design' : 'plan'}`} flexDirection="column">
            <Text bold>{group === 'section' ? `Proposed DESIGN.md (${list.length})` : `Proposed PLAN.md (${list.length})`}</Text>
            {list.length === 0 ? <Text key={`ad-none-${group}`} dimColor>{'  nothing proposed'}</Text> : null}
            {list.map(it => {
              const n = items.indexOf(it) + 1
              const note = byPhase(it, d.out)
              return (
                <Box key={`ad-item-${it.id}`} flexDirection="column" paddingLeft={it.kind === 'build' ? 4 : 2}>
                  <Button key={`ad-tick-${it.id}`} label={`${n}. ${d.out.has(it.id) ? '[ ]' : '[x]'} ${label(it)}`} plain onPress={() => toggle($, it.id)} />
                  {it.detail === '' ? null : <Text key={`ad-detail-${it.id}`} dimColor>{`    ${it.detail}`}</Text>}
                  <Text key={`ad-reason-${it.id}`} dimColor>{`    ${it.reason === '' ? 'No reason given.' : it.reason}`}</Text>
                  {note === '' ? null : <Text key={`ad-note-${it.id}`} color="warning">{`    ${note}`}</Text>}
                </Box>
              )
            })}
          </Box>
        )
      })}
      <Box key="adopt-previews" flexDirection="row" columnGap={1} flexWrap="wrap">
        {d.design === undefined ? null : <Button key="adopt-preview-design" label={S.adoptPreview === 'design' ? 'Hide DESIGN.md' : 'Show DESIGN.md'} plain onPress={() => preview($, 'design')} />}
        {d.plan === undefined ? null : <Button key="adopt-preview-plan" label={S.adoptPreview === 'plan' ? 'Hide PLAN.md' : 'Show PLAN.md'} plain onPress={() => preview($, 'plan')} />}
      </Box>
      {S.adoptPreview === 'design' && d.design !== undefined ? <Markdown key="adopt-preview-md" text={body(d.design)} /> : null}
      {S.adoptPreview === 'plan' && d.plan !== undefined ? <Markdown key="adopt-preview-md" text={body(d.plan)} /> : null}
      {names === undefined ? null : (
        <Box key="adopt-names" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
          <Text color="warning">A file with that name already exists and is never overwritten. Pick another name or cancel.</Text>
          {names.design === undefined ? null : (
            <Input key={DESIGN_NAME} label="DESIGN.md as" value={S.drafts.get(DESIGN_NAME) ?? names.design} submitLabel="Set" onInput={t => void S.drafts.set(DESIGN_NAME, t)} onSubmit={t => void S.drafts.set(DESIGN_NAME, t)} />
          )}
          {names.plan === undefined ? null : (
            <Input key={PLAN_NAME} label="PLAN.md as" value={S.drafts.get(PLAN_NAME) ?? names.plan} submitLabel="Set" onInput={t => void S.drafts.set(PLAN_NAME, t)} onSubmit={t => void S.drafts.set(PLAN_NAME, t)} />
          )}
          <Box flexDirection="row" columnGap={1}>
            <Button key="adopt-rename-apply" label="Apply with these names" onPress={() => applyRenamed($)} />
            <Button key="adopt-cancel" label="Cancel" onPress={() => cancelNames($)} />
          </Box>
        </Box>
      )}
      <Box key="adopt-actions" flexDirection="row" columnGap={1} flexWrap="wrap">
        <Button key="adopt-apply" label={`Apply selected (${d.ticked})`} {...(d.ticked > 0 ? {} : { dimColor: true })} onPress={() => apply($)} />
        <Button key="adopt-again" label="Convert other files" plain onPress={() => again($)} />
      </Box>
      <Text dimColor>{ADOPT_HINT}</Text>
    </Box>
  )
}

// Handing ticket writing to a background agent, and one-shot answer suggestions.
import type { EngineInterface } from 'claude-code'

import { today } from './core/query'
import {
  DEFAULT_DESIGN,
  DEFAULT_PLAN,
  adoptPaths,
  adoptResult,
  allBuilds,
  applyProposal,
  blockedByFor,
  coveredDoneWhen,
  designLine,
  docsFollowUp,
  markProposal,
  missingNote,
  parseChangeNote,
  parseAdopt,
  parseDesign,
  parsePlan,
  parseProposal,
  planBatch,
  planBrief,
  planHash,
  setBindingLine,
  setFrontMatterKey,
  withDocsItem,
  withNoteFollowUp,
  type Build,
  type Roadmap,
} from './core/roadmap'
import type { Question } from './core/ticket'
import { S, abs, addPlanTicket, boardPath, changesFolder, createBoardFiles, createSkeleton, dir, editRow, folderOf, fullRoadmap, latestProposal, redraw, refresh, roadmapView, rowOf, saveJobs, say, type Job } from './store'

type $ = EngineInterface

export const WRITER = 'ticket-board:ticket-writer'
export const PLANNER = 'ticket-board:planner'

/** At most this many writer jobs run at once; tickets from the plan wait in `S.planQueue` for a slot. */
export const MAX_JOBS = 3

function rules($: $): string {
  return `${$.plugin.root}/skills/ticket/SKILL.md`
}

function brief($: $, number: string, folder: string, kind: Job['kind'], idea?: string): string {
  const path = `${dir()}/${folder}`
  const date = today(Date.now())
  const common = [
    `Repository root: ${S.root || S.cwd}. Ticket folder: ${path}/ (rd.md and eval.md). Board: ${boardPath()} (the board path the ticket rules mean).`,
    `Follow the ticket rules in ${rules($)} (read it first; the TEMPLATE folder next to it shows the exact sections).`,
    `Only write ${path}/rd.md and ${path}/eval.md. Never edit BOARD.md, never write code, never touch other files — writes elsewhere are refused.`,
    `When you resolve a question from the code yourself, keep it as a bullet and add a line under it: \`  **Resolved ${date} (agent, from code: <path>)**: <answer>\`.`,
    'Questions that only a person can decide (product choices, trade-offs, anything you would be guessing) stay as plain `- ` bullets under `## Open questions`, one question per bullet, each answerable in a sentence; offer the options you see in brackets.',
    'Finish with one short line saying what you wrote and how many questions are left open.',
  ]
  if (kind === 'draft')
    return [
      `Write ticket ${number} from the idea below. The folder already holds placeholder rd.md and eval.md (with the idea under "## Original request") and the board row exists as a draft.`,
      'Explore the codebase first so Touchpoints name real files and the eval checks use the project\'s real test and build commands. Replace both files completely, in the exact section order of the template; drop the "Original request" section once its content is in the ticket.',
      'If the idea is really several features, write the first one here and list the others as open questions ("Split out: …?").',
      ...common,
      '',
      'Idea:',
      idea ?? '',
    ].join('\n')
  if (kind === 'plan')
    return [
      `Write ticket ${number} from the plan build below. The folder already holds placeholder rd.md and eval.md and the board row exists as a draft with its Blocked by filled in from the build's Needs.`,
      'Explore the codebase first so Touchpoints name real files and the eval checks use the project\'s real test and build commands. Replace both files completely, in the exact section order of the template; drop the "Original request" section once its content is in the ticket.',
      'Keep the Type:, Plan: and Design: lines under the title exactly as given below (Design: is each covered section at its current Rev). Use the phase Goal and Exit to set the scope.',
      'In eval.md, turn every "Done when" line of the covered sections into its own check, each with a Run line (a real command or steps) and a Pass line (the observable result). Add at least one end-to-end check.',
      'Always fill ## Docs naming README.md (the section to add or change, or "README.md — no change: <why>") and keep the "Docs and README updated" check in eval.md. The pane checks both when you finish.',
      'Never edit the plan or the design: the pane writes the ticket number into PLAN.md itself.',
      ...common,
      '',
      'Plan build:',
      idea ?? '',
    ].join('\n')
  if (kind === 'enhance')
    return [
      `Improve draft ticket ${number}. Read its rd.md and eval.md and the code it touches, then fill missing or placeholder sections, sharpen Behaviour into observable bullets (edge and error cases), make Touchpoints real paths, fill ## Docs with the README.md sections and other docs this change makes stale (add the section if missing), and make eval checks concrete (keep or add the "Docs and README updated" check) (how to run + pass criterion; at least one end-to-end check).`,
      'Keep every answer a person already gave (lines with "Resolved … (human)") and keep the ticket\'s intent; do not invent requirements a person has not asked for — ask instead.',
      ...common,
    ].join('\n')
  return [
    `Fold the answered questions of ticket ${number} into the ticket. For each question under "## Open questions" that has a "Resolved …" line, move what the answer decides into What / Behaviour / Scope / Touchpoints / Docs (and eval.md checks if it changes how the ticket is verified), then remove that question.`,
    `Keep unresolved questions exactly as they are. If no unresolved question is left, the section becomes the single line \`- none (resolved ${date}; answers folded into the ticket)\`.`,
    ...common,
  ].join('\n')
}

/** The row note for a job: the AI status, then the job's own note (a missing dependency) when it has one. */
export function jobNote(label: string, extra: string | undefined): string {
  return extra === undefined || extra === '' ? label : `${label} · ${extra}`
}

/** Only notes the pane wrote itself (empty, or starting with `AI `) are replaced. */
async function setAiNote($: $, number: string, note: string) {
  const row = rowOf(number)
  if (row !== undefined && (row.notes === '' || row.notes.startsWith('AI '))) await editRow($, number, { notes: note }).catch(() => undefined)
}

/** Records a failed plan ticket: the Plan view shows the reason and offers Create again. */
export async function failPlan($: $, build: string, number: string, reason: string, extra?: string) {
  S.planFailed.set(build, { number, reason })
  await setAiNote($, number, jobNote(`AI plan ticket failed (${reason})`, extra))
  redraw($)
}

/** The newest listed agent with this description that is not already a job; undefined when agent.list cannot tell. */
async function listedWriter($: $, description: string): Promise<string | undefined> {
  try {
    const listed = await $.agent.list()
    return listed.filter(a => a.description === description && !S.jobs.has(a.id)).at(-1)?.id
  } catch {
    return undefined
  }
}

/** `plan` is set for a ticket from a plan build (0008): its build, folder and missing-dependency note. */
export async function startJob(
  $: $,
  number: string,
  kind: Job['kind'],
  idea?: string,
  plan?: { build: string; folder: string; extra: string },
): Promise<boolean> {
  const folder = plan?.folder ?? folderOf(number)
  if (folder === undefined) {
    say($, `Ticket ${number} has no folder to write in`, 'error')
    return false
  }
  if ([...S.jobs.values()].some(j => j.number === number)) {
    say($, `An AI job is already working on ${number}`, 'warning')
    return false
  }
  const label = kind === 'draft' || kind === 'plan' ? 'AI drafting…' : kind === 'enhance' ? 'AI enhancing…' : 'AI folding answers in…'
  const description = `${kind === 'fold' ? 'Fold answers into' : kind === 'draft' || kind === 'plan' ? 'Write' : 'Enhance'} ticket ${number}${plan === undefined ? '' : ` (${plan.build})`}`
  let r: { deny: string } | { agentId?: string }
  try {
    r = await $.agent.spawn({
      prompt: brief($, number, folder, kind, idea),
      description,
      subagentType: WRITER,
      ...(S.options.writerModel ? { model: S.options.writerModel } : {}),
      name: `ticket-${number}`,
    })
  } catch (err) {
    r = { deny: err instanceof Error ? err.message : String(err) }
  }
  if ('deny' in r) {
    say($, `Could not start the ticket writer: ${r.deny}`, 'error')
    if (plan !== undefined) await failPlan($, plan.build, number, r.deny, plan.extra)
    return false
  }
  // A spawn that does not hand back its id: find the new agent in this session's list by its description.
  const agentId = r.agentId ?? (await listedWriter($, description))
  if (agentId === undefined) {
    say($, 'The ticket writer started without an agent id; refresh when it is done', 'warning')
    return true
  }
  S.jobs.set(agentId, {
    agentId,
    number,
    kind,
    startedAt: Date.now(),
    ...(plan === undefined ? {} : { build: plan.build, extra: plan.extra }),
  })
  await saveJobs($)
  await setAiNote($, number, jobNote(label, plan?.extra))
  if (plan === undefined) say($, `${label.replace('…', '')} ticket ${number} in the background`)
  return true
}

// ---------- Tickets from the plan (0008) ----------

let pumping = false
let pumpAgain = false

/**
 * Starts queued plan tickets while fewer than MAX_JOBS writer jobs run. Called after a batch is
 * queued and whenever a job ends; one pass at a time, so a slot is never handed out twice.
 */
export async function pumpPlanQueue($: $): Promise<void> {
  if (pumping) {
    pumpAgain = true
    return
  }
  pumping = true
  try {
    do {
      pumpAgain = false
      while (S.planQueue.length > 0 && runningJobs() < MAX_JOBS) {
        const q = S.planQueue.shift()!
        await startJob($, q.number, 'plan', q.brief, { build: q.build, folder: q.folder, extra: q.extra })
        redraw($)
      }
    } while (pumpAgain)
  } finally {
    pumping = false
  }
}

/** The writer state of a plan build this session: waiting for a slot, writing, or failed with a reason. */
export function planJobOf(buildId: string): { state: 'queued' | 'writing' | 'failed'; number: string; reason?: string } | undefined {
  const q = S.planQueue.find(x => x.build === buildId)
  if (q !== undefined) return { state: 'queued', number: q.number }
  const j = [...S.jobs.values()].find(x => x.kind === 'plan' && x.build === buildId)
  if (j !== undefined) return { state: 'writing', number: j.number }
  const f = S.planFailed.get(buildId)
  return f === undefined ? undefined : { state: 'failed', number: f.number, reason: f.reason }
}

/** A build a Create tickets press would make a ticket for: counted, no ticket yet, no writer job this session. */
export function isCreatable(rm: Roadmap, b: Build): boolean {
  return b.status === '' && (rm.links.byBuild[b.id] ?? []).length === 0 && b.tickets.length === 0 && planJobOf(b.id) === undefined
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/**
 * Create tickets for some builds of the bound plan (one build, a phase, or every not started
 * build). Each build without a ticket gets a skeleton (next number, folder, draft row with Blocked
 * by from Needs, `Plan:` and `Design:` lines), its number in the PLAN.md Ticket cell, and a queued
 * writer job. 0016 calls this for Add and Follow-up items too. Returns the new ticket numbers.
 */
export async function createPlanTickets($: $, buildIds: readonly string[], what: string): Promise<string[]> {
  if (S.isCreating) {
    say($, 'Still creating the last batch of tickets', 'warning')
    return []
  }
  S.isCreating = true
  const made: string[] = []
  // Tickets whose Blocked by was not written because BOARD.md has no Blocked by column.
  const lostDeps: string[] = []
  let tail: string[] = []
  // The batch's own error, never the banner: an old error still showing must not hide this summary.
  let stopped = false
  try {
    await refresh($, true)
    const rm = roadmapView()?.rm
    if (rm === undefined) {
      say($, 'No plan to create tickets from', 'warning')
      return []
    }
    const batch = planBatch(rm.plan, rm.links, [...new Set(buildIds)])
    tail = [
      batch.skipped.length === 0 ? '' : `skipped ${plural(batch.skipped.length, 'build')} that already ${batch.skipped.length === 1 ? 'has' : 'have'} a ticket`,
      batch.left.length === 0 ? '' : `left out ${batch.left.length} deferred or dropped`,
    ].filter(Boolean)
    if (batch.create.length === 0) {
      say($, `Nothing to create in ${what}${tail.length === 0 ? '' : `: ${tail.join(' · ')}`}`, 'warning')
      return []
    }
    const created = new Map<string, string>()
    for (const b of batch.create) {
      const { blockedBy, missing } = blockedByFor(b, rm.links, created)
      const extra = missingNote(missing)
      const brief = planBrief(rm.design, rm.plan, b)
      const { number, folder, skipped } = await createSkeleton(
        $,
        {
          title: b.name || b.id,
          text: brief,
          mode: 'solo',
          blockedBy,
          kind: 'feature',
          plan: b.id,
          design: designLine(rm.design, b.covers),
          checks: coveredDoneWhen(rm.design, b),
        },
        jobNote('AI queued', extra),
      )
      created.set(b.id, number)
      made.push(number)
      if (skipped.includes('blockedBy')) lostDeps.push(number)
      await addPlanTicket($, b.id, number)
      S.planFailed.delete(b.id)
      S.planQueue.push({ number, folder, build: b.id, brief, extra })
    }
  } catch (err) {
    stopped = true
    say($, [`Stopped creating tickets: ${err instanceof Error ? err.message : String(err)}`, lostDepsNote(lostDeps)].filter(Boolean).join(' · '), 'error')
  } finally {
    S.isCreating = false
  }
  if (made.length === 0) return made
  await refresh($, true).catch(() => undefined)
  await pumpPlanQueue($)
  if (stopped) return made
  const range = made.length === 1 ? made[0]! : `${made[0]}–${made[made.length - 1]}`
  const queued = S.planQueue.filter(q => made.includes(q.number)).length
  const failed = made.filter(n => [...S.planFailed.values()].some(f => f.number === n)).length
  say(
    $,
    [`Created ${plural(made.length, 'draft ticket')} from ${what} (${range})`, queued === 0 ? '' : `${queued} queued`, failed === 0 ? '' : `${failed} failed to start`, lostDepsNote(lostDeps), ...tail]
      .filter(Boolean)
      .join(' · '),
    failed > 0 || lostDeps.length > 0 ? 'warning' : 'success',
  )
  return made
}

/** `Blocked by not saved for 0003, 0004: BOARD.md has no Blocked by column`, or '' when nothing was lost. */
function lostDepsNote(numbers: readonly string[]): string {
  return numbers.length === 0 ? '' : `Blocked by not saved for ${numbers.join(', ')}: BOARD.md has no Blocked by column`
}

/** Create again for a plan build whose writer failed: the same ticket goes back in the queue. */
export async function retryPlanBuild($: $, buildId: string): Promise<void> {
  const f = S.planFailed.get(buildId)
  const rm = roadmapView()?.rm
  const b = rm === undefined ? undefined : allBuilds(rm.plan).find(x => x.id === buildId)
  const folder = f === undefined ? undefined : folderOf(f.number)
  if (f === undefined || rm === undefined || b === undefined || folder === undefined) {
    say($, `Nothing to create again for ${buildId}`, 'warning')
    return
  }
  S.planFailed.delete(buildId)
  const extra = missingNote(blockedByFor(b, rm.links, new Map()).missing)
  S.planQueue.push({ number: f.number, folder, build: buildId, brief: planBrief(rm.design, rm.plan, b), extra })
  await setAiNote($, f.number, jobNote('AI queued', extra))
  await pumpPlanQueue($)
  if (!S.planFailed.has(buildId)) say($, `Writing ticket ${f.number} for ${buildId} again`)
}

// ---------- Replan: proposal, review and apply (0016) ----------

/** What Apply shows, writing nothing, when PLAN.md is not the plan the proposal was made from. */
export const PLAN_CHANGED = 'plan changed; regenerate the proposal'

async function readText($: $, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(abs(path))
  } catch {
    return undefined
  }
}

type ReplanFacts = { designPath: string; planPath: string; designVersion: number; planVersion: number | undefined; path: string; hash: string; date: string; changes: string }

function replanBrief($: $, a: ReplanFacts): string {
  return [
    `Mode: replan. The plan is behind the design: ${a.planPath} has design-version ${a.planVersion ?? '(none)'}, ${a.designPath} is version ${a.designVersion}.`,
    `Repository root: ${S.root || S.cwd}. Board: ${boardPath()}. Change notes: ${a.changes}/. Today: ${a.date}.`,
    `Follow ${$.plugin.root}/agents/planner.md (mode replan) and the proposal format in ${$.plugin.root}/docs/STANDARD.md, section 8.`,
    `Write only ${a.path}. Never edit PLAN.md, DESIGN.md, BOARD.md, a change note or any ticket — writes elsewhere are refused.`,
    'Start the file with exactly this front matter (plan-hash identifies the plan you are reading; keep it as given):',
    '---',
    'change: replan',
    `date: ${a.date}`,
    `design-version: ${a.designVersion}`,
    `plan-hash: ${a.hash}`,
    '---',
    `Then \`# Replan for design v${a.designVersion}\`, \`## Why\`, and the headings \`## Add\`, \`## Change\`, \`## Drop\`, \`## Follow-up\` in that order. Under each, one \`- [ ] \` line per item with its reason on the next line, indented two spaces; \`- none\` under an empty heading.`,
    '- Add and Change items are the whole build row: `- [ ] | P2.3 | Name | M | P2.1 | D9 | done when |` (# | Build | Size | Needs | Covers | Done when; no Ticket or Status cell). Add takes the next unused id of its phase.',
    '- Drop items name the build: `- [ ] P2.2 · Name` (it gets Status dropped; the row stays).',
    '- Follow-up items are new draft tickets: `- [ ] P1.1 · What the new ticket does` (the build it belongs to) or just the title.',
    'A build whose ticket is done is never changed: propose a Follow-up for it. In-progress tickets are not rewritten either. Never propose making a ticket ready.',
    'When a change alters behaviour that README.md or docs/ describe, add exactly one Follow-up item `Update README/docs for <change>`.',
    'Finish with one line: the file written and the number of items per heading.',
  ].join('\n')
}

/** The banner's Replan: a planner agent writes `design/changes/<date>-replan.md` and nothing else. */
export async function startReplan($: $): Promise<boolean> {
  if (S.replanJob !== undefined) {
    say($, 'The planner is already writing a replan proposal', 'warning')
    return false
  }
  await refresh($, true)
  const b = S.snap?.binding
  if (b?.designPath === undefined || b.planPath === undefined) {
    say($, 'Replan needs a bound DESIGN.md and PLAN.md', 'warning')
    return false
  }
  const plan = await readText($, b.planPath)
  const design = parseDesign(b.design)
  if (plan === undefined || design.version === undefined) {
    say($, `Could not read ${plan === undefined ? b.planPath : `the design version in ${b.designPath}`}`, 'error')
    return false
  }
  const date = today(Date.now())
  const changes = changesFolder(b.designPath)
  const path = `${changes}/${date}-replan.md`
  const hash = planHash(plan)
  const description = `Replan proposal for design v${design.version}`
  let r: { deny: string } | { agentId?: string }
  try {
    r = await $.agent.spawn({
      prompt: replanBrief($, { designPath: b.designPath, planPath: b.planPath, designVersion: design.version, planVersion: parsePlan(plan).designVersion, path, hash, date, changes }),
      description,
      subagentType: PLANNER,
      name: 'replan',
    })
  } catch (err) {
    r = { deny: err instanceof Error ? err.message : String(err) }
  }
  if ('deny' in r) {
    say($, `Could not start the planner: ${r.deny}`, 'error')
    return false
  }
  const agentId = r.agentId ?? (await listedWriter($, description))
  if (agentId === undefined) {
    say($, 'The planner started without an agent id; refresh when it is done', 'warning')
    return true
  }
  S.replanJob = { agentId, path, hash }
  say($, `The planner is writing ${path}`)
  return true
}

/** Is `path` (as a tool gave it) the replan proposal the planner may write? */
export function isReplanFile(path: string): boolean {
  const job = S.replanJob
  if (job === undefined) return false
  const full = abs(path).replace(/\/\.\//g, '/')
  return !full.includes('/../') && full === abs(job.path)
}

/**
 * The planner ended. A proposal without `plan-hash` gets the hash of PLAN.md from when the run
 * started. When README mentions a section the redesign changed, the proposal gets one
 * "Update README/docs for …" Follow-up item and the newest redesign note lists it under Follow-ups.
 */
export async function finishReplan($: $, failed: boolean, reason: string): Promise<void> {
  const job = S.replanJob
  if (job === undefined) return
  S.replanJob = undefined
  await refresh($, true)
  if (failed) return say($, `The planner stopped (${reason}); no replan proposal`, 'error')
  const text = await readText($, job.path)
  if (text === undefined) return say($, `The planner finished without writing ${job.path}`, 'warning')
  let next = parseProposal(text).planHash === '' ? setFrontMatterKey(text, 'plan-hash', job.hash) : text
  const b = S.snap?.binding
  const design = parseDesign(b?.design)
  const planVersion = parsePlan(b?.plan).designVersion ?? 0
  const notes = Object.entries(S.snap?.changeNotes ?? {})
    .filter(([name]) => /design-v\d+\.md$/i.test(name))
    .map(([name, t]) => ({ name, t, note: parseChangeNote(t, name) }))
    .filter(n => (n.note.version ?? 0) > planVersion)
    .sort((x, y) => (x.note.version ?? 0) - (y.note.version ?? 0))
  const docs = docsFollowUp(S.project?.readme, design, notes.map(n => n.note))
  if (docs !== undefined) {
    next = withDocsItem(next, docs, 'README describes behaviour this redesign changes.')
    const newest = notes[notes.length - 1]
    if (newest !== undefined && b?.designPath !== undefined) {
      const noted = withNoteFollowUp(newest.t, docs)
      if (noted !== newest.t) await $.fs.write(abs(`${changesFolder(b.designPath)}/${newest.name}`), noted)
    }
  }
  if (next !== text) await $.fs.write(abs(job.path), next)
  await refresh($, true)
  const open = parseProposal(next).items.filter(i => i.state === 'open').length
  const line = `Replan proposal ready: ${open} item${open === 1 ? '' : 's'} to review`
  $.ui.toast(line)
  say($, `${line} in ${job.path}`)
}

/**
 * A proposal written without the pane (the planning skill from the CLI) has no `plan-hash`: when
 * Review replan opens it, it gets the hash of PLAN.md as it is now, the plan the person reviews against.
 */
export async function stampProposal($: $): Promise<void> {
  const lp = latestProposal()
  const planPath = S.snap?.binding?.planPath
  if (lp?.text === undefined || lp.proposal === undefined || !lp.proposal.hasGroups || lp.proposal.planHash !== '' || planPath === undefined) return
  const plan = await readText($, planPath)
  if (plan === undefined) return
  await $.fs.write(abs(lp.path), setFrontMatterKey(lp.text, 'plan-hash', planHash(plan)))
  await refresh($, true)
}

/** What a Follow-up item's draft ticket is written from: the item, its reason and its build (when it names one). */
function followUpBrief(rm: Roadmap | undefined, b: Build | undefined, f: { title: string; reason: string }): string {
  return [
    `Follow-up from the replan: ${f.title}`,
    `Reason: ${f.reason || '—'}`,
    'A follow-up never edits a done ticket: this new ticket does the change.',
    '',
    ...(b === undefined || rm === undefined ? ['Lines under the title of rd.md:', 'Type: feature'] : [planBrief(rm.design, rm.plan, b)]),
  ].join('\n')
}

/** Follow-up items become draft tickets through the plan create path: skeleton, Plan cell when they name a build, queued writer. */
export async function createFollowUps($: $, items: readonly { build?: string; title: string; reason: string }[]): Promise<string[]> {
  const made: string[] = []
  for (const f of items) {
    const rm = roadmapView()?.rm
    const b = f.build === undefined || rm === undefined ? undefined : allBuilds(rm.plan).find(x => x.id === f.build)
    const brief = followUpBrief(rm, b, f)
    const { number, folder } = await createSkeleton(
      $,
      {
        title: f.title,
        text: brief,
        mode: 'solo',
        blockedBy: [],
        kind: 'feature',
        ...(b === undefined || rm === undefined ? {} : { plan: b.id, design: designLine(rm.design, b.covers), checks: coveredDoneWhen(rm.design, b) }),
      },
      jobNote('AI queued', ''),
    )
    if (b !== undefined) await addPlanTicket($, b.id, number)
    made.push(number)
    S.planQueue.push({ number, folder, build: b?.id ?? `follow-up-${number}`, brief, extra: '' })
  }
  if (made.length > 0) await pumpPlanQueue($)
  return made
}

/**
 * Apply selected: the ticked open items edit PLAN.md (Add, Change, Drop and `design-version`),
 * Add and Follow-up items become draft tickets, and the proposal marks them `[x]` with the new
 * plan's hash. Stops with PLAN_CHANGED and writes nothing when PLAN.md is not the plan the
 * proposal was made from. Nothing ticked is a no-op. Done tickets are never written.
 */
export async function applyReplan($: $, ticked: readonly number[]): Promise<void> {
  if (S.isApplying) return say($, 'Still applying the last selection', 'warning')
  S.isApplying = true
  try {
    await refresh($, true)
    const lp = latestProposal()
    if (lp === undefined) return say($, 'No replan proposal to apply', 'warning')
    const text = await readText($, lp.path)
    const proposal = text === undefined ? undefined : parseProposal(text, lp.name)
    if (text === undefined || proposal === undefined || !proposal.hasGroups) return say($, `Could not read the replan proposal: ${lp.path}`, 'error')
    const sel = proposal.items.filter(i => i.state === 'open' && ticked.includes(i.index)).map(i => i.index)
    if (sel.length === 0) return say($, 'Nothing ticked: nothing applied', 'warning')
    const planPath = S.snap?.binding?.planPath
    const plan = planPath === undefined ? undefined : await readText($, planPath)
    if (planPath === undefined || plan === undefined) return say($, 'No PLAN.md is bound to this board', 'error')
    if (proposal.planHash === '' || planHash(plan) !== proposal.planHash) return say($, PLAN_CHANGED, 'error')
    const r = applyProposal(plan, proposal, sel, parseDesign(S.snap?.binding?.design).version, today(Date.now()))
    if (r.md !== plan) await $.fs.write(abs(planPath), r.md)
    await refresh($, true)
    const added = r.added.length === 0 ? [] : await createPlanTickets($, r.added, 'the replan')
    const follow = await createFollowUps($, r.followUps)
    // The plan the remaining items now apply to: its hash goes into the proposal with the ticks.
    const after = (await readText($, planPath)) ?? r.md
    await $.fs.write(abs(lp.path), markProposal(text, proposal, new Map(r.applied.map(i => [i, 'applied' as const])), planHash(after)))
    for (const i of r.applied) S.replanTicks.delete(i)
    await refresh($, true)
    const made = [...added, ...follow]
    const left = proposal.items.filter(i => i.state === 'open').length - r.applied.length
    say(
      $,
      [
        `Applied ${plural(r.applied.length, 'item')}`,
        made.length === 0 ? '' : `${plural(made.length, 'draft ticket')} (${made.join(', ')})`,
        r.skipped.length === 0 ? '' : `skipped ${r.skipped.map(s => s.why).join('; ')}`,
        left === 0 ? 'nothing left to review' : `${left} left to review`,
      ]
        .filter(Boolean)
        .join(' · '),
      r.skipped.length > 0 ? 'warning' : 'success',
    )
  } finally {
    S.isApplying = false
  }
}

/** Dismiss selected: the ticked open items are marked `[-]` in the proposal; PLAN.md and tickets are not touched. */
export async function dismissReplan($: $, ticked: readonly number[]): Promise<void> {
  const lp = latestProposal()
  const text = lp === undefined ? undefined : await readText($, lp.path)
  if (lp === undefined || text === undefined) return say($, `Could not read the replan proposal${lp === undefined ? '' : `: ${lp.path}`}`, 'error')
  const proposal = parseProposal(text, lp.name)
  const sel = proposal.items.filter(i => i.state === 'open' && ticked.includes(i.index)).map(i => i.index)
  if (sel.length === 0) return say($, 'Nothing ticked: nothing dismissed', 'warning')
  await $.fs.write(abs(lp.path), markProposal(text, proposal, new Map(sel.map(i => [i, 'dismissed' as const]))))
  for (const i of sel) S.replanTicks.delete(i)
  await refresh($, true)
  say($, `Dismissed ${plural(sel.length, 'item')}`)
}

// ---------- Adopt existing docs (0009) ----------

/** Where adopt proposals go: `design/changes/` beside the default DESIGN.md. */
export const ADOPT_FOLDER = changesFolder(DEFAULT_DESIGN)

/** Writer jobs, the adopt agent included: what the 3-slot queue counts. */
export const runningJobs = () => S.jobs.size + (S.adoptJob === undefined ? 0 : 1)

function adoptBrief($: $, a: { path: string; sources: string[]; date: string }): string {
  return [
    'Mode: adopt. Convert the person\'s existing documents into a draft design and plan in the ticket-board file standard, as a proposal they review in the pane.',
    `Repository root: ${S.root || S.cwd}. Board: ${boardPath()}. Today: ${a.date}.`,
    `Source files and folders (read these, and only the code you need for context): ${a.sources.join(', ')}.`,
    `Follow ${$.plugin.root}/agents/planner.md (mode adopt) and ${$.plugin.root}/docs/STANDARD.md: sections 2 (DESIGN.md) and 3 (PLAN.md) for the drafts, section 9 for the proposal file.`,
    `Write only ${a.path}. Never edit or delete a source file, and never write DESIGN.md, PLAN.md, BOARD.md, code or any other file: writes elsewhere are refused.`,
    'Start the file with exactly this front matter:',
    '---',
    'change: adopt',
    `date: ${a.date}`,
    `sources: ${a.sources.join(', ')}`,
    '---',
    'Then `# Adopt existing docs`, and these headings in order:',
    '- `## Sources`: one line per source file you read, `- <path>: <the D and P ids it became>` or `- <path>: left out (<why>)`.',
    '- `## Reasons`: one line per design section, phase and build, `- D1: <where it comes from in the sources>`.',
    '- `## DESIGN.md`: the whole design draft inside a `~~~~markdown` fence (front matter `design`, `version: 1`, `status: draft`, `updated`; context sections; `## D<n> · Title` sections with Rev 1, Why, What, Done when).',
    '- `## PLAN.md`: the whole plan draft inside a `~~~~markdown` fence (front matter `plan`, `design-version: 1`, `updated`; `## P<n> · Title` phases with Goal, Appetite, Exit and the build table `| # | Build | Size | Needs | Covers | Done when | Ticket |`).',
    'Ids: a source that already uses the standard\'s ids (D1…, P1…, P1.1…) keeps them; new ids take the next unused number; never reuse or renumber an id. Ticket cells are `—` unless a source names an existing ticket.',
    'Anything you cannot map to a section, phase or build becomes an open question (`### Open questions`, `- [ ] …`) under the closest design section: ask, never guess.',
    'Finish with one line: the file written and the number of sections, phases and builds.',
  ].join('\n')
}

/** Reads the adopt box's paths, checks each is inside the project and exists, and starts the converting agent. Starts nothing on an error. */
export async function startAdopt($: $, input: string): Promise<boolean> {
  if (S.adoptJob !== undefined) {
    say($, 'The adopt agent is already converting your docs', 'warning')
    return false
  }
  const { paths, error } = adoptPaths(input, S.root || S.cwd)
  if (error !== undefined) {
    say($, error, 'error')
    return false
  }
  for (const p of paths) {
    let found = false
    try {
      found = await $.fs.exists(abs(p))
    } catch {
      found = false
    }
    if (!found) {
      say($, `${p} was not found in this project`, 'error')
      return false
    }
  }
  const date = today(Date.now())
  let path = `${ADOPT_FOLDER}/${date}-adopt.md`
  for (let n = 2; (await $.fs.exists(abs(path)).catch(() => false)) && n < 100; n++) path = `${ADOPT_FOLDER}/${date}-adopt-${n}.md`
  const description = 'Adopt existing docs'
  let r: { deny: string } | { agentId?: string }
  try {
    r = await $.agent.spawn({
      prompt: adoptBrief($, { path, sources: paths, date }),
      description,
      subagentType: PLANNER,
      ...(S.options.writerModel ? { model: S.options.writerModel } : {}),
      name: 'adopt',
    })
  } catch (err) {
    r = { deny: err instanceof Error ? err.message : String(err) }
  }
  if ('deny' in r) {
    say($, `Could not start the adopt agent: ${r.deny}`, 'error')
    return false
  }
  const agentId = r.agentId ?? (await listedWriter($, description))
  if (agentId === undefined) {
    say($, 'The adopt agent started without an agent id; refresh when it is done', 'warning')
    return true
  }
  S.adoptJob = { agentId, path, sources: paths }
  S.adoptFile = undefined
  S.adoptOff.clear()
  S.adoptNames = undefined
  say($, `Converting ${paths.join(', ')}: the agent writes ${path}; nothing else changes`)
  return true
}

/** Is `path` (as a tool gave it) the adopt proposal the agent may write? */
export function isAdoptFile(path: string): boolean {
  const job = S.adoptJob
  if (job === undefined) return false
  const full = abs(path).replace(/\/\.\//g, '/')
  return !full.includes('/../') && full === abs(job.path)
}

/** The newest adopt proposal not applied yet, read into `S.adoptFile` (kept when it is the one already there). */
export async function loadAdopt($: $): Promise<void> {
  let entries: { name: string; kind: string; mtimeMs: number }[] = []
  try {
    entries = await $.fs.list(abs(ADOPT_FOLDER))
  } catch {
    entries = []
  }
  const names = entries
    .filter(e => e.kind === 'file' && /-adopt(-\d+)?\.md$/i.test(e.name))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
    .map(e => e.name)
  for (const name of names) {
    const path = `${ADOPT_FOLDER}/${name}`
    const text = await readText($, path)
    if (text === undefined || parseAdopt(text, name).isApplied) continue
    if (S.adoptFile?.path !== path || S.adoptFile.text !== text) {
      if (S.adoptFile?.path !== path) S.adoptOff.clear()
      S.adoptFile = { name, path, text }
      redraw($)
    }
    return
  }
  if (S.adoptFile !== undefined) {
    S.adoptFile = undefined
    redraw($)
  }
}

/** The adopt agent ended: its proposal goes up for review, or the reason it did not. */
export async function finishAdopt($: $, failed: boolean, reason: string): Promise<void> {
  const job = S.adoptJob
  if (job === undefined) return
  S.adoptJob = undefined
  await pumpPlanQueue($).catch(() => undefined)
  if (failed) return say($, `The adopt agent stopped (${reason}); nothing was written`, 'error')
  const text = await readText($, job.path)
  if (text === undefined) return say($, `The adopt agent finished without writing ${job.path}`, 'warning')
  const name = job.path.slice(job.path.lastIndexOf('/') + 1)
  S.adoptFile = { name, path: job.path, text }
  S.adoptOff.clear()
  S.adoptNames = undefined
  const p = parseAdopt(text, name)
  const line = `Conversion ready: ${plural(p.items.length, 'item')} to review`
  $.ui.toast(line)
  say($, p.items.length === 0 ? `${line}; ${p.warnings[0] ?? 'the proposal has no sections, phases or builds'}` : `${line} in ${job.path}`, p.items.length === 0 ? 'warning' : 'success')
}

/** "Pick another name or cancel": Cancel drops the names offered and writes nothing. */
export function cancelAdoptNames($: $) {
  S.adoptNames = undefined
  say($, 'Nothing was written', 'warning')
}

/** `design/DESIGN.md` → `design/DESIGN-adopted.md`. */
const otherName = (path: string) => path.replace(/(\.md)?$/i, m => `-adopted${m || '.md'}`)

/** A name typed for DESIGN.md or PLAN.md: inside the project and ending in .md, else why not. */
function badName(path: string): string | undefined {
  const { paths, error } = adoptPaths(path, S.root || S.cwd)
  if (error !== undefined || paths.length !== 1) return error ?? `${path} is not one file name`
  return /\.md$/i.test(paths[0]!) ? undefined : `${path} must end in .md`
}

/**
 * Apply selected: writes DESIGN.md (`status: draft`, `version: 1`) and PLAN.md from the ticked
 * items, and the `Design: … · Plan: …` binding line under the BOARD.md title (making BOARD.md from
 * the template when there is none). Never overwrites an existing DESIGN.md or PLAN.md: it offers
 * other names and writes nothing. Source files are never written. Then runs the roadmap checks.
 * Returns which view to show, or undefined when nothing was written.
 */
export async function applyAdopt($: $, names?: { design?: string; plan?: string }): Promise<'plan' | 'design' | undefined> {
  if (S.isApplying) {
    say($, 'Still applying the last selection', 'warning')
    return undefined
  }
  const file = S.adoptFile
  if (file === undefined) {
    say($, 'No adopt proposal to apply', 'warning')
    return undefined
  }
  S.isApplying = true
  try {
    const text = await readText($, file.path)
    if (text === undefined) {
      say($, `Could not read the adopt proposal: ${file.path}`, 'error')
      return undefined
    }
    const p = parseAdopt(text, file.name)
    const date = today(Date.now())
    const r = adoptResult(p, S.adoptOff, date)
    if (r.design === undefined && r.plan === undefined) {
      say($, `Nothing to apply: ${file.path} has no DESIGN.md or PLAN.md draft`, 'error')
      return undefined
    }
    if (r.sections + r.phases + r.builds === 0) {
      say($, 'Nothing ticked: nothing applied', 'warning')
      return undefined
    }
    const designPath = r.design === undefined ? undefined : (names?.design ?? DEFAULT_DESIGN).trim()
    const planPath = r.plan === undefined ? undefined : (names?.plan ?? DEFAULT_PLAN).trim()
    for (const n of [designPath, planPath]) {
      const bad = n === undefined ? undefined : badName(n)
      if (bad !== undefined) {
        say($, bad, 'error')
        return undefined
      }
    }
    if (designPath !== undefined && designPath === planPath) {
      say($, 'DESIGN.md and PLAN.md need two different names', 'error')
      return undefined
    }
    const exists = async (path: string | undefined) => path !== undefined && (await $.fs.exists(abs(path)).catch(() => true))
    const taken = { design: await exists(designPath), plan: await exists(planPath) }
    if (taken.design || taken.plan) {
      S.adoptNames = {
        ...(designPath === undefined ? {} : { design: taken.design ? otherName(designPath) : designPath }),
        ...(planPath === undefined ? {} : { plan: taken.plan ? otherName(planPath) : planPath }),
      }
      const which = [taken.design ? designPath : '', taken.plan ? planPath : ''].filter(Boolean).join(' and ')
      say($, `${which} already ${taken.design && taken.plan ? 'exist' : 'exists'}: pick another name or cancel. Nothing was written.`, 'warning')
      return undefined
    }
    if (r.design !== undefined && designPath !== undefined) await $.fs.write(abs(designPath), r.design)
    if (r.plan !== undefined && planPath !== undefined) await $.fs.write(abs(planPath), r.plan)
    const hadBoard = (await readText($, boardPath())) !== undefined
    if (!hadBoard) await createBoardFiles($)
    const board = (await readText($, boardPath())) ?? ''
    const bound = setBindingLine(board, designPath, planPath)
    if (bound !== board) await $.fs.write(abs(boardPath()), bound)
    await $.fs.write(abs(file.path), setFrontMatterKey(text, 'applied', date))
    S.adoptFile = undefined
    S.adoptOff.clear()
    S.adoptNames = undefined
    S.showBoard = true
    await refresh($, true)
    // The coverage checks from 0003 on what was just written.
    const rm = fullRoadmap()
    const alerts = rm?.checks ?? []
    const wrote = [designPath, planPath].filter(Boolean).join(' and ')
    say(
      $,
      [
        `Adopted ${plural(r.sections, 'section')}, ${plural(r.phases, 'phase')} and ${plural(r.builds, 'build')} into ${wrote}`,
        hadBoard ? '' : `created ${boardPath()}`,
        alerts.length === 0 ? 'checks: all clear' : `checks: ${alerts.map(a => a.message).join('; ')}`,
      ]
        .filter(Boolean)
        .join(' · '),
      alerts.some(a => a.severity !== 'info') ? 'warning' : 'success',
    )
    return r.plan !== undefined && r.builds > 0 ? 'plan' : 'design'
  } finally {
    S.isApplying = false
  }
}

/** Is `path` (as a tool gave it) inside the job's ticket folder? */
export function isInsideFolder(path: string, number: string): boolean {
  const folder = folderOf(number)
  if (folder === undefined) return false
  const root = abs(`${dir()}/${folder}`)
  const full = abs(path).replace(/\/\.\//g, '/')
  if (full.includes('/../')) return false
  return full === root || full.startsWith(`${root}/`)
}

export async function suggestAnswer($: $, number: string, q: Question): Promise<string | undefined> {
  const folder = folderOf(number)
  const rd = folder === undefined ? '' : (S.snap?.files.get(number)?.rd ?? '')
  const r = await $.model.complete(
    {
      model: 'haiku',
      system:
        'You help a person answer one open question on a software ticket. Reply with only the answer they could save: one or two plain sentences, decisive, no preamble, no markdown. If the ticket text already implies an answer, give it; otherwise pick the simplest sensible option and say it plainly.',
      prompt: `Ticket ${number}:\n\n${rd}\n\nQuestion: ${q.text}${q.detail ? `\nNotes under it: ${q.detail}` : ''}\n\nAnswer:`,
      maxTokens: 200,
      timeoutMs: 30_000,
    },
  )
  if (!r.isAnswered) {
    say($, `No suggestion (${r.reason})`, 'warning')
    return undefined
  }
  return r.text.trim().replace(/^answer:\s*/i, '')
}

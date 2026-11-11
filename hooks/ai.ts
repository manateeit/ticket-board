// Handing ticket writing to a background agent, and one-shot answer suggestions.
import type { EngineInterface } from 'claude-code'

import { today } from './core/query'
import {
  allBuilds,
  applyProposal,
  blockedByFor,
  coveredDoneWhen,
  designLine,
  docsFollowUp,
  markProposal,
  missingNote,
  parseChangeNote,
  parseDesign,
  parsePlan,
  parseProposal,
  planBatch,
  planBrief,
  planHash,
  setFrontMatterKey,
  withDocsItem,
  withNoteFollowUp,
  type Build,
  type Roadmap,
} from './core/roadmap'
import type { Question } from './core/ticket'
import { S, abs, addPlanTicket, changesFolder, createSkeleton, dir, editRow, folderOf, latestProposal, redraw, refresh, roadmapView, rowOf, saveJobs, say, type Job } from './store'

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
    `Repository root: ${S.root || S.cwd}. Ticket folder: ${path}/ (rd.md and eval.md). Board: ${dir()}/BOARD.md.`,
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
      while (S.planQueue.length > 0 && S.jobs.size < MAX_JOBS) {
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
  let tail: string[] = []
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
      const { number, folder } = await createSkeleton(
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
      await addPlanTicket($, b.id, number)
      S.planFailed.delete(b.id)
      S.planQueue.push({ number, folder, build: b.id, brief, extra })
    }
  } catch (err) {
    say($, `Stopped creating tickets: ${err instanceof Error ? err.message : String(err)}`, 'error')
  } finally {
    S.isCreating = false
  }
  if (made.length === 0) return made
  await refresh($, true).catch(() => undefined)
  const hadError = S.message?.tone === 'error'
  await pumpPlanQueue($)
  if (hadError) return made
  const range = made.length === 1 ? made[0]! : `${made[0]}–${made[made.length - 1]}`
  const queued = S.planQueue.filter(q => made.includes(q.number)).length
  const failed = made.filter(n => [...S.planFailed.values()].some(f => f.number === n)).length
  say(
    $,
    [`Created ${plural(made.length, 'draft ticket')} from ${what} (${range})`, queued === 0 ? '' : `${queued} queued`, failed === 0 ? '' : `${failed} failed to start`, ...tail]
      .filter(Boolean)
      .join(' · '),
    failed > 0 ? 'warning' : 'success',
  )
  return made
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
    `Repository root: ${S.root || S.cwd}. Board: ${dir()}/BOARD.md. Change notes: ${a.changes}/. Today: ${a.date}.`,
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

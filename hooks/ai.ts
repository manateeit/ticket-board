// Handing ticket writing to a background agent, and one-shot answer suggestions.
import type { EngineInterface } from 'claude-code'

import { today } from './core/query'
import type { Question } from './core/ticket'
import { S, abs, dir, editRow, folderOf, rowOf, saveJobs, say, type Job } from './store'

type $ = EngineInterface

export const WRITER = 'ticket-board:ticket-writer'

function rules($: $): string {
  return `${$.plugin.root}/skills/ticket/SKILL.md`
}

function brief($: $, number: string, folder: string, kind: Job['kind'], idea?: string): string {
  const path = `${dir()}/${folder}`
  const date = today(Date.now())
  const common = [
    `Repository root: ${S.cwd}. Ticket folder: ${path}/ (rd.md and eval.md). Board: ${dir()}/BOARD.md.`,
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
  if (kind === 'enhance')
    return [
      `Improve draft ticket ${number}. Read its rd.md and eval.md and the code it touches, then fill missing or placeholder sections, sharpen Behaviour into observable bullets (edge and error cases), make Touchpoints real paths, and make eval checks concrete (how to run + pass criterion; at least one end-to-end check).`,
      'Keep every answer a person already gave (lines with "Resolved … (human)") and keep the ticket\'s intent; do not invent requirements a person has not asked for — ask instead.',
      ...common,
    ].join('\n')
  return [
    `Fold the answered questions of ticket ${number} into the ticket. For each question under "## Open questions" that has a "Resolved …" line, move what the answer decides into What / Behaviour / Scope / Touchpoints (and eval.md checks if it changes how the ticket is verified), then remove that question.`,
    `Keep unresolved questions exactly as they are. If no unresolved question is left, the section becomes the single line \`- none (resolved ${date}; answers folded into the ticket)\`.`,
    ...common,
  ].join('\n')
}

export async function startJob($: $, number: string, kind: Job['kind'], idea?: string): Promise<boolean> {
  const folder = folderOf(number)
  if (folder === undefined) {
    say($, `Ticket ${number} has no folder to write in`, 'error')
    return false
  }
  if ([...S.jobs.values()].some(j => j.number === number)) {
    say($, `An AI job is already working on ${number}`, 'warning')
    return false
  }
  const label = kind === 'draft' ? 'AI drafting…' : kind === 'enhance' ? 'AI enhancing…' : 'AI folding answers in…'
  const r = await $.agent.spawn({
    prompt: brief($, number, folder, kind, idea),
    description: `${kind === 'fold' ? 'Fold answers into' : kind === 'draft' ? 'Write' : 'Enhance'} ticket ${number}`,
    subagentType: WRITER,
    ...(S.options.writerModel ? { model: S.options.writerModel } : {}),
    name: `ticket-${number}`,
  })
  if ('deny' in r) {
    say($, `Could not start the ticket writer: ${r.deny}`, 'error')
    return false
  }
  if (r.agentId === undefined) {
    say($, 'The ticket writer started without an agent id; refresh when it is done', 'warning')
    return true
  }
  S.jobs.set(r.agentId, { agentId: r.agentId, number, kind, startedAt: Date.now() })
  await saveJobs($)
  const row = rowOf(number)
  if (row !== undefined && (row.notes === '' || row.notes.startsWith('AI '))) await editRow($, number, { notes: label }).catch(() => undefined)
  say($, `${label.replace('…', '')} ticket ${number} in the background`)
  return true
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

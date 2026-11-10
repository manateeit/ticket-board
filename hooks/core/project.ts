/** What the pane shows at the top: which project and which repo it is working in. */
export type Project = {
  /** General name: README title, else package name, else the folder name. */
  name: string
  /** Folder the session runs in. */
  folder: string
  /** `owner/repo` when origin is on a known host, else the raw remote URL, else ''. */
  repo: string
  /** Web link to the repo, when origin is on GitHub, GitLab or Bitbucket. */
  repoUrl: string
  host: string
  branch: string
  isGit: boolean
  readmePath: string
  readme: string | undefined
  /** What the project is: the README's first paragraph, else package.json's description, else ''. */
  summary: string
  /** `unknown`: a .git is there but could not be read (the Start screen says "git status unknown"). */
  git: 'none' | 'repo' | 'unknown'
  /** The checked-out branch has at least one commit (from the refs files). */
  hasCommit: boolean
  /** Design and plan files found or bound (relative to the board's folder), '' when none. */
  designPath: string
  planPath: string
  /** A brainstorm result (`design/brief.md` or `design/brainstorms/…`), '' when none. */
  ideaPath: string
  /** The folder has files besides docs and dotfiles (offers "Draft a design from the code"). */
  hasCode: boolean
}

export const README_NAMES = ['README.md', 'Readme.md', 'readme.md', 'README.markdown', 'README']

/** The URL of `[remote "origin"]` in a .git/config file. */
export function originUrl(gitConfig: string): string {
  let inOrigin = false
  for (const raw of gitConfig.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(line)
      continue
    }
    const m = inOrigin ? /^url\s*=\s*(.+)$/.exec(line) : null
    if (m) return m[1]!.trim()
  }
  return ''
}

/** `git@github.com:o/r.git`, `https://github.com/o/r`, `ssh://git@host/o/r.git` → host + `o/r`. */
export function parseRemote(url: string): { host: string; repo: string; repoUrl: string } {
  if (url === '') return { host: '', repo: '', repoUrl: '' }
  const m = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/i.exec(url.trim())
  if (!m) return { host: '', repo: url, repoUrl: '' }
  const host = m[1]!.toLowerCase()
  const repo = m[2]!.replace(/^\/+/, '')
  const isKnown = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(host)
  return { host, repo, repoUrl: isKnown ? `https://${host}/${repo}` : '' }
}

/** `ref: refs/heads/main` → `main`; a detached HEAD → its short hash. */
export function parseHead(head: string): string {
  const t = head.trim()
  const m = /^ref:\s*refs\/heads\/(.+)$/.exec(t)
  if (m) return m[1]!
  return /^[0-9a-f]{7,40}$/i.test(t) ? t.slice(0, 7) : ''
}

/** A worktree's `.git` file: `gitdir: /path/.git/worktrees/x` → that path. */
export function parseGitFile(text: string): string {
  const m = /^gitdir:\s*(.+)$/m.exec(text)
  return m ? m[1]!.trim() : ''
}

/** The first `# Heading` of a README, without badges, links or trailing punctuation. */
export function readmeTitle(readme: string): string {
  let inFence = false
  for (const raw of readme.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence
    if (inFence) continue
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(raw)
    if (!m) continue
    const title = m[1]!
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (title !== '') return title
  }
  // Setext heading: a line underlined with ===
  const s = /^(\S.*)\r?\n=+\s*$/m.exec(readme)
  return s ? s[1]!.trim() : ''
}

export function packageName(pkgJson: string | undefined): string {
  if (pkgJson === undefined) return ''
  try {
    const name = (JSON.parse(pkgJson) as { name?: unknown }).name
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

export function folderName(cwd: string): string {
  return cwd.replace(/\/+$/, '').split('/').pop() ?? cwd
}

export function projectName(readme: string | undefined, pkgJson: string | undefined, cwd: string): string {
  return (readme !== undefined ? readmeTitle(readme) : '') || packageName(pkgJson) || folderName(cwd)
}

/**
 * What the project is, in one paragraph: the README's first prose paragraph after its title, as
 * plain text (badges, images, HTML, headings, lists, code and tables skipped; links and emphasis
 * unwrapped), cut at a sentence end near `max` characters. Falls back to package.json's description.
 */
export function readmeSummary(readme: string | undefined, pkgJson?: string, max = 320): string {
  const plain = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  let found = ''
  if (readme !== undefined) {
    let inFence = false
    let para: string[] = []
    const lines = readme.split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n]!
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        para = []
        continue
      }
      if (inFence) continue
      const isSetext = /^\s*(=+|-+)\s*$/.test(lines[n + 1] ?? '') && line.trim() !== ''
      const skip = /^\s*(#|>|\||[-*+]\s|\d+[.)]\s|<|!\[|\[!\[)/.test(line) || /^\s*(=+|-+)\s*$/.test(line) || isSetext
      if (line.trim() === '' || skip) {
        const text = plain(para.join(' '))
        if (text.length >= 20) {
          found = text
          break
        }
        para = []
        if (isSetext) n++
        continue
      }
      para.push(line)
    }
    if (found === '') {
      const text = plain(para.join(' '))
      if (text.length >= 20) found = text
    }
  }
  if (found === '' && pkgJson !== undefined) {
    try {
      const d = (JSON.parse(pkgJson) as { description?: unknown }).description
      if (typeof d === 'string') found = d.trim()
    } catch {
      // not JSON
    }
  }
  if (found.length <= max) return found
  const cut = found.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`
}

// ---------- Git facts and the Start screen's step ----------

/** Reads a file (path as given) and returns its text, or `undefined` when it is missing or unreadable. */
export type ReadFile = (path: string) => Promise<string | undefined>

export type GitFacts = {
  /** `none`: no .git here. `repo`: read. `unknown`: .git exists but could not be read. */
  state: 'none' | 'repo' | 'unknown'
  /** The repo's git dir (a worktree's own dir for a linked worktree), '' when none. */
  gitDir: string
  /** Where refs, packed-refs and config live (the main .git for a linked worktree). */
  commonDir: string
  config: string | undefined
  branch: string
  /** The checked-out branch has at least one commit. */
  hasCommit: boolean
}

/** Folds `a/b/../c/./d` into `a/c/d`, keeping a leading `/`. */
export function normalizePath(path: string): string {
  const parts = path.split('/').reduce<string[]>((acc, part) => (part === '..' ? acc.slice(0, -1) : part === '.' || part === '' ? acc : [...acc, part]), [])
  return `${path.startsWith('/') ? '/' : ''}${parts.join('/')}`
}

const HASH = /^[0-9a-f]{40,64}$/i

/**
 * Whether HEAD points at a commit, from the refs files alone: a detached HEAD holds a hash; a
 * branch has a commit when `refs/heads/<branch>` holds a hash or `packed-refs` lists it.
 */
export function commitFromRefs(head: string | undefined, branchRef: string | undefined, packedRefs: string | undefined): boolean {
  if (head === undefined) return false
  const t = head.trim()
  if (HASH.test(t)) return true
  const m = /^ref:\s*(refs\/\S+)$/.exec(t)
  if (m === null) return false
  if (branchRef !== undefined && HASH.test(branchRef.trim())) return true
  const ref = m[1]!
  return (packedRefs ?? '').split(/\r?\n/).some(l => /^[0-9a-f]{40,64}\s+(\S+)$/i.exec(l.trim())?.[1] === ref)
}

/**
 * The repo in `cwd`, read through `read` only (no git command, no other API): `.git/config`,
 * `.git/HEAD`, a worktree's `.git` pointer file and its `commondir`, the branch ref and packed-refs.
 * `gitExists` says whether a `.git` entry is present at all (to tell "no repo" from "unreadable").
 */
export async function readGitFacts(cwd: string, read: ReadFile, gitExists: boolean): Promise<GitFacts> {
  let gitDir = `${cwd}/.git`
  let commonDir = gitDir
  let config = await read(`${gitDir}/config`)
  let head = await read(`${gitDir}/HEAD`)
  if (config === undefined && head === undefined) {
    // A worktree or submodule: .git is a file that points at the real git dir.
    const pointer = await read(`${cwd}/.git`)
    const target = pointer === undefined ? '' : parseGitFile(pointer)
    if (target === '') {
      const state = gitExists || pointer !== undefined ? 'unknown' : 'none'
      return { state, gitDir: '', commonDir: '', config: undefined, branch: '', hasCommit: false }
    }
    gitDir = normalizePath(target.startsWith('/') ? target : `${cwd}/${target}`)
    head = await read(`${gitDir}/HEAD`)
    const common = ((await read(`${gitDir}/commondir`)) ?? '').trim()
    commonDir = normalizePath(common === '' ? gitDir.replace(/\/worktrees\/[^/]+\/?$/, '') : common.startsWith('/') ? common : `${gitDir}/${common}`)
    config = (await read(`${commonDir}/config`)) ?? (await read(`${gitDir}/config`))
  }
  if (head === undefined) return { state: 'unknown', gitDir, commonDir, config, branch: '', hasCommit: false }
  const ref = /^ref:\s*(refs\/\S+)$/.exec(head.trim())?.[1]
  const branchRef = ref === undefined ? undefined : await read(`${commonDir}/${ref}`)
  const packed = ref === undefined || branchRef !== undefined ? undefined : await read(`${commonDir}/packed-refs`)
  return { state: 'repo', gitDir, commonDir, config, branch: parseHead(head), hasCommit: commitFromRefs(head, branchRef, packed) }
}

/** Files at the top of a folder that are not code: docs, licences, dotfiles and the board's own folders. */
const NOT_CODE = /^(\..*|readme(\..*)?|licen[cs]e(\..*)?|changelog(\..*)?|contributing(\..*)?|code_of_conduct(\..*)?|notice(\..*)?|design|docs|tickets)$/i

/** The folder holds something besides docs and dotfiles (names of its top-level entries). */
export function hasCode(names: readonly string[], ticketsDir = 'tickets'): boolean {
  return names.some(n => !NOT_CODE.test(n) && n !== ticketsDir)
}

/** A brainstorm result: `design/brief.md` (any case), else the newest file under `design/brainstorms/`. '' when none. */
export function ideaFile(designEntries: readonly { name: string; kind: string }[], brainstorms: readonly { name: string; kind: string }[]): string {
  const brief = designEntries.find(e => e.kind === 'file' && /^brief\.md$/i.test(e.name))
  if (brief !== undefined) return `design/${brief.name}`
  const note = brainstorms
    .filter(e => e.kind === 'file' && /\.md$/i.test(e.name))
    .map(e => e.name)
    .sort()
    .at(-1)
  return note === undefined ? '' : `design/brainstorms/${note}`
}

export const START_STEPS = ['setup', 'idea', 'design', 'plan', 'tickets'] as const
export type StartStep = (typeof START_STEPS)[number] | 'done'

export type StartFacts = {
  git: 'none' | 'repo' | 'unknown'
  hasCommit: boolean
  /** origin is set (any host counts). */
  hasOrigin: boolean
  /** The person pressed Skip on the GitHub line. */
  isGithubSkipped: boolean
  hasIdea: boolean
  hasDesign: boolean
  hasPlan: boolean
  hasTickets: boolean
}

/** Setup is done when git is there with a commit and origin is set or skipped. Unreadable git does not hold the person up. */
export function isSetupDone(f: StartFacts): boolean {
  if (f.git === 'unknown') return true
  return f.git === 'repo' && f.hasCommit && (f.hasOrigin || f.isGithubSkipped)
}

/** The step the person is on: the first one not done, from the files alone (nothing is stored for it). */
export function startStep(f: StartFacts): StartStep {
  if (!isSetupDone(f)) return 'setup'
  if (!f.hasIdea && !f.hasDesign && !f.hasPlan) return 'idea'
  if (!f.hasDesign) return 'design'
  if (!f.hasPlan) return 'plan'
  if (!f.hasTickets) return 'tickets'
  return 'done'
}

/** The Start screen replaces the board when there is no design, no plan and no ticket. */
export function isBlankProject(f: Pick<StartFacts, 'hasDesign' | 'hasPlan' | 'hasTickets'>): boolean {
  return !f.hasDesign && !f.hasPlan && !f.hasTickets
}

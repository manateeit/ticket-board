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

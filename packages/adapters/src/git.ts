import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import type { GitStatus } from '@tupiniquim/contracts'

const execFileAsync = promisify(execFile)

export class GitAdapter {
  public constructor(private readonly workspaceRoot: () => string) {}

  private async run(args: string[], timeout = 20_000): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: this.workspaceRoot(), encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 5_000_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })
    return stdout
  }

  public async status(): Promise<GitStatus> {
    const raw = await this.run(['status', '--porcelain=v2', '--branch', '-z'])
    const parts = raw.split('\0').filter(Boolean)
    let branch = 'HEAD'
    let upstream: string | undefined
    let ahead = 0
    let behind = 0
    const entries: GitStatus['entries'] = []
    for (const part of parts) {
      if (part.startsWith('# branch.head ')) branch = part.slice(14)
      else if (part.startsWith('# branch.upstream ')) upstream = part.slice(18)
      else if (part.startsWith('# branch.ab ')) {
        const match = /\+(\d+) -(\d+)/.exec(part)
        ahead = Number(match?.[1] ?? 0)
        behind = Number(match?.[2] ?? 0)
      } else if (part.startsWith('1 ') || part.startsWith('2 ')) {
        const fields = part.split(' ')
        const xy = fields[1] ?? '..'
        entries.push({ path: fields.at(-1) ?? '', index: xy[0] ?? '.', worktree: xy[1] ?? '.' })
      } else if (part.startsWith('? ')) entries.push({ path: part.slice(2), index: '?', worktree: '?' })
    }
    return upstream === undefined ? { branch, ahead, behind, entries } : { branch, upstream, ahead, behind, entries }
  }

  public async diff(relativePath?: string): Promise<string> {
    const args = ['diff', '--no-ext-diff', '--unified=3']
    if (relativePath !== undefined) {
      if (path.isAbsolute(relativePath) || relativePath.includes('..')) throw new Error('Caminho de diff inválido.')
      args.push('--', relativePath)
    }
    return this.run(args)
  }
}

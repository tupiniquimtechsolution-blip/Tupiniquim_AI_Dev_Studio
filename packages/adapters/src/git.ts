import { parseGitStatus } from './git-status'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import type { GitStatus } from '@tupiniquim/contracts'
import { createRestrictedEnvironment } from './secret-environment'

const execFileAsync = promisify(execFile)

export class GitAdapter {
  public constructor(private readonly workspaceRoot: () => string) {}

  private async run(args: string[], timeout = 20_000): Promise<string> {
    const root = path.resolve(this.workspaceRoot())
    const { stdout } = await execFileAsync('git', ['-c', 'safe.directory=' + root, '-c', 'core.fsmonitor=false', ...args], { cwd: root, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 5_000_000, env: createRestrictedEnvironment({ GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_CEILING_DIRECTORIES: path.dirname(root) }) })
    return stdout
  }

  public async status(): Promise<GitStatus> {
    const raw = await this.run(['status', '--porcelain=v2', '--branch', '-z'])
    return parseGitStatus(raw)
  }

  public async diff(relativePath?: string): Promise<string> {
    const args = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--unified=3']
    if (relativePath !== undefined) {
      if (path.isAbsolute(relativePath) || relativePath.includes('..')) throw new Error('Caminho de diff inválido.')
      args.push('--', relativePath)
    }
    return this.run(args)
  }
}

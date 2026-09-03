import { randomUUID } from 'node:crypto'
import * as pty from 'node-pty'
import { resolveLexicalPath } from './path-security'
import { createRestrictedEnvironment } from './secret-environment'

export interface TerminalEvent { terminalId: string; data: string; exited?: boolean; exitCode?: number }

export class TerminalAdapter {
  private readonly terminals = new Map<string, pty.IPty>()
  private readonly terminalExits = new Map<string, Promise<void>>()

  public constructor(private readonly workspaceRoot: () => string, private readonly onEvent: (event: TerminalEvent) => void) {}

  public create(relativeCwd: string, cols: number, rows: number): string {
    const root = this.workspaceRoot()
    const cwd = relativeCwd === '' ? root : resolveLexicalPath(root, relativeCwd)
    const shell = 'powershell.exe'
    const terminalId = randomUUID()
    const terminal = pty.spawn(shell, ['-NoLogo', '-NoProfile'], {
      name: 'xterm-256color', cols, rows, cwd,
      env: createRestrictedEnvironment({ TERM: 'xterm-256color', TUPINIQUIM_WORKSPACE: root }), useConpty: true
    })
    terminal.onData((data) => this.onEvent({ terminalId, data }))
    const exited = new Promise<void>((resolve) => {
      terminal.onExit(({ exitCode }) => {
        this.terminals.delete(terminalId)
        this.terminalExits.delete(terminalId)
        this.onEvent({ terminalId, data: '', exited: true, exitCode })
        resolve()
      })
    })
    this.terminals.set(terminalId, terminal)
    this.terminalExits.set(terminalId, exited)
    return terminalId
  }

  public write(terminalId: string, data: string): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal === undefined) throw new Error('Terminal não encontrado.')
    terminal.write(data)
  }

  public resize(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal === undefined) throw new Error('Terminal não encontrado.')
    terminal.resize(cols, rows)
  }

  public async kill(terminalId: string): Promise<void> {
    const terminal = this.terminals.get(terminalId)
    if (terminal === undefined) return
    const exited = this.terminalExits.get(terminalId)
    terminal.kill()
    if (exited !== undefined) await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 5_000))])
  }

  public killAll(): void {
    for (const terminalId of this.terminals.keys()) void this.kill(terminalId)
  }
}

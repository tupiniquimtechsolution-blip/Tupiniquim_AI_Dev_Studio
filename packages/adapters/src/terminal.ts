import { randomUUID } from 'node:crypto'
import * as pty from 'node-pty'
import { resolveLexicalPath } from './path-security'

export interface TerminalEvent { terminalId: string; data: string; exited?: boolean; exitCode?: number }

export class TerminalAdapter {
  private readonly terminals = new Map<string, pty.IPty>()

  public constructor(private readonly workspaceRoot: () => string, private readonly onEvent: (event: TerminalEvent) => void) {}

  public create(relativeCwd: string, cols: number, rows: number): string {
    const root = this.workspaceRoot()
    const cwd = relativeCwd === '' ? root : resolveLexicalPath(root, relativeCwd)
    const shell = 'powershell.exe'
    const terminalId = randomUUID()
    const terminal = pty.spawn(shell, ['-NoLogo', '-NoProfile'], {
      name: 'xterm-256color', cols, rows, cwd,
      env: { ...process.env, TERM: 'xterm-256color', TUPINIQUIM_WORKSPACE: root }, useConpty: true
    })
    terminal.onData((data) => this.onEvent({ terminalId, data }))
    terminal.onExit(({ exitCode }) => { this.terminals.delete(terminalId); this.onEvent({ terminalId, data: '', exited: true, exitCode }) })
    this.terminals.set(terminalId, terminal)
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

  public kill(terminalId: string): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal === undefined) return
    terminal.kill(); this.terminals.delete(terminalId)
  }

  public killAll(): void {
    for (const terminal of this.terminals.values()) terminal.kill()
    this.terminals.clear()
  }
}

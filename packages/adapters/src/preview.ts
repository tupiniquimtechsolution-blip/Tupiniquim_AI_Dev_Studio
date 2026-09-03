import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { access } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import type { PreviewEvent, PreviewSession } from '@tupiniquim/contracts'
import { resolveExistingInside } from './path-security'
import { createRestrictedEnvironment } from './secret-environment'

interface ActivePreview { session: PreviewSession; child: ChildProcessWithoutNullStreams }

export interface PreviewAdapterOptions {
  toolRoot: string
  getWorkspaceRoot: () => string
  onEvent: (event: PreviewEvent) => void
}

const sanitizeOutput = (value: string): string => value.replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]').slice(0, 4_000)

const reservePort = async (): Promise<number> => await new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (address === null || typeof address === 'string') { server.close(); reject(new Error('Porta de preview indisponível.')); return }
    server.close((cause) => { if (cause !== undefined) reject(cause); else resolve(address.port) })
  })
})

const waitForPort = async (port: number, timeoutMs: number): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port })
      socket.once('connect', () => { socket.destroy(); resolve(true) })
      socket.once('error', () => resolve(false))
      socket.setTimeout(500, () => { socket.destroy(); resolve(false) })
    })
    if (connected) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('Timeout aguardando o servidor de preview.')
}

export class PreviewAdapter {
  private readonly sessions = new Map<string, ActivePreview>()

  public constructor(private readonly options: PreviewAdapterOptions) {}

  public async start(relativePath: string, width: number, height: number): Promise<PreviewSession> {
    const cwd = await resolveExistingInside(this.options.getWorkspaceRoot(), relativePath)
    const viteCli = path.join(this.options.toolRoot, 'node_modules', 'vite', 'bin', 'vite.js')
    await access(viteCli)
    const port = await reservePort()
    const id = randomUUID()
    const environment = createRestrictedEnvironment({ ELECTRON_RUN_AS_NODE: '1', BROWSER: 'none' })
    const child = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd, env: environment, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const session: PreviewSession = { id, kind: 'VITE', url: `http://127.0.0.1:${port}/`, cwd, pid: child.pid ?? -1, startedAt: new Date().toISOString(), width, height }
    this.sessions.set(id, { session, child })
    child.stdout.on('data', (chunk: Buffer) => this.emit(id, 'OUTPUT', sanitizeOutput(chunk.toString('utf8'))))
    child.stderr.on('data', (chunk: Buffer) => this.emit(id, 'OUTPUT', sanitizeOutput(chunk.toString('utf8'))))
    child.once('error', (cause) => this.emit(id, 'ERROR', cause.message))
    child.once('exit', (code) => { this.sessions.delete(id); this.emit(id, 'EXIT', `Processo encerrado com código ${String(code)}.`) })
    try {
      await waitForPort(port, 30_000)
      this.emit(id, 'READY', session.url)
      return session
    } catch (cause) {
      child.kill()
      this.sessions.delete(id)
      throw cause
    }
  }

  public resize(id: string, width: number, height: number): PreviewSession {
    const active = this.require(id)
    active.session = { ...active.session, width, height }
    return active.session
  }

  public stop(id: string): void {
    const active = this.require(id)
    active.child.kill()
    this.sessions.delete(id)
  }

  public stopAll(): void { for (const id of [...this.sessions.keys()]) this.stop(id) }

  private require(id: string): ActivePreview {
    const active = this.sessions.get(id)
    if (active === undefined) throw new Error('Preview não encontrado ou já encerrado.')
    return active
  }

  private emit(previewId: string, kind: PreviewEvent['kind'], detail: string): void { this.options.onEvent({ previewId, kind, detail, at: new Date().toISOString() }) }
}

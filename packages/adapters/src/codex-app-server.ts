import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { z } from 'zod'
import {
  agentInterruptInputSchema,
  agentSendInputSchema,
  aiStatusSchema,
  type AIAccountKind,
  type AIEvent,
  type AIProvider,
  type AIStatus,
  type AgentTurnReference
} from '@tupiniquim/contracts'
import { loadPrivateEnvironment } from './secret-environment'

const responseEnvelopeSchema = z.object({ id: z.union([z.number(), z.string()]), result: z.unknown().optional(), error: z.object({ code: z.number(), message: z.string() }).optional() })
const notificationEnvelopeSchema = z.object({ method: z.string(), params: z.unknown().optional() })
const initializeResponseSchema = z.object({ userAgent: z.string() })
const accountResponseSchema = z.object({ account: z.object({ type: z.string() }).nullable(), requiresOpenaiAuth: z.boolean() })
const threadStartResponseSchema = z.object({ thread: z.object({ id: z.string().min(1) }), model: z.string() })
const turnStartResponseSchema = z.object({ turn: z.object({ id: z.string().min(1) }) })
const messageDeltaSchema = z.object({ threadId: z.string(), turnId: z.string(), itemId: z.string(), delta: z.string() })
const itemCompletedSchema = z.object({ threadId: z.string(), turnId: z.string(), item: z.object({ type: z.string(), id: z.string(), text: z.string().optional() }).passthrough() })
const turnCompletedSchema = z.object({ threadId: z.string(), turn: z.object({ id: z.string(), status: z.string(), error: z.unknown().nullable().optional() }) })
const turnStartedSchema = z.object({ threadId: z.string(), turn: z.object({ id: z.string() }) })
const errorNotificationSchema = z.object({ threadId: z.string(), turnId: z.string(), willRetry: z.boolean(), error: z.object({ message: z.string().optional() }).passthrough() })

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (cause: Error) => void
  timer: NodeJS.Timeout
}

export interface CodexAppServerOptions {
  dataRoot: string
  projectRoot: string
  getWorkspaceRoot: () => string
  onEvent: (event: AIEvent) => void
  codexPath?: string
}

const redact = (value: string): string => value
  .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]')
  .replace(/(authorization|api[_-]?key|token)\s*[:=]\s*\S+/giu, '$1=[REDACTED]')
  .slice(0, 2_000)

const normalizeDiagnostic = (value: string): string => {
  if (/no credits remaining/iu.test(value)) return 'OpenAI API sem créditos disponíveis para este projeto.'
  if (/shell snapshot not supported/iu.test(value)) return 'Snapshot de shell PowerShell não é suportado por esta versão do Codex.'
  try {
    const parsed = JSON.parse(value) as { fields?: { message?: unknown } }
    if (typeof parsed.fields?.message === 'string') return redact(parsed.fields.message)
  } catch { /* diagnóstico não estruturado */ }
  return redact(value)
}

export const findCodexExecutable = async (): Promise<string> => {
  const explicit = process.env.TUPINIQUIM_CODEX_PATH
  if (explicit !== undefined && explicit !== '') return explicit
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData === undefined) throw new Error('LOCALAPPDATA indisponível; codex.exe não pôde ser localizado.')
  const binRoot = path.join(localAppData, 'OpenAI', 'Codex', 'bin')
  const directories = await readdir(binRoot, { withFileTypes: true })
  const candidates = await Promise.all(directories.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const executable = path.join(binRoot, entry.name, 'codex.exe')
    try { return { executable, modifiedAt: (await stat(executable)).mtimeMs } } catch { return null }
  }))
  const selected = candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null).sort((left, right) => right.modifiedAt - left.modifiedAt)[0]
  if (selected === undefined) throw new Error('codex.exe não encontrado na instalação local do Codex.')
  return selected.executable
}

export class CodexAppServerAdapter implements AIProvider {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextRequestId = 1
  private readonly pending = new Map<number | string, PendingRequest>()
  private readonly streamedItems = new Set<string>()
  private currentStatus: AIStatus = aiStatusSchema.parse({ provider: 'codex-app-server', state: 'DISCONNECTED', account: 'NONE', version: null, activeThreadId: null, activeTurnId: null, detail: null })
  private connectPromise: Promise<AIStatus> | null = null

  public constructor(private readonly options: CodexAppServerOptions) {}

  public status(): AIStatus { return this.currentStatus }

  public connect(): Promise<AIStatus> {
    if (this.currentStatus.state === 'READY' || this.currentStatus.state === 'BUSY') return Promise.resolve(this.currentStatus)
    if (this.connectPromise !== null) return this.connectPromise
    this.connectPromise = this.start().finally(() => { this.connectPromise = null })
    return this.connectPromise
  }

  private async start(): Promise<AIStatus> {
    this.updateStatus({ state: 'STARTING', detail: 'Inicializando Codex App Server.' })
    const codexPath = this.options.codexPath ?? await findCodexExecutable()
    const codexHome = path.join(this.options.dataRoot, 'codex-home')
    await mkdir(codexHome, { recursive: true })
    const environment = await loadPrivateEnvironment(this.options.projectRoot)
    environment.CODEX_HOME = codexHome
    this.child = spawn(codexPath, ['app-server', '--listen', 'stdio://', '-c', 'cli_auth_credentials_store="keyring"'], {
      cwd: this.options.projectRoot,
      env: environment,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    readline.createInterface({ input: this.child.stdout }).on('line', (line) => this.handleLine(line))
    readline.createInterface({ input: this.child.stderr }).on('line', (line) => {
      const detail = normalizeDiagnostic(line)
      if (detail !== '') this.emit({ kind: 'WARNING', detail })
    })
    this.child.once('exit', (code, signal) => this.handleExit(code, signal))
    this.child.once('error', (cause) => this.handleExit(null, cause.message))

    const initialized = initializeResponseSchema.parse(await this.request('initialize', {
      clientInfo: { name: 'tupiniquim-ai-dev-studio', title: 'Tupiniquim AI Dev Studio', version: '0.1.0' },
      capabilities: { experimentalApi: false, requestAttestation: false }
    }))
    this.notify('initialized')
    const apiKey = environment.OPENAI_API_KEY
    if (apiKey !== undefined && apiKey !== '') await this.request('account/login/start', { type: 'apiKey', apiKey })
    const account = accountResponseSchema.parse(await this.request('account/read', { refreshToken: false }))
    const accountKind = this.mapAccount(account.account?.type)
    this.updateStatus({ state: accountKind === 'NONE' && account.requiresOpenaiAuth ? 'AUTH_REQUIRED' : 'READY', account: accountKind, version: initialized.userAgent, detail: null })
    return this.currentStatus
  }

  public async send(rawInput: z.input<typeof agentSendInputSchema>): Promise<AgentTurnReference> {
    const input = agentSendInputSchema.parse(rawInput)
    const status = await this.connect()
    if (status.state === 'AUTH_REQUIRED') throw new Error('Codex requer autenticação. Configure uma chave local ou faça login no Codex.')
    const workspaceRoot = this.options.getWorkspaceRoot()
    let threadId = input.threadId
    if (threadId === undefined) {
      const response = threadStartResponseSchema.parse(await this.request('thread/start', {
        cwd: workspaceRoot,
        approvalPolicy: 'never',
        sandbox: 'read-only',
        ephemeral: false,
        developerInstructions: `Modo do Tupiniquim: ${input.mode}. Não altere arquivos nesta etapa; produza orientação e aguarde o fluxo de aprovação da aplicação.`
      }))
      threadId = response.thread.id
      this.currentStatus = { ...this.currentStatus, activeThreadId: threadId }
      this.emit({ kind: 'THREAD_STARTED', threadId, detail: `Modelo ${response.model}` })
    }
    const response = turnStartResponseSchema.parse(await this.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: input.message, text_elements: [] }]
    }))
    const reference = { threadId, turnId: response.turn.id }
    this.updateStatus({ state: 'BUSY', activeThreadId: threadId, activeTurnId: response.turn.id, detail: null })
    return reference
  }

  public async interrupt(rawInput: z.input<typeof agentInterruptInputSchema>): Promise<void> {
    const input = agentInterruptInputSchema.parse(rawInput)
    await this.request('turn/interrupt', input)
  }

  public async close(): Promise<void> {
    const child = this.child
    this.child = null
    this.rejectPending(new Error('Codex App Server encerrado.'))
    this.updateStatus({ state: 'STOPPED', activeTurnId: null, detail: null })
    if (child !== null && !child.killed && child.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5_000)
        child.once('exit', () => { clearTimeout(timeout); resolve() })
        child.kill()
      })
    }
  }

  private request(method: string, params: unknown, timeoutMs = 45_000): Promise<unknown> {
    const child = this.child
    if (child === null || child.stdin.destroyed) return Promise.reject(new Error('Codex App Server não está conectado.'))
    const id = this.nextRequestId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout no método ${method}.`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`, 'utf8')
    })
  }

  private notify(method: string): void {
    this.child?.stdin.write(`${JSON.stringify({ method })}\n`, 'utf8')
  }

  private handleLine(line: string): void {
    let parsed: unknown
    try { parsed = JSON.parse(line) } catch { this.emit({ kind: 'WARNING', detail: 'Linha JSONL inválida recebida do Codex App Server.' }); return }
    const response = responseEnvelopeSchema.safeParse(parsed)
    if (response.success && (response.data.result !== undefined || response.data.error !== undefined)) {
      const pending = this.pending.get(response.data.id)
      if (pending !== undefined) {
        clearTimeout(pending.timer)
        this.pending.delete(response.data.id)
        if (response.data.error !== undefined) pending.reject(new Error(`${response.data.error.code}: ${redact(response.data.error.message)}`))
        else pending.resolve(response.data.result)
      }
      return
    }
    const notification = notificationEnvelopeSchema.safeParse(parsed)
    if (!notification.success) { this.emit({ kind: 'WARNING', detail: 'Envelope desconhecido recebido do Codex App Server.' }); return }
    if ('id' in (parsed as Record<string, unknown>)) { this.denyServerRequest(parsed as Record<string, unknown>, notification.data.method); return }
    this.handleNotification(notification.data.method, notification.data.params)
  }

  private handleNotification(method: string, params: unknown): void {
    if (method === 'item/agentMessage/delta') {
      const event = messageDeltaSchema.safeParse(params)
      if (event.success) {
        this.streamedItems.add(event.data.itemId)
        this.emit({ kind: 'MESSAGE_DELTA', threadId: event.data.threadId, turnId: event.data.turnId, text: event.data.delta })
      }
    } else if (method === 'item/completed') {
      const event = itemCompletedSchema.safeParse(params)
      if (event.success && event.data.item.type === 'agentMessage') {
        if (!this.streamedItems.has(event.data.item.id) && event.data.item.text !== undefined) this.emit({ kind: 'MESSAGE_DELTA', threadId: event.data.threadId, turnId: event.data.turnId, text: event.data.item.text })
        this.streamedItems.delete(event.data.item.id)
      }
    } else if (method === 'turn/started') {
      const event = turnStartedSchema.safeParse(params)
      if (event.success) this.emit({ kind: 'TURN_STARTED', threadId: event.data.threadId, turnId: event.data.turn.id })
    } else if (method === 'turn/completed') {
      const event = turnCompletedSchema.safeParse(params)
      if (event.success) {
        this.emit({ kind: 'TURN_COMPLETED', threadId: event.data.threadId, turnId: event.data.turn.id, status: event.data.turn.status })
        this.updateStatus({ state: 'READY', activeTurnId: null, detail: null })
      }
    } else if (method === 'error') {
      const event = errorNotificationSchema.safeParse(params)
      if (event.success) this.emit({ kind: 'ERROR', threadId: event.data.threadId, turnId: event.data.turnId, detail: normalizeDiagnostic(event.data.error.message ?? 'Falha no turno.'), status: event.data.willRetry ? 'RETRYING' : 'FAILED' })
    } else if (method === 'warning' || method === 'configWarning' || method === 'deprecationNotice') {
      this.emit({ kind: 'WARNING', detail: method })
    }
  }

  private denyServerRequest(envelope: Record<string, unknown>, method: string): void {
    const id = envelope.id
    if (typeof id !== 'number' && typeof id !== 'string') return
    this.emit({ kind: 'APPROVAL_REQUIRED', detail: `${method} negado até o fluxo granular da onda 5.` })
    let result: unknown
    if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') result = { decision: 'decline' }
    else if (method === 'applyPatchApproval' || method === 'execCommandApproval') result = { decision: { denied: { rejection: 'Aprovação deve ocorrer no fluxo do Tupiniquim.' } } }
    else if (method === 'mcpServer/elicitation/request') result = { action: 'decline', content: null, _meta: null }
    else if (method === 'item/tool/requestUserInput') result = { answers: {} }
    else { this.write({ id, error: { code: -32000, message: 'Capacidade não habilitada pela política atual.' } }); return }
    this.write({ id, result })
  }

  private write(message: unknown): void { this.child?.stdin.write(`${JSON.stringify(message)}\n`, 'utf8') }

  private emit(event: Omit<AIEvent, 'id' | 'at'>): void {
    this.options.onEvent({ id: randomUUID(), at: new Date().toISOString(), ...event })
  }

  private updateStatus(update: Partial<AIStatus>): void {
    this.currentStatus = aiStatusSchema.parse({ ...this.currentStatus, ...update })
    this.emit({ kind: 'STATUS', status: this.currentStatus.state, detail: this.currentStatus.detail ?? undefined, threadId: this.currentStatus.activeThreadId ?? undefined, turnId: this.currentStatus.activeTurnId ?? undefined })
  }

  private mapAccount(type: string | undefined): AIAccountKind {
    if (type === 'apiKey') return 'API_KEY'
    if (type === 'chatgpt') return 'CHATGPT'
    if (type === 'amazonBedrock') return 'AMAZON_BEDROCK'
    return 'NONE'
  }

  private handleExit(code: number | null, signal: string | null): void {
    if (this.child === null) return
    this.child = null
    const detail = `Codex App Server encerrou (code=${String(code)}, signal=${String(signal)}).`
    this.rejectPending(new Error(detail))
    this.updateStatus({ state: 'ERROR', activeTurnId: null, detail })
  }

  private rejectPending(cause: Error): void {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(cause) }
    this.pending.clear()
  }
}

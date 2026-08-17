import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  agentInterruptInputSchema,
  agentSendInputSchema,
  aiStatusSchema,
  aiThreadSchema,
  aiTurnSchema,
  localModelSchema,
  type AIEvent,
  type AIProvider,
  type AIStatus,
  type AgentTurnReference,
  type LocalModel
} from '@tupiniquim/contracts'
import type { AIHistoryRepository } from './codex-app-server'

const tagsResponseSchema = z.object({
  models: z.array(z.object({
    name: z.string().min(1),
    model: z.string().min(1).optional(),
    modified_at: z.string().nullable().optional(),
    size: z.number().nonnegative().optional()
  }))
})

const chatChunkSchema = z.object({
  message: z.object({ content: z.string().optional() }).optional(),
  done: z.boolean().default(false),
  error: z.string().optional()
})

type LocalMessage = { role: 'user' | 'assistant'; content: string }

export interface OllamaAdapterOptions {
  onEvent: (event: AIEvent) => void
  baseUrl?: string
  fetchImpl?: typeof fetch
  selectedModel?: string
  getWorkspaceRoot?: () => string
  history?: AIHistoryRepository
}

const assertLocalBaseUrl = (raw: string): URL => {
  const url = new URL(raw)
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
  if (url.protocol !== 'http:' || !localHosts.has(url.hostname) || url.username !== '' || url.password !== '') {
    throw new Error('Ollama local aceita somente HTTP em loopback.')
  }
  return url
}

const createEvent = (event: Omit<AIEvent, 'id' | 'at'>): AIEvent => ({
  id: randomUUID(),
  at: new Date().toISOString(),
  ...event
})

export class OllamaAdapter implements AIProvider {
  private readonly baseUrl: URL
  private readonly fetchImpl: typeof fetch
  private readonly conversations = new Map<string, LocalMessage[]>()
  private readonly controllers = new Map<string, AbortController>()
  private models: LocalModel[] = []
  private selectedModel: string | null
  private currentStatus: AIStatus = aiStatusSchema.parse({
    provider: 'ollama',
    state: 'DISCONNECTED',
    account: 'NONE',
    version: null,
    activeThreadId: null,
    activeTurnId: null,
    detail: null
  })

  public constructor(private readonly options: OllamaAdapterOptions) {
    this.baseUrl = assertLocalBaseUrl(options.baseUrl ?? 'http://127.0.0.1:11434')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.selectedModel = options.selectedModel ?? null
  }

  public status(): AIStatus { return this.currentStatus }

  public async connect(): Promise<AIStatus> {
    if (this.currentStatus.state === 'READY' || this.currentStatus.state === 'BUSY') return this.currentStatus
    this.updateStatus({ state: 'STARTING', detail: 'Verificando runtime Ollama local.' })
    try {
      const response = await this.fetchImpl(new URL('/api/tags', this.baseUrl), { signal: AbortSignal.timeout(3_000) })
      if (!response.ok) throw new Error('Ollama respondeu com HTTP ' + String(response.status) + '.')
      const payload = tagsResponseSchema.parse(await response.json())
      this.models = payload.models.map((model) => localModelSchema.parse({
        name: model.name,
        model: model.model ?? model.name,
        modifiedAt: model.modified_at ?? null,
        size: model.size ?? null
      }))
      if (this.selectedModel !== null && !this.models.some((model) => model.name === this.selectedModel)) {
        this.selectedModel = null
      }
      const detail = this.models.length === 0
        ? 'Ollama está disponível, mas não há modelos locais instalados.'
        : this.selectedModel === null
          ? 'Selecione um modelo Ollama local para iniciar uma conversa.'
          : null
      this.updateStatus({ state: 'READY', account: 'NONE', version: 'local', activeTurnId: null, detail })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha desconhecida.'
      const detail = message.includes('HTTP ')
        ? 'O runtime Ollama local respondeu com erro.'
        : 'Ollama não está instalado ou não está em execução no loopback.'
      this.updateStatus({ state: message.includes('HTTP ') ? 'ERROR' : 'NOT_INSTALLED', account: 'NONE', version: null, activeTurnId: null, detail })
    }
    return this.currentStatus
  }

  public async listModels(): Promise<LocalModel[]> {
    await this.connect()
    return this.models
  }

  public selectModel(model: string): void {
    if (!this.models.some((candidate) => candidate.name === model)) throw new Error('Modelo Ollama não encontrado no runtime local.')
    this.selectedModel = model
    this.updateStatus({ detail: null })
  }

  public async send(rawInput: z.input<typeof agentSendInputSchema>): Promise<AgentTurnReference> {
    const input = agentSendInputSchema.parse(rawInput)
    const status = await this.connect()
    if (status.state !== 'READY') throw new Error(status.detail ?? 'Ollama local indisponível.')
    if (this.selectedModel === null) throw new Error('Selecione um modelo Ollama local antes de enviar uma mensagem.')

    const threadId = input.threadId ?? randomUUID()
    const isNewThread = !this.conversations.has(threadId)
    const conversation = this.conversations.get(threadId) ?? []
    conversation.push({ role: 'user', content: input.message })
    this.conversations.set(threadId, conversation)
    const turnId = randomUUID()
    const reference = { threadId, turnId }
    if (isNewThread) {
      const now = new Date().toISOString()
      await this.options.history?.putAIThread(aiThreadSchema.parse({
        id: threadId,
        provider: 'ollama',
        workspaceRoot: this.options.getWorkspaceRoot?.() ?? 'local://ollama',
        model: this.selectedModel,
        createdAt: now,
        updatedAt: now
      }))
      this.emit({ kind: 'THREAD_STARTED', threadId, detail: 'Modelo ' + this.selectedModel })
    }
    await this.options.history?.putAITurn(aiTurnSchema.parse({
      id: turnId,
      threadId,
      mode: input.mode,
      inputHash: createHash('sha256').update(input.message).digest('hex'),
      createdAt: new Date().toISOString()
    }))
    this.updateStatus({ state: 'BUSY', activeThreadId: threadId, activeTurnId: turnId, detail: null })
    const controller = new AbortController()
    this.controllers.set(turnId, controller)
    void this.streamTurn(reference, conversation, controller)
    return reference
  }

  public interrupt(rawInput: z.input<typeof agentInterruptInputSchema>): Promise<void> {
    const input = agentInterruptInputSchema.parse(rawInput)
    const controller = this.controllers.get(input.turnId)
    if (controller === undefined) throw new Error('Turno Ollama não encontrado ou já encerrado.')
    if (this.currentStatus.activeThreadId !== input.threadId) throw new Error('Thread do turno Ollama não confere.')
    controller.abort()
    return Promise.resolve()
  }

  public close(): Promise<void> {
    for (const controller of this.controllers.values()) controller.abort()
    this.controllers.clear()
    this.conversations.clear()
    this.updateStatus({ state: 'STOPPED', activeThreadId: null, activeTurnId: null, detail: null })
    return Promise.resolve()
  }

  private async streamTurn(reference: AgentTurnReference, conversation: LocalMessage[], controller: AbortController): Promise<void> {
    let assistantText = ''
    try {
      const response = await this.fetchImpl(new URL('/api/chat', this.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.selectedModel, messages: conversation, stream: true }),
        signal: controller.signal
      })
      if (!response.ok || response.body === null) throw new Error('Ollama não iniciou o streaming.')
      this.emit({ kind: 'TURN_STARTED', threadId: reference.threadId, turnId: reference.turnId })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let remaining = ''
      while (true) {
        const next = await reader.read()
        if (next.done) break
        if (controller.signal.aborted) throw new Error('Turno Ollama interrompido.')
        remaining += decoder.decode(next.value, { stream: true })
        const lines = remaining.split(/\r?\n/u)
        remaining = lines.pop() ?? ''
        for (const line of lines) assistantText += this.consumeChunk(line, reference)
      }
      if (remaining.trim() !== '') assistantText += this.consumeChunk(remaining, reference)
      if (assistantText !== '') conversation.push({ role: 'assistant', content: redact(assistantText) })
      this.emit({ kind: 'TURN_COMPLETED', threadId: reference.threadId, turnId: reference.turnId, status: 'COMPLETED' })
      this.updateStatus({ state: 'READY', activeTurnId: null, detail: null })
    } catch {
      const cancelled = controller.signal.aborted
      this.emit({
        kind: cancelled ? 'TURN_COMPLETED' : 'ERROR',
        threadId: reference.threadId,
        turnId: reference.turnId,
        ...(cancelled ? { status: 'CANCELLED' } : { detail: 'Falha no streaming do Ollama local.', status: 'FAILED' })
      })
      this.updateStatus({ state: cancelled ? 'READY' : 'ERROR', activeTurnId: null, detail: cancelled ? 'Turno Ollama interrompido.' : 'Falha no runtime Ollama local.' })
    } finally {
      this.controllers.delete(reference.turnId)
    }
  }

  private consumeChunk(line: string, reference: AgentTurnReference): string {
    if (line.trim() === '') return ''
    const chunk = chatChunkSchema.parse(JSON.parse(line))
    if (chunk.error !== undefined) throw new Error('Ollama retornou erro de geração.')
    const text = chunk.message?.content ?? ''
    if (text !== '') this.emit({ kind: 'MESSAGE_DELTA', threadId: reference.threadId, turnId: reference.turnId, text })
    return text
  }

  private emit(event: Omit<AIEvent, 'id' | 'at'>): void {
    const persisted = createEvent({
      ...event,
      ...(event.text === undefined ? {} : { text: redact(event.text) }),
      ...(event.detail === undefined ? {} : { detail: redact(event.detail) })
    })
    this.options.onEvent(persisted)
    if (persisted.threadId !== undefined) void this.options.history?.appendAIEvent(persisted).catch(() => undefined)
  }

  private updateStatus(update: Partial<AIStatus>): void {
    this.currentStatus = aiStatusSchema.parse({ ...this.currentStatus, ...update })
    this.emit({
      kind: 'STATUS',
      status: this.currentStatus.state,
      ...(this.currentStatus.detail === null ? {} : { detail: this.currentStatus.detail }),
      ...(this.currentStatus.activeThreadId === null ? {} : { threadId: this.currentStatus.activeThreadId }),
      ...(this.currentStatus.activeTurnId === null ? {} : { turnId: this.currentStatus.activeTurnId })
    })
  }
}

const redact = (value: string): string => value
  .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]')
  .replace(/(authorization|api[_-]?key|token)\s*[:=]\s*\S+/giu, '$1=[REDACTED]')
  .slice(0, 2_000)

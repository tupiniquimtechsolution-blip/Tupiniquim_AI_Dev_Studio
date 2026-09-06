import { randomUUID } from 'node:crypto'
import {
  tupiniquimConversationSchema,
  tupiniquimSessionSchema,
  tupiniquimTurnSchema,
  type AIProviderKind,
  type TupiniquimConversation,
  type TupiniquimProposalAuthority,
  type TupiniquimProviderBinding,
  type TupiniquimSession,
  type TupiniquimTurn,
  type TupiniquimTurnRole
} from '@tupiniquim/contracts'

export interface AppendSessionTurnInput {
  role: TupiniquimTurnRole
  text: string
  provider: AIProviderKind | null
  model: string | null
  threadId: string | null
  turnId: string | null
}

export interface AssistantDeltaInput {
  provider: AIProviderKind
  model: string | null
  threadId: string
  turnId: string
  text: string
}

const redact = (value: string): string => value
  .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]')
  .replace(/(authorization|api[_-]?key|token)\s*[:=]\s*\S+/giu, '$1=[REDACTED]')
  .slice(0, 2_000)

const now = (): string => new Date().toISOString()

/**
 * In-memory Tupiniquim-owned conversation. Provider threads remain per-provider
 * bindings of the same session. Restart/recovery of this memory is Wave 16.
 */
export class TupiniquimSessionService {
  private session: TupiniquimSession | null = null
  private turns: TupiniquimTurn[] = []
  private readonly bindings = new Map<AIProviderKind, TupiniquimProviderBinding>()
  private authority: Omit<TupiniquimProposalAuthority, 'proposalIds'> | null = null
  private readonly proposalIds = new Set<string>()
  private readonly inProgress = new Map<string, TupiniquimTurn>()

  public open(workspaceRoot: string): TupiniquimSession {
    const root = workspaceRoot.trim()
    if (root.length < 3) throw new Error('Workspace inválido para abrir a sessão Tupiniquim.')
    if (this.session !== null && this.session.workspaceRoot === root) return this.session
    this.session = tupiniquimSessionSchema.parse({
      id: randomUUID(),
      workspaceRoot: root,
      createdAt: now(),
      updatedAt: now()
    })
    this.turns = []
    this.bindings.clear()
    this.inProgress.clear()
    this.revokeProposalAuthority()
    return this.session
  }

  public current(): TupiniquimSession | null {
    return this.session
  }

  public snapshot(): TupiniquimConversation | null {
    if (this.session === null) return null
    return tupiniquimConversationSchema.parse({
      session: this.session,
      turns: this.turns.map((turn) => tupiniquimTurnSchema.parse(turn)),
      providerThreads: [...this.bindings.values()],
      proposalAuthority: this.proposalAuthority()
    })
  }

  public appendTurn(input: AppendSessionTurnInput): TupiniquimTurn {
    const session = this.requireSession()
    const turn = tupiniquimTurnSchema.parse({
      id: randomUUID(),
      sessionId: session.id,
      role: input.role,
      text: redact(input.text),
      provider: input.provider,
      model: input.model,
      threadId: input.threadId,
      turnId: input.turnId,
      createdAt: now()
    })
    this.turns = [...this.turns, turn]
    this.touch()
    return turn
  }

  public applyAssistantDelta(input: AssistantDeltaInput): TupiniquimTurn {
    const session = this.requireSession()
    const existing = this.inProgress.get(input.turnId)
    if (existing !== undefined) {
      const updated = tupiniquimTurnSchema.parse({
        ...existing,
        text: redact(`${existing.text}${input.text}`)
      })
      this.inProgress.set(input.turnId, updated)
      this.turns = this.turns.map((turn) => turn.id === updated.id ? updated : turn)
      this.touch()
      return updated
    }
    const turn = tupiniquimTurnSchema.parse({
      id: randomUUID(),
      sessionId: session.id,
      role: 'assistant',
      text: redact(input.text),
      provider: input.provider,
      model: input.model,
      threadId: input.threadId,
      turnId: input.turnId,
      createdAt: now()
    })
    this.inProgress.set(input.turnId, turn)
    this.turns = [...this.turns, turn]
    this.touch()
    return turn
  }

  public completeTurn(turnId: string): void {
    this.inProgress.delete(turnId)
  }

  public bindProviderThread(provider: AIProviderKind, threadId: string, model: string | null): TupiniquimProviderBinding {
    this.requireSession()
    for (const [kind, binding] of this.bindings) {
      if (kind !== provider && binding.threadId === threadId) {
        throw new Error('Não é permitido reutilizar a thread de outro provider na sessão Tupiniquim.')
      }
    }
    const current = this.bindings.get(provider)
    if (current !== undefined && current.threadId !== threadId) {
      throw new Error('O provider já possui uma thread distinta nesta sessão Tupiniquim.')
    }
    const binding: TupiniquimProviderBinding = { provider, threadId, model }
    this.bindings.set(provider, binding)
    this.touch()
    return binding
  }

  public threadFor(provider: AIProviderKind): string | undefined {
    return this.bindings.get(provider)?.threadId
  }

  public resolveChatThread(provider: AIProviderKind, requestedThreadId?: string): string | undefined {
    const bound = this.threadFor(provider)
    if (requestedThreadId === undefined) return bound
    for (const [kind, binding] of this.bindings) {
      if (kind !== provider && binding.threadId === requestedThreadId) return bound
    }
    return bound ?? requestedThreadId
  }

  public grantProposalAuthority(provider: AIProviderKind, threadId: string, proposalId: string): void {
    this.requireSession()
    const bound = this.threadFor(provider)
    if (bound !== undefined && bound !== threadId) {
      throw new Error('A autoridade da proposta deve permanecer na thread causal do provider.')
    }
    if (this.authority !== null && (this.authority.provider !== provider || this.authority.threadId !== threadId)) {
      throw new Error('A autoridade da proposta não transfere de provider.')
    }
    this.authority = { provider, threadId }
    this.proposalIds.add(proposalId)
    this.touch()
  }

  public proposalAuthority(): TupiniquimProposalAuthority | null {
    if (this.authority === null) return null
    return {
      provider: this.authority.provider,
      threadId: this.authority.threadId,
      proposalIds: [...this.proposalIds]
    }
  }

  public assertProposalProvider(provider: AIProviderKind): void {
    const authority = this.proposalAuthority()
    if (authority !== null && authority.provider !== provider) {
      throw new Error('A autoridade da proposta não transfere de provider.')
    }
  }

  public switchProvider(from: AIProviderKind, to: AIProviderKind): string[] {
    this.requireSession()
    if (from === to) return []
    return this.revokeProposalAuthority()
  }

  public revokeProposalAuthority(): string[] {
    const expired = [...this.proposalIds]
    this.proposalIds.clear()
    this.authority = null
    if (this.session !== null) this.touch()
    return expired
  }

  private requireSession(): TupiniquimSession {
    if (this.session === null) throw new Error('Nenhuma sessão Tupiniquim está aberta para o workspace atual.')
    return this.session
  }

  private touch(): void {
    if (this.session === null) return
    this.session = tupiniquimSessionSchema.parse({ ...this.session, updatedAt: now() })
  }
}

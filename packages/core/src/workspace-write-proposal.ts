import { createHash, randomUUID } from 'node:crypto'
import {
  agentProposalEffectSourceSchema,
  normalizedToolCallEnvelopeSchema,
  workspaceWriteArgsSchema,
  workspaceWriteProposalSchema,
  type AIProviderKind,
  type AIThread,
  type AITurn,
  type ActionManifest,
  type NormalizedToolCallEnvelope,
  type Plan,
  type ProposalStatus,
  type WorkspaceWriteProposal
} from '@tupiniquim/contracts'
import { manifestEffectsHash, type PlanApprovalService } from './plan-approval'

export interface ProposalHistory {
  getAIThread(id: string): Promise<AIThread | null>
  listAITurns(threadId: string): Promise<AITurn[]>
}

/** @deprecated Legacy input format — prefer the envelope-based overload. */
export interface WorkspaceWriteProposalInput {
  executionId: string
  stepId: string
  provider: AIProviderKind
  threadId: string
  turnId: string
  toolCallId: string
  tool: 'workspace.write'
  relativePath: string
  content: string
  operation: 'CREATE' | 'REPLACE'
  targetBaselineHash: string | null
}

/** Provider-neutral input accepted by the proposal service. */
export interface EnvelopeProposalInput {
  envelope: NormalizedToolCallEnvelope
  executionId: string
  stepId: string
}

/** Injected capability: inspect a file in the workspace for baseline information. */
export interface WorkspaceBaselineLookup {
  /** Return the existence and hash of the file at relativePath. */
  inspectBaseline(relativePath: string): Promise<{ exists: boolean; hash: string | null }>
}

interface StoredProposal extends WorkspaceWriteProposal {
  workspaceRoot: string
  content: string
}

const proposalSlot = (executionId: string, stepId: string): string => `${executionId}:${stepId}`
const toolCallKey = ({ provider, threadId, turnId, toolCallId }: Pick<WorkspaceWriteProposalInput, 'provider' | 'threadId' | 'turnId' | 'toolCallId'>): string => JSON.stringify([provider, threadId, turnId, toolCallId])
const isPrivateEnvironmentPath = (relativePath: string): boolean => relativePath.split(/[\\/]/u).some((segment) => segment.toLowerCase().startsWith('.env'))
const contentHash = (content: string): string => createHash('sha256').update(content).digest('hex')
const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)

export class WorkspaceWriteProposalService {
  private readonly proposals = new Map<string, StoredProposal>()
  private readonly slots = new Map<string, string>()
  private readonly toolCalls = new Set<string>()

  public constructor(
    private readonly planning: PlanApprovalService,
    private readonly history: ProposalHistory,
    private readonly getWorkspaceRoot: () => string,
    private readonly baselineLookup: WorkspaceBaselineLookup
  ) {}

  /** Create a proposal from a provider-neutral envelope. */
  public async proposeFromEnvelope(input: EnvelopeProposalInput): Promise<WorkspaceWriteProposal> {
    const envelope = normalizedToolCallEnvelopeSchema.parse(input.envelope)
    if (envelope.tool !== 'workspace.write') throw new Error('Somente workspace.write é suportado por propostas.')
    const args = workspaceWriteArgsSchema.parse(envelope.arguments)
    const baseline = await this.lookupTargetBaseline(input.executionId, args.relativePath)
    if (args.operation === 'CREATE' && baseline.exists) {
      throw new Error('CREATE exige que o alvo não exista no momento da proposta.')
    }
    if (args.operation === 'REPLACE' && !baseline.exists) {
      throw new Error('REPLACE exige um arquivo existente no momento da proposta.')
    }
    const baselineHash = args.operation === 'CREATE' ? null : baseline.hash
    return this.propose({
      executionId: input.executionId,
      stepId: input.stepId,
      provider: envelope.provider,
      threadId: envelope.threadId,
      turnId: envelope.turnId,
      toolCallId: envelope.callId,
      tool: envelope.tool,
      relativePath: args.relativePath,
      content: args.content,
      operation: args.operation,
      targetBaselineHash: baselineHash
    })
  }

  /** @deprecated Use proposeFromEnvelope for provider-neutral input. */
  public async propose(input: WorkspaceWriteProposalInput): Promise<WorkspaceWriteProposal> {
    if (isPrivateEnvironmentPath(input.relativePath)) throw new Error('Arquivos .env não podem receber proposta de escrita.')
    const proposalId = randomUUID()
    const source = agentProposalEffectSourceSchema.safeParse({
      kind: 'AGENT_PROPOSAL',
      provider: input.provider,
      threadId: input.threadId,
      turnId: input.turnId,
      toolCallId: input.toolCallId,
      proposalId,
      tool: input.tool
    })
    if (!source.success) throw new Error('Proveniência da chamada de ferramenta é inválida.')
    if (input.operation === 'CREATE' && input.targetBaselineHash !== null) throw new Error('CREATE exige baseline inexistente.')
    if (input.operation === 'REPLACE' && !isSha256(input.targetBaselineHash)) throw new Error('REPLACE exige hash SHA-256 do baseline.')
    const sourceKey = toolCallKey(input)
    if (this.toolCalls.has(sourceKey)) throw new Error('Chamada de ferramenta já foi usada para criar uma proposta.')
    this.toolCalls.add(sourceKey)
    const workspaceRoot = this.getWorkspaceRoot()
    const [{ execution, plan }, thread, turns] = await Promise.all([
      this.planning.read(input.executionId),
      this.history.getAIThread(input.threadId),
      this.history.listAITurns(input.threadId)
    ])
    if (execution.state !== 'WAITING_APPROVAL') throw new Error('Proposta só pode ser criada enquanto a execução aguarda aprovação.')
    if (thread?.id !== input.threadId || thread.provider !== input.provider) throw new Error('Provider ou thread de origem não corresponde à proposta.')
    if (execution.workspaceRoot !== workspaceRoot || thread.workspaceRoot !== workspaceRoot) throw new Error('Proposta não pertence ao workspace atualmente autorizado.')
    if (!turns.some((turn) => turn.id === input.turnId && turn.threadId === input.threadId && turn.mode === 'PLAN')) throw new Error('Turno de origem deve pertencer à thread declarada e estar em modo PLAN.')
    const step = plan.steps.find((candidate) => candidate.id === input.stepId)
    if (step === undefined || !step.requiresApproval) throw new Error('Passo não aceita proposta de efeito mutável.')
    if (plan.steps.some((candidate) => candidate.effects.some((effect) => effect.source?.provider === input.provider
      && effect.source.threadId === input.threadId
      && effect.source.turnId === input.turnId
      && effect.source.toolCallId === input.toolCallId))) {
      throw new Error('Chamada de ferramenta já está vinculada a um manifesto persistido.')
    }
    await this.planning.bindThread(input.executionId, input.threadId)
    const effect: ActionManifest = {
      id: randomUUID(),
      capability: 'workspace.write',
      operation: input.operation,
      target: input.relativePath,
      payloadHash: contentHash(input.content),
      risk: 'HIGH',
      expectedTargetHash: input.targetBaselineHash,
      source: source.data
    }
    const updatedPlan = this.withEffect(plan, input.stepId, effect)
    await this.planning.update(input.executionId, updatedPlan)
    const slot = proposalSlot(input.executionId, input.stepId)
    const existing = this.slots.get(slot)
    if (existing !== undefined) this.proposals.delete(existing)
    const proposal: StoredProposal = {
      id: proposalId,
      executionId: input.executionId,
      stepId: input.stepId,
      provider: input.provider,
      threadId: input.threadId,
      turnId: input.turnId,
      toolCallId: input.toolCallId,
      tool: input.tool,
      effect,
      createdAt: new Date().toISOString(),
      workspaceRoot,
      content: input.content
    }
    this.proposals.set(proposal.id, proposal)
    this.slots.set(slot, proposal.id)
    return this.publicProposal(proposal)
  }

  public async consume(id: string): Promise<{ proposal: WorkspaceWriteProposal; content: string }> {
    const proposal = this.proposals.get(id)
    if (proposal === undefined) throw new Error('Proposta não está disponível; ela pode ter expirado ou sido substituída.')
    const validity = await this.validateProposalState(proposal)
    if (!validity.valid) {
      this.invalidate(id)
      throw new Error('Proposta obsoleta para o plano ou workspace atual.')
    }
    return { proposal: this.publicProposal(proposal), content: proposal.content }
  }

  /** Look up the public status of a proposal. Returns EXPIRED when the payload is gone. */
  public async lookupStatus(id: string): Promise<ProposalStatus> {
    const proposal = this.proposals.get(id)
    if (proposal === undefined) return 'EXPIRED'
    try {
      const validity = await this.validateProposalState(proposal)
      if (!validity.valid) {
        this.invalidate(id)
        return 'EXPIRED'
      }
      return 'PENDING_REVIEW'
    } catch {
      return 'EXPIRED'
    }
  }

  /** Shared causal validation used by both lookupStatus() and consume(). */
  private async validateProposalState(proposal: StoredProposal): Promise<{ valid: boolean; reason?: string }> {
    const [{ execution, plan }, thread, turns] = await Promise.all([
      this.planning.read(proposal.executionId),
      this.history.getAIThread(proposal.threadId),
      this.history.listAITurns(proposal.threadId)
    ])
    // Workspace drift
    if (execution.workspaceRoot !== this.getWorkspaceRoot()) return { valid: false, reason: 'workspace_drift' }
    // Slot must still be current (proposal was superseded)
    const slot = proposalSlot(proposal.executionId, proposal.stepId)
    if (this.slots.get(slot) !== proposal.id) return { valid: false, reason: 'superseded' }
    // Thread/provider drift
    if (thread?.id !== proposal.threadId || thread.provider !== proposal.provider) return { valid: false, reason: 'thread_drift' }
    // Turn must exist in PLAN mode
    if (!turns.some((turn) => turn.id === proposal.turnId && turn.threadId === proposal.threadId && turn.mode === 'PLAN')) return { valid: false, reason: 'turn_drift' }
    // Tool call must still be tracked
    if (!this.toolCalls.has(toolCallKey(proposal))) return { valid: false, reason: 'toolcall_drift' }
    // Manifest must still match
    const step = plan.steps.find((candidate) => candidate.id === proposal.stepId)
    const current = step?.effects.find((effect) => effect.id === proposal.effect.id)
    if (current === undefined) return { valid: false, reason: 'manifest_gone' }
    if (manifestEffectsHash([current]) !== manifestEffectsHash([proposal.effect])) return { valid: false, reason: 'manifest_drift' }
    // Payload integrity
    if (contentHash(proposal.content) !== proposal.effect.payloadHash) return { valid: false, reason: 'payload_drift' }
    return { valid: true }
  }

  public invalidate(id: string): void {
    const proposal = this.proposals.get(id)
    if (proposal === undefined) return
    this.proposals.delete(id)
    if (this.slots.get(proposalSlot(proposal.executionId, proposal.stepId)) === id) this.slots.delete(proposalSlot(proposal.executionId, proposal.stepId))
  }

  private async lookupTargetBaseline(executionId: string, relativePath: string): Promise<{ exists: boolean; hash: string | null }> {
    try {
      const { execution } = await this.planning.read(executionId)
      const root = this.getWorkspaceRoot()
      if (execution.workspaceRoot !== root) return { exists: false, hash: null }
      return await this.baselineLookup.inspectBaseline(relativePath)
    } catch {
      return { exists: false, hash: null }
    }
  }

  private withEffect(plan: Plan, stepId: string, effect: ActionManifest): Plan {
    return { ...plan, steps: plan.steps.map((step) => step.id === stepId ? { ...step, effects: [effect] } : step) }
  }

  private publicProposal(proposal: StoredProposal): WorkspaceWriteProposal {
    return workspaceWriteProposalSchema.parse({
      id: proposal.id,
      executionId: proposal.executionId,
      stepId: proposal.stepId,
      provider: proposal.provider,
      threadId: proposal.threadId,
      turnId: proposal.turnId,
      toolCallId: proposal.toolCallId,
      tool: proposal.tool,
      effect: proposal.effect,
      createdAt: proposal.createdAt
    })
  }
}

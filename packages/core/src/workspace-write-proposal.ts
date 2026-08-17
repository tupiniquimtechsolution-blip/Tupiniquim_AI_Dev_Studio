import { createHash, randomUUID } from 'node:crypto'
import type { AIThread, AITurn, ActionManifest, Plan } from '@tupiniquim/contracts'
import type { PlanApprovalService } from './plan-approval'

export interface ProposalHistory {
  getAIThread(id: string): Promise<AIThread | null>
  listAITurns(threadId: string): Promise<AITurn[]>
}

export interface WorkspaceWriteProposalInput {
  executionId: string
  stepId: string
  threadId: string
  turnId: string
  relativePath: string
  content: string
  operation: 'CREATE' | 'REPLACE'
}

export interface WorkspaceWriteProposal {
  id: string
  executionId: string
  stepId: string
  threadId: string
  turnId: string
  effect: ActionManifest
  createdAt: string
}

interface StoredProposal extends WorkspaceWriteProposal {
  workspaceRoot: string
  content: string
}

const proposalSlot = (executionId: string, stepId: string): string => `${executionId}:${stepId}`
const isPrivateEnvironmentPath = (relativePath: string): boolean => relativePath.split(/[\\/]/u).some((segment) => segment.toLowerCase().startsWith('.env'))
const contentHash = (content: string): string => createHash('sha256').update(content).digest('hex')

export class WorkspaceWriteProposalService {
  private readonly proposals = new Map<string, StoredProposal>()
  private readonly slots = new Map<string, string>()

  public constructor(
    private readonly planning: PlanApprovalService,
    private readonly history: ProposalHistory,
    private readonly getWorkspaceRoot: () => string
  ) {}

  public async propose(input: WorkspaceWriteProposalInput): Promise<WorkspaceWriteProposal> {
    if (isPrivateEnvironmentPath(input.relativePath)) throw new Error('Arquivos .env não podem receber proposta de escrita.')
    const workspaceRoot = this.getWorkspaceRoot()
    const [{ execution, plan }, thread, turns] = await Promise.all([
      this.planning.read(input.executionId),
      this.history.getAIThread(input.threadId),
      this.history.listAITurns(input.threadId)
    ])
    if (execution.state === 'EXECUTION') throw new Error('Não é possível propor efeito após o início da execução.')
    if (execution.workspaceRoot !== workspaceRoot || thread?.workspaceRoot !== workspaceRoot) throw new Error('Proposta não pertence ao workspace atualmente autorizado.')
    if (!turns.some((turn) => turn.id === input.turnId)) throw new Error('Turno de origem não pertence à thread declarada.')
    const step = plan.steps.find((candidate) => candidate.id === input.stepId)
    if (step === undefined || !step.requiresApproval) throw new Error('Passo não aceita proposta de efeito mutável.')
    const effect: ActionManifest = {
      id: randomUUID(),
      capability: 'workspace.write',
      operation: input.operation,
      target: input.relativePath,
      payloadHash: contentHash(input.content),
      risk: 'HIGH'
    }
    const updatedPlan = this.withEffect(plan, input.stepId, effect)
    await this.planning.update(input.executionId, updatedPlan)
    const slot = proposalSlot(input.executionId, input.stepId)
    const existing = this.slots.get(slot)
    if (existing !== undefined) this.proposals.delete(existing)
    const proposal: StoredProposal = { id: randomUUID(), executionId: input.executionId, stepId: input.stepId, threadId: input.threadId, turnId: input.turnId, effect, createdAt: new Date().toISOString(), workspaceRoot, content: input.content }
    this.proposals.set(proposal.id, proposal)
    this.slots.set(slot, proposal.id)
    return this.publicProposal(proposal)
  }

  public async consume(id: string): Promise<{ proposal: WorkspaceWriteProposal; content: string }> {
    const proposal = this.proposals.get(id)
    if (proposal === undefined) throw new Error('Proposta não está disponível; ela pode ter expirado ou sido substituída.')
    const { execution, plan } = await this.planning.read(proposal.executionId)
    const step = plan.steps.find((candidate) => candidate.id === proposal.stepId)
    const current = step?.effects.find((effect) => effect.id === proposal.effect.id)
    if (execution.workspaceRoot !== this.getWorkspaceRoot() || current === undefined || current.payloadHash !== proposal.effect.payloadHash || current.target !== proposal.effect.target) {
      this.invalidate(id)
      throw new Error('Proposta obsoleta para o plano ou workspace atual.')
    }
    return { proposal: this.publicProposal(proposal), content: proposal.content }
  }

  public invalidate(id: string): void {
    const proposal = this.proposals.get(id)
    if (proposal === undefined) return
    this.proposals.delete(id)
    if (this.slots.get(proposalSlot(proposal.executionId, proposal.stepId)) === id) this.slots.delete(proposalSlot(proposal.executionId, proposal.stepId))
  }

  private withEffect(plan: Plan, stepId: string, effect: ActionManifest): Plan {
    return { ...plan, steps: plan.steps.map((step) => step.id === stepId ? { ...step, effects: [effect] } : step) }
  }

  private publicProposal(proposal: StoredProposal): WorkspaceWriteProposal {
    return {
      id: proposal.id,
      executionId: proposal.executionId,
      stepId: proposal.stepId,
      threadId: proposal.threadId,
      turnId: proposal.turnId,
      effect: proposal.effect,
      createdAt: proposal.createdAt
    }
  }
}

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  AIThread,
  AITurn,
  ApprovalDecision,
  Execution,
  FlightRecorderEvent,
  Plan
} from '@tupiniquim/contracts'
import { PlanApprovalService, type PlanRepository } from './plan-approval'
import {
  WorkspaceWriteProposalService,
  type ProposalHistory,
  type WorkspaceBaselineLookup
} from './workspace-write-proposal'

/**
 * Cross-platform, in-memory fixtures.
 *
 * These tests deliberately avoid SQLite and the F:\ drive gate so that the
 * proposal-service security logic (fail-closed baseline, guaranteed purge on
 * EXPIRED) is verifiable on every platform. The Windows F: persistence suite
 * continues to exercise the real LocalDatabase.
 */

class InMemoryPlanRepository implements PlanRepository {
  public readonly plans = new Map<string, Plan>()
  public readonly executions = new Map<string, Execution>()
  public readonly approvals = new Map<string, ApprovalDecision>()
  public readonly events = new Map<string, FlightRecorderEvent[]>()
  public failReads = false

  public putPlan(plan: Plan): Promise<void> { this.plans.set(plan.id, plan); return Promise.resolve() }
  public getPlan(id: string): Promise<Plan | null> { return Promise.resolve(this.plans.get(id) ?? null) }
  public putExecution(execution: Execution): Promise<void> { this.executions.set(execution.id, execution); return Promise.resolve() }
  public getExecution(id: string): Promise<Execution | null> {
    if (this.failReads) return Promise.reject(new Error('Persistência indisponível (simulada).'))
    return Promise.resolve(this.executions.get(id) ?? null)
  }
  public putApproval(decision: ApprovalDecision): Promise<void> { this.approvals.set(decision.id, decision); return Promise.resolve() }
  public getApproval(id: string): Promise<ApprovalDecision | null> { return Promise.resolve(this.approvals.get(id) ?? null) }
  public appendEvent(executionId: string, event: FlightRecorderEvent): Promise<void> {
    this.events.set(executionId, [...(this.events.get(executionId) ?? []), event])
    return Promise.resolve()
  }
  public listEvents(executionId: string): Promise<FlightRecorderEvent[]> { return Promise.resolve(this.events.get(executionId) ?? []) }
}

class InMemoryHistory implements ProposalHistory {
  public threads = new Map<string, AIThread>()
  public turns = new Map<string, AITurn[]>()

  public getAIThread(id: string): Promise<AIThread | null> { return Promise.resolve(this.threads.get(id) ?? null) }
  public listAITurns(threadId: string): Promise<AITurn[]> { return Promise.resolve(this.turns.get(threadId) ?? []) }
}

interface Harness {
  repository: InMemoryPlanRepository
  history: InMemoryHistory
  planning: PlanApprovalService
  workspaceRoot: string
  setWorkspaceRoot(root: string): void
  baseline: { calls: string[]; inspectBaseline: WorkspaceBaselineLookup['inspectBaseline'] }
  proposals: WorkspaceWriteProposalService
  thread: AIThread
  turn: AITurn
  createExecution(): Promise<{ executionId: string; stepId: string }>
}

const createHarness = (inspect: WorkspaceBaselineLookup['inspectBaseline'] = () => Promise.resolve({ exists: false, hash: null })): Harness => {
  const repository = new InMemoryPlanRepository()
  const history = new InMemoryHistory()
  const planning = new PlanApprovalService(repository)
  const workspaceRoot = '/workspace/authorized'
  let root = workspaceRoot
  const now = new Date().toISOString()
  const thread: AIThread = { id: 'thread-1', provider: 'ollama', workspaceRoot, model: 'modelo', createdAt: now, updatedAt: now }
  const turn: AITurn = { id: 'turn-1', threadId: thread.id, mode: 'PLAN', inputHash: 'a'.repeat(64), createdAt: now }
  history.threads.set(thread.id, thread)
  history.turns.set(thread.id, [turn])
  const baseline = {
    calls: [] as string[],
    inspectBaseline: (relativePath: string) => {
      baseline.calls.push(relativePath)
      return inspect(relativePath)
    }
  }
  const proposals = new WorkspaceWriteProposalService(planning, history, () => root, baseline)
  return {
    repository,
    history,
    planning,
    workspaceRoot,
    setWorkspaceRoot: (next: string) => { root = next },
    baseline,
    proposals,
    thread,
    turn,
    createExecution: async () => {
      const planned = await planning.create('Objetivo de teste', workspaceRoot, 'PLAN')
      const stepId = planned.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Fixture sem passo aprovável.')
      return { executionId: planned.execution.id, stepId }
    }
  }
}

const envelopeFor = (harness: Harness, executionId: string, stepId: string, over: Partial<{ relativePath: string; content: string; operation: 'CREATE' | 'REPLACE'; callId: string }> = {}) => ({
  envelope: {
    callId: over.callId ?? randomUUID(),
    provider: harness.thread.provider,
    threadId: harness.thread.id,
    turnId: harness.turn.id,
    tool: 'workspace.write' as const,
    arguments: {
      relativePath: over.relativePath ?? 'src/novo.ts',
      content: over.content ?? 'conteúdo privado da proposta',
      operation: over.operation ?? 'CREATE'
    }
  },
  executionId,
  stepId
})

describe('WorkspaceWriteProposalService — fail-closed baseline (Correção 1)', () => {
  it('propaga erro de inspeção (path traversal) e recusa a proposta, sem manifesto nem estado retido', async () => {
    // Espelha WorkspaceAdapter.inspectWriteTarget(): rejeita path inseguro,
    // mas responde normalmente para um path dentro do workspace.
    const harness = createHarness((relativePath) => {
      if (relativePath.includes('..') || relativePath.startsWith('/')) {
        return Promise.reject(new Error('Caminho fora do workspace.'))
      }
      return Promise.resolve({ exists: false, hash: null })
    })
    const { executionId, stepId } = await harness.createExecution()

    await expect(harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { relativePath: '../fuga-do-workspace.ts' })
    )).rejects.toThrow('Caminho fora do workspace.')

    // O baseline foi realmente consultado com o path hostil (não houve bypass).
    expect(harness.baseline.calls).toContain('../fuga-do-workspace.ts')
    // Nenhum manifesto foi persistido pela proposta recusada.
    const { plan } = await harness.planning.read(executionId)
    expect(plan.steps.find((step) => step.id === stepId)?.effects).toHaveLength(0)
    // A tool call não ficou "gasta": uma proposta válida em seguida usa o slot normalmente.
    const retry = await harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { relativePath: 'src/valido.ts' })
    )
    expect(await harness.proposals.lookupStatus(retry.id)).toBe('PENDING_REVIEW')
  })

  it('propaga erro inesperado de permissão/IO em vez de tratar o alvo como inexistente', async () => {
    const harness = createHarness(() => Promise.reject(new Error('EACCES: permissão negada')))
    const { executionId, stepId } = await harness.createExecution()
    await expect(harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { relativePath: 'src/segredo.ts' })
    )).rejects.toThrow('permissão negada')
    const { plan } = await harness.planning.read(executionId)
    expect(plan.steps.find((step) => step.id === stepId)?.effects).toHaveLength(0)
  })

  it('recusa CREATE quando o baseline real reporta que o alvo já existe', async () => {
    const harness = createHarness(() => Promise.resolve({ exists: true, hash: 'b'.repeat(64) }))
    const { executionId, stepId } = await harness.createExecution()
    await expect(harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId)
    )).rejects.toThrow('CREATE exige que o alvo não exista')
  })

  it('recusa REPLACE quando o baseline real reporta alvo inexistente', async () => {
    const harness = createHarness(() => Promise.resolve({ exists: false, hash: null }))
    const { executionId, stepId } = await harness.createExecution()
    await expect(harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { operation: 'REPLACE', relativePath: 'src/existente.ts' })
    )).rejects.toThrow('REPLACE exige um arquivo existente')
  })

  it('aceita CREATE quando o WorkspaceAdapter reporta {exists:false,hash:null} genuíno', async () => {
    const harness = createHarness(() => Promise.resolve({ exists: false, hash: null }))
    const { executionId, stepId } = await harness.createExecution()
    const proposal = await harness.proposals.proposeFromEnvelope(envelopeFor(harness, executionId, stepId))
    expect(proposal.effect.expectedTargetHash).toBeNull()
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')
  })
})

describe('WorkspaceWriteProposalService — purge garantido no EXPIRED (Correção 2)', () => {
  it('expira, purga em exceção de validação e mantém EXPIRED em consultas subsequentes; consume falha', async () => {
    const harness = createHarness()
    const { executionId, stepId } = await harness.createExecution()
    const secret = 'PAYLOAD_EFEMERO_NAO_RECUPERAVEL'
    const proposal = await harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { content: secret, relativePath: 'src/expira.ts' })
    )
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')

    // Provoca uma exceção DENTRO de validateProposalState (falha de persistência).
    harness.repository.failReads = true

    // 1-4. lookupStatus deve retornar EXPIRED mesmo com exceção.
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    // 5. Segunda consulta continua EXPIRED (payload já foi purgado).
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    // 6. consume falha (proposta não está mais disponível).
    await expect(harness.proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
  })

  it('expira por drift causal, purga o payload e impede recuperação posterior', async () => {
    const harness = createHarness()
    const { executionId, stepId } = await harness.createExecution()
    const secret = 'CONTEUDO_PRIVADO_DA_PROPOSTA_A'
    const proposal = await harness.proposals.proposeFromEnvelope(
      envelopeFor(harness, executionId, stepId, { content: secret, relativePath: 'src/a.ts' })
    )
    // Workspace drift real na MESMA instância do serviço.
    harness.setWorkspaceRoot('/workspace/outro')
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    harness.setWorkspaceRoot(harness.workspaceRoot)
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    await expect(harness.proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
  })
})

describe('WorkspaceWriteProposalService — workspace drift na mesma instância (Correção 3A)', () => {
  it('torna getWorkspaceRoot mutável e prova drift sem recriar o serviço', async () => {
    const harness = createHarness()
    const { executionId, stepId } = await harness.createExecution()
    const proposal = await harness.proposals.proposeFromEnvelope(envelopeFor(harness, executionId, stepId))
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')

    harness.setWorkspaceRoot('/workspace/drift')
    // Mesma instância do serviço; o mapa interno de propostas ainda contém o id.
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')

    harness.setWorkspaceRoot(harness.workspaceRoot)
    // Já foi purgada durante o EXPIRED; não volta a ficar disponível.
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    await expect(harness.proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
  })
})

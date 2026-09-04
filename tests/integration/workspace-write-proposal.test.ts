import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceAdapter } from '@tupiniquim/adapters'
import type { AIThread, AITurn, ApprovalDecision, Execution, FlightRecorderEvent, Plan } from '@tupiniquim/contracts'
import { PlanApprovalService, WorkspaceWriteProposalService, type PlanRepository } from '@tupiniquim/core'

/**
 * Cross-platform proposal provenance/expiration integration test.
 *
 * Uses the REAL WorkspaceAdapter (path security + baseline inspection) against
 * a real temporary workspace and an in-memory plan/history store. It therefore
 * runs on Linux/CI while the F: persistence suite exercises the real SQLite
 * database on Windows. The Windows F: constraint is enforced only on win32.
 */

const isWindows = process.platform === 'win32'

class InMemoryPlanRepository implements PlanRepository {
  public readonly plans = new Map<string, Plan>()
  public readonly executions = new Map<string, Execution>()
  public readonly approvals = new Map<string, ApprovalDecision>()
  public readonly events = new Map<string, FlightRecorderEvent[]>()
  public putPlan(plan: Plan): Promise<void> { this.plans.set(plan.id, plan); return Promise.resolve() }
  public getPlan(id: string): Promise<Plan | null> { return Promise.resolve(this.plans.get(id) ?? null) }
  public putExecution(execution: Execution): Promise<void> { this.executions.set(execution.id, execution); return Promise.resolve() }
  public getExecution(id: string): Promise<Execution | null> { return Promise.resolve(this.executions.get(id) ?? null) }
  public putApproval(decision: ApprovalDecision): Promise<void> { this.approvals.set(decision.id, decision); return Promise.resolve() }
  public getApproval(id: string): Promise<ApprovalDecision | null> { return Promise.resolve(this.approvals.get(id) ?? null) }
  public appendEvent(executionId: string, event: FlightRecorderEvent): Promise<void> {
    this.events.set(executionId, [...(this.events.get(executionId) ?? []), event])
    return Promise.resolve()
  }
  public listEvents(executionId: string): Promise<FlightRecorderEvent[]> { return Promise.resolve(this.events.get(executionId) ?? []) }
}

let workspaceRoot = ''

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-proposal-'))
})

afterEach(async () => {
  if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
})

interface Harness {
  adapter: WorkspaceAdapter
  repository: InMemoryPlanRepository
  planning: PlanApprovalService
  proposals: WorkspaceWriteProposalService
  thread: AIThread
  turn: AITurn
  setWorkspaceRoot(root: string): void
  setup(): Promise<{ executionId: string; stepId: string }>
}

const createHarness = async (): Promise<Harness> => {
  const adapter = new WorkspaceAdapter()
  await adapter.configure(workspaceRoot)
  const repository = new InMemoryPlanRepository()
  const planning = new PlanApprovalService(repository)
  let root = workspaceRoot
  const now = new Date().toISOString()
  const thread: AIThread = { id: 'thread-prop', provider: 'ollama', workspaceRoot, model: 'modelo', createdAt: now, updatedAt: now }
  const turn: AITurn = { id: 'turn-prop', threadId: thread.id, mode: 'PLAN', inputHash: 'a'.repeat(64), createdAt: now }
  const history = {
    getAIThread: (id: string) => Promise.resolve(id === thread.id ? thread : null),
    listAITurns: (threadId: string) => Promise.resolve(threadId === thread.id ? [turn] : [])
  }
  const proposals = new WorkspaceWriteProposalService(
    planning,
    history,
    () => root,
    { inspectBaseline: async (relativePath) => await adapter.inspectWriteTarget(relativePath) }
  )
  return {
    adapter,
    repository,
    planning,
    proposals,
    thread,
    turn,
    setWorkspaceRoot: (next: string) => { root = next },
    setup: async () => {
      const planned = await planning.create('Proveniência de proposta', workspaceRoot, 'PLAN')
      const stepId = planned.plan.steps.find((step) => step.requiresApproval)?.id
      if (stepId === undefined) throw new Error('Fixture sem passo aprovável.')
      return { executionId: planned.execution.id, stepId }
    }
  }
}

const envelope = (harness: Harness, executionId: string, stepId: string, over: { relativePath: string; content: string; operation?: 'CREATE' | 'REPLACE' }) => ({
  envelope: {
    callId: randomUUID(),
    provider: harness.thread.provider,
    threadId: harness.thread.id,
    turnId: harness.turn.id,
    tool: 'workspace.write' as const,
    arguments: { relativePath: over.relativePath, content: over.content, operation: over.operation ?? 'CREATE' }
  },
  executionId,
  stepId
})

describe('workspace.write proposal — fail-closed baseline com WorkspaceAdapter real', () => {
  it('recusa CREATE com path traversal: proposta recusada, sem manifesto, sem payload, sem escrita', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    const hostile = '../fuga-fora-do-workspace.ts'
    const privateMarker = 'MARKER_TRAVERSAL_NAO_DEVE_VAZAR'

    await expect(
      harness.proposals.proposeFromEnvelope(envelope(harness, executionId, stepId, { relativePath: hostile, content: privateMarker }))
    ).rejects.toThrow()

    // Nenhum manifesto/efeito foi persistido.
    const { plan } = await harness.planning.read(executionId)
    expect(plan.steps.find((step) => step.id === stepId)?.effects).toHaveLength(0)

    // Nenhum arquivo foi escrito fora (ou dentro) do workspace.
    await expect(readFile(path.join(workspaceRoot, hostile), 'utf8')).rejects.toThrow()
    await expect(readFile(path.resolve(workspaceRoot, hostile), 'utf8')).rejects.toThrow()
  })

  it('recusa CREATE com caminho absoluto: proposta recusada e nenhuma escrita', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    const absolute = path.resolve(workspaceRoot, 'absoluto.ts')
    await expect(
      harness.proposals.proposeFromEnvelope(envelope(harness, executionId, stepId, { relativePath: absolute, content: 'x' }))
    ).rejects.toThrow()
    const { plan } = await harness.planning.read(executionId)
    expect(plan.steps.find((step) => step.id === stepId)?.effects).toHaveLength(0)
    await expect(readFile(absolute, 'utf8')).rejects.toThrow()
  })

  it('recusa CREATE quando o alvo já existe no workspace real', async () => {
    await writeFile(path.join(workspaceRoot, 'ja-existe.ts'), 'export const antigo = true\n', 'utf8')
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    await expect(
      harness.proposals.proposeFromEnvelope(envelope(harness, executionId, stepId, { relativePath: 'ja-existe.ts', content: 'novo' }))
    ).rejects.toThrow('CREATE exige que o alvo não exista')
    // Conteúdo pré-existente permanece intacto.
    await expect(readFile(path.join(workspaceRoot, 'ja-existe.ts'), 'utf8')).resolves.toBe('export const antigo = true\n')
  })

  it('recusa REPLACE quando o alvo não existe no workspace real', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    await expect(
      harness.proposals.proposeFromEnvelope(envelope(harness, executionId, stepId, { relativePath: 'inexistente.ts', content: 'x', operation: 'REPLACE' }))
    ).rejects.toThrow('REPLACE exige um arquivo existente')
  })

  it('aceita CREATE legítimo para alvo inexistente e reporta PENDING_REVIEW', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    const proposal = await harness.proposals.proposeFromEnvelope(
      envelope(harness, executionId, stepId, { relativePath: 'src/novo-arquivo.ts', content: 'export const novo = true\n' })
    )
    expect(proposal.effect.target).toBe('src/novo-arquivo.ts')
    expect(proposal.effect.expectedTargetHash).toBeNull()
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')
    // Antes da aprovação/materialização nada foi escrito.
    await expect(readFile(path.join(workspaceRoot, 'src', 'novo-arquivo.ts'), 'utf8')).rejects.toThrow()
  })
})

describe('workspace.write proposal — expiração e purga com WorkspaceAdapter real', () => {
  it('workspace drift na MESMA instância => EXPIRED, payload purgado, consume falha, segunda consulta EXPIRED', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    const proposal = await harness.proposals.proposeFromEnvelope(
      envelope(harness, executionId, stepId, { relativePath: 'src/drift.ts', content: 'PAYLOAD_DRIFT_PRIVADO' })
    )
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')

    // Troca o workspace autorizado sem recriar o serviço (prova drift real).
    harness.setWorkspaceRoot(`${workspaceRoot}-outro`)
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    // Segunda consulta permanece EXPIRED.
    expect(await harness.proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    // Consumir falha.
    await expect(harness.proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
    // Nenhum arquivo foi materializado.
    await expect(readFile(path.join(workspaceRoot, 'src', 'drift.ts'), 'utf8')).rejects.toThrow()
  })

  it('substituição no mesmo slot => A EXPIRED e B PENDING_REVIEW, com payload de A irrecuperável', async () => {
    const harness = await createHarness()
    const { executionId, stepId } = await harness.setup()
    const a = await harness.proposals.proposeFromEnvelope(
      envelope(harness, executionId, stepId, { relativePath: 'src/a.ts', content: 'CONTEUDO_PRIVADO_A' })
    )
    expect(await harness.proposals.lookupStatus(a.id)).toBe('PENDING_REVIEW')
    const b = await harness.proposals.proposeFromEnvelope(
      envelope(harness, executionId, stepId, { relativePath: 'src/b.ts', content: 'CONTEUDO_PRIVADO_B' })
    )
    expect(await harness.proposals.lookupStatus(a.id)).toBe('EXPIRED')
    expect(await harness.proposals.lookupStatus(b.id)).toBe('PENDING_REVIEW')
    await expect(harness.proposals.consume(a.id)).rejects.toThrow('não está disponível')
    // B ainda é consumível.
    await expect(harness.proposals.consume(b.id)).resolves.toMatchObject({ content: 'CONTEUDO_PRIVADO_B' })
  })
})

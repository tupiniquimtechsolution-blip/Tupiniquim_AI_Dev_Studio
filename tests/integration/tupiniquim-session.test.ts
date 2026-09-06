import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AIThread, AITurn, ApprovalDecision, Execution, FlightRecorderEvent, Plan } from '@tupiniquim/contracts'
import { PlanApprovalService, TupiniquimSessionService, WorkspaceWriteProposalService, type PlanRepository } from '@tupiniquim/core'

/**
 * Cross-platform Wave 15 invariants: Tupiniquim Session != Provider Thread.
 * Restart/recovery of this in-memory session is explicitly a Wave 16 gap.
 */

const isWindows = process.platform === 'win32'
const privateMarker = 'TUPINIQUIM_SESSION_PRIVATE_PAYLOAD'

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
  workspaceRoot = await mkdtemp(path.join(temp, 'tupiniquim-session-'))
})

afterEach(async () => {
  if (workspaceRoot !== '') await rm(workspaceRoot, { recursive: true, force: true })
})

describe('Tupiniquim session — continuidade e isolamento', () => {
  it('preserva a sessão na troca de provider, isola threads e expira a proposta causal', async () => {
    const sessions = new TupiniquimSessionService()
    const session = sessions.open(workspaceRoot)
    const repository = new InMemoryPlanRepository()
    const planning = new PlanApprovalService(repository)
    const now = new Date().toISOString()
    const thread: AIThread = {
      id: 'thread-ollama-session',
      provider: 'ollama',
      workspaceRoot,
      model: 'modelo',
      createdAt: now,
      updatedAt: now
    }
    const turn: AITurn = { id: 'turn-session', threadId: thread.id, mode: 'PLAN', inputHash: 'a'.repeat(64), createdAt: now }
    const history = {
      getAIThread: (id: string): Promise<AIThread | null> => Promise.resolve(id === thread.id ? thread : null),
      listAITurns: (threadId: string): Promise<AITurn[]> => Promise.resolve(threadId === thread.id ? [turn] : [])
    }
    const proposals = new WorkspaceWriteProposalService(
      planning,
      history,
      () => workspaceRoot,
      { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) }
    )
    const planned = await planning.create('Continuidade da sessão Tupiniquim', workspaceRoot, 'PLAN')
    const stepId = planned.plan.steps.find((step) => step.requiresApproval)?.id
    if (stepId === undefined) throw new Error('Plano sem passo aprovável.')

    sessions.bindProviderThread('ollama', thread.id, thread.model)
    sessions.appendTurn({
      role: 'user',
      text: 'Preserve esta conversa ao trocar de provider.',
      provider: 'ollama',
      model: thread.model,
      threadId: thread.id,
      turnId: turn.id
    })
    const proposal = await proposals.proposeFromEnvelope({
      envelope: {
        callId: randomUUID(),
        provider: 'ollama',
        threadId: thread.id,
        turnId: turn.id,
        tool: 'workspace.write',
        arguments: { relativePath: 'src/sessao.ts', content: privateMarker, operation: 'CREATE' }
      },
      executionId: planned.execution.id,
      stepId
    })
    sessions.grantProposalAuthority('ollama', thread.id, proposal.id)
    expect(await proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')

    const expiredIds = sessions.switchProvider('ollama', 'codex-app-server')
    for (const id of expiredIds) proposals.invalidate(id)
    expect(expiredIds).toEqual([proposal.id])
    expect(sessions.proposalAuthority()).toBeNull()
    expect(await proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    await expect(proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
    expect(() => sessions.assertProposalProvider('codex-app-server')).not.toThrow()
    sessions.bindProviderThread('codex-app-server', 'thread-codex-session', 'codex-test-model')
    expect(sessions.threadFor('ollama')).toBe(thread.id)
    expect(sessions.threadFor('codex-app-server')).toBe('thread-codex-session')
    expect(sessions.resolveChatThread('codex-app-server', thread.id)).toBe('thread-codex-session')

    const snapshot = sessions.snapshot()
    expect(snapshot?.session.id).toBe(session.id)
    expect(snapshot?.session.workspaceRoot).toBe(workspaceRoot)
    expect(JSON.stringify(snapshot)).not.toContain(privateMarker)
    expect(snapshot?.turns.some((item) => item.text.includes('Preserve esta conversa'))).toBe(true)
    expect(snapshot?.proposalAuthority).toBeNull()
  })

  it('troca de workspace cria sessão nova e não herda conversa, thread ou autoridade', () => {
    const sessions = new TupiniquimSessionService()
    const first = sessions.open(workspaceRoot)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    sessions.appendTurn({
      role: 'user',
      text: 'conversa do workspace A',
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-a',
      turnId: 'turn-a'
    })
    sessions.grantProposalAuthority('ollama', 'thread-a', randomUUID())
    const otherRoot = `${workspaceRoot}-b`
    const second = sessions.open(otherRoot)
    expect(second.id).not.toBe(first.id)
    const snapshot = sessions.snapshot()
    expect(snapshot?.session.workspaceRoot).toBe(otherRoot)
    expect(snapshot?.turns).toEqual([])
    expect(snapshot?.providerThreads).toEqual([])
    expect(snapshot?.proposalAuthority).toBeNull()
    expect(JSON.stringify(snapshot)).not.toContain('conversa do workspace A')
    expect(JSON.stringify(snapshot)).not.toContain('thread-a')
  })
})

import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AIEvent, AIThread, AITurn, ApprovalDecision, Execution, FlightRecorderEvent, Plan } from '@tupiniquim/contracts'
import { CodexAppServerAdapter, OllamaAdapter } from '@tupiniquim/adapters'
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
    expect(sessions.publicProviderContext()).toContain('Preserve esta conversa')
    expect(sessions.publicProviderContext()).not.toContain(privateMarker)
  })

  it('troca de workspace cria sessão nova e A → B → A recupera a sessão A', () => {
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

    const restored = sessions.open(workspaceRoot)
    expect(restored.id).toBe(first.id)
    expect(sessions.snapshot()?.turns.map((turn) => turn.text)).toEqual(['conversa do workspace A'])
    expect(sessions.threadFor('ollama')).toBe('thread-a')
    expect(sessions.proposalAuthority()).toBeNull()
    expect(sessions.publicProviderContext()).toContain('conversa do workspace A')
    expect(sessions.publicProviderContext()).not.toContain(privateMarker)
  })

  it('transfere contexto público Ollama → Codex fake, isola workspace B e registra o modelo real', async () => {
    const sessions = new TupiniquimSessionService()
    const sessionA = sessions.open(workspaceRoot)
    const architecture = 'Meu projeto usa arquitetura X'
    const ollamaBodies: string[] = []
    const delay = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 20))
    const waitFor = async (predicate: () => boolean): Promise<void> => {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (predicate()) return
        await delay()
      }
      throw new Error('Timeout aguardando adapter.')
    }
    const ndjsonResponse = (...chunks: unknown[]): Response => {
      const encoder = new TextEncoder()
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
          controller.close()
        }
      }))
    }
    const ollama = new OllamaAdapter({
      onEvent: (event) => {
        if (event.kind === 'MESSAGE_DELTA' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.applyAssistantDelta({
            provider: 'ollama',
            model: sessions.modelFor('ollama'),
            threadId: event.threadId,
            turnId: event.turnId,
            text: event.text ?? ''
          })
        } else if (event.kind === 'TURN_COMPLETED' && event.turnId !== undefined) {
          sessions.completeTurn(event.turnId)
        }
      },
      fetchImpl: (input, init) => {
        const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
        if (url.endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local', model: 'qwen-local' }] })))
        if (typeof init?.body === 'string') ollamaBodies.push(init.body)
        return Promise.resolve(ndjsonResponse({ message: { content: 'TUPINIQUIM_SESSION_OK' }, done: true }))
      },
      getWorkspaceRoot: () => workspaceRoot,
      history: {
        putAIThread: (thread) => {
          sessions.bindProviderThread('ollama', thread.id, thread.model)
          return Promise.resolve()
        },
        putAITurn: () => Promise.resolve(),
        appendAIEvent: () => Promise.resolve()
      }
    })
    await ollama.connect()
    ollama.selectModel('qwen-local')
    const ollamaRef = await ollama.send({ message: architecture, mode: 'CHAT' })
    sessions.appendTurn({
      role: 'user',
      text: architecture,
      provider: 'ollama',
      model: 'qwen-local',
      threadId: ollamaRef.threadId,
      turnId: ollamaRef.turnId
    })
    await waitFor(() => ollama.status().state === 'READY')
    expect(sessions.modelFor('ollama')).toBe('qwen-local')
    expect(sessions.snapshot()?.turns.some((turn) => turn.role === 'assistant' && turn.model === 'qwen-local' && turn.text.includes('TUPINIQUIM_SESSION_OK'))).toBe(true)

    const expired = sessions.switchProvider('ollama', 'codex-app-server')
    expect(expired).toEqual([])
    const sessionContext = sessions.publicProviderContext()
    expect(sessionContext).toContain(architecture)
    expect(sessionContext).not.toContain(privateMarker)

    const codexEvents: AIEvent[] = []
    const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
    const dataRoot = await mkdtemp(path.join(temp, 'tupiniquim-session-codex-'))
    const codex = new CodexAppServerAdapter({
      dataRoot,
      projectRoot: process.cwd(),
      getWorkspaceRoot: () => workspaceRoot,
      onEvent: (event) => {
        codexEvents.push(event)
        if (event.kind === 'MESSAGE_DELTA' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.applyAssistantDelta({
            provider: 'codex-app-server',
            model: sessions.modelFor('codex-app-server'),
            threadId: event.threadId,
            turnId: event.turnId,
            text: event.text ?? ''
          })
        } else if (event.kind === 'TURN_COMPLETED' && event.turnId !== undefined) {
          sessions.completeTurn(event.turnId)
        }
      },
      codexPath: process.execPath,
      serverArgs: [path.join(process.cwd(), 'tests', 'fixtures', 'fake-codex-app-server.mjs')],
      skipApiKeyLogin: true,
      history: {
        putAIThread: (thread) => {
          sessions.bindProviderThread('codex-app-server', thread.id, thread.model)
          return Promise.resolve()
        },
        putAITurn: () => Promise.resolve(),
        appendAIEvent: () => Promise.resolve()
      }
    })
    try {
      await codex.connect()
      const codexRef = await codex.send({
        message: 'Continue a análise',
        mode: 'CHAT',
        ...(sessionContext === undefined ? {} : { sessionContext })
      })
      sessions.appendTurn({
        role: 'user',
        text: 'Continue a análise',
        provider: 'codex-app-server',
        model: sessions.modelFor('codex-app-server'),
        threadId: codexRef.threadId,
        turnId: codexRef.turnId
      })
      await waitFor(() => codexEvents.some((event) => event.kind === 'TURN_COMPLETED' && event.turnId === codexRef.turnId))
      expect(codexRef.threadId).not.toBe(ollamaRef.threadId)
      expect(sessions.current()?.id).toBe(sessionA.id)
      expect(sessions.threadFor('ollama')).toBe(ollamaRef.threadId)
      expect(sessions.threadFor('codex-app-server')).toBe(codexRef.threadId)
      expect(codexEvents.some((event) => event.kind === 'MESSAGE_DELTA' && (event.text ?? '').includes('CONTEXTO_TUPINIQUIM_OK'))).toBe(true)
      expect(sessions.modelFor('codex-app-server')).toBe('codex-test-model')
      expect(sessions.snapshot()?.turns.some((turn) => turn.provider === 'codex-app-server' && turn.role === 'assistant' && turn.model === 'codex-test-model')).toBe(true)
      expect(JSON.stringify(sessions.snapshot())).not.toContain(privateMarker)

      const otherRoot = `${workspaceRoot}-b`
      const sessionB = sessions.open(otherRoot)
      expect(sessionB.id).not.toBe(sessionA.id)
      expect(sessions.publicProviderContext()).toBeUndefined()
      expect(JSON.stringify(sessions.snapshot())).not.toContain(architecture)

      const restored = sessions.open(workspaceRoot)
      expect(restored.id).toBe(sessionA.id)
      expect(sessions.publicProviderContext()).toContain(architecture)
      expect(sessions.threadFor('ollama')).toBe(ollamaRef.threadId)
      expect(sessions.threadFor('codex-app-server')).toBe(codexRef.threadId)

      const followUpContext = sessions.publicProviderContext()
      await ollama.send({
        message: 'Retome no Ollama.',
        mode: 'CHAT',
        threadId: ollamaRef.threadId,
        ...(followUpContext === undefined ? {} : { sessionContext: followUpContext })
      })
      await waitFor(() => ollama.status().state === 'READY')
      expect(ollamaBodies.at(-1)).toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
      expect(ollamaBodies.at(-1)).toContain(architecture)
      expect(ollamaBodies.at(-1)).not.toContain(privateMarker)
    } finally {
      await ollama.close()
      await codex.close()
      await rm(dataRoot, { recursive: true, force: true })
    }
  }, 30_000)
})

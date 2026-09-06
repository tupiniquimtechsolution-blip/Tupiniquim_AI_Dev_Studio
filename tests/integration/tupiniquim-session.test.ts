import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AIEvent, AIThread, AITurn, ApprovalDecision, Execution, FlightRecorderEvent, Plan } from '@tupiniquim/contracts'
import { CodexAppServerAdapter, OllamaAdapter } from '@tupiniquim/adapters'
import { PlanApprovalService, TupiniquimSessionService, WorkspaceWriteProposalService, assertIdleForWorkspaceSwitch, shouldCompleteTurnFromError, type PlanRepository } from '@tupiniquim/core'

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
    const proposalId = randomUUID()
    sessions.grantProposalAuthority('ollama', 'thread-a', proposalId)
    const otherRoot = `${workspaceRoot}-b`
    const expiredOnLeave = sessions.switchWorkspace(otherRoot)
    expect(expiredOnLeave).toEqual([proposalId])
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

  it('A PENDING → A→B→A invalida a proposta imediatamente e impede ressurreição', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceRoot)
    const repository = new InMemoryPlanRepository()
    const planning = new PlanApprovalService(repository)
    const now = new Date().toISOString()
    const thread: AIThread = {
      id: 'thread-ollama-resurrect',
      provider: 'ollama',
      workspaceRoot,
      model: 'modelo',
      createdAt: now,
      updatedAt: now
    }
    const turn: AITurn = { id: 'turn-resurrect', threadId: thread.id, mode: 'PLAN', inputHash: 'a'.repeat(64), createdAt: now }
    const history = {
      getAIThread: (id: string): Promise<AIThread | null> => Promise.resolve(id === thread.id ? thread : null),
      listAITurns: (threadId: string): Promise<AITurn[]> => Promise.resolve(threadId === thread.id ? [turn] : [])
    }
    let currentRoot = workspaceRoot
    const proposals = new WorkspaceWriteProposalService(
      planning,
      history,
      () => currentRoot,
      { inspectBaseline: () => Promise.resolve({ exists: false, hash: null }) }
    )
    const planned = await planning.create('Proposta não pode ressuscitar', workspaceRoot, 'PLAN')
    const stepId = planned.plan.steps.find((step) => step.requiresApproval)?.id
    if (stepId === undefined) throw new Error('Plano sem passo aprovável.')
    sessions.bindProviderThread('ollama', thread.id, thread.model)
    const proposal = await proposals.proposeFromEnvelope({
      envelope: {
        callId: randomUUID(),
        provider: 'ollama',
        threadId: thread.id,
        turnId: turn.id,
        tool: 'workspace.write',
        arguments: { relativePath: 'src/nao-ressuscita.ts', content: privateMarker, operation: 'CREATE' }
      },
      executionId: planned.execution.id,
      stepId
    })
    sessions.grantProposalAuthority('ollama', thread.id, proposal.id)
    expect(await proposals.lookupStatus(proposal.id)).toBe('PENDING_REVIEW')

    const otherRoot = `${workspaceRoot}-b`
    currentRoot = otherRoot
    const expired = sessions.switchWorkspace(otherRoot)
    for (const id of expired) proposals.invalidate(id)
    expect(expired).toEqual([proposal.id])
    expect(await proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    await expect(proposals.consume(proposal.id)).rejects.toThrow('não está disponível')

    currentRoot = workspaceRoot
    sessions.switchWorkspace(workspaceRoot)
    expect(await proposals.lookupStatus(proposal.id)).toBe('EXPIRED')
    await expect(proposals.consume(proposal.id)).rejects.toThrow('não está disponível')
    expect(sessions.proposalAuthority()).toBeNull()
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
        } else if (event.kind === 'TURN_COMPLETED' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.completeTurn('ollama', event.threadId, event.turnId, event.status)
        } else if (event.kind === 'ERROR' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.completeTurn('ollama', event.threadId, event.turnId, event.status ?? 'FAILED')
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
    expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    const pendingCodex = sessions.unseenPublicContext('codex-app-server')
    expect(pendingCodex.text).toContain(architecture)
    expect(pendingCodex.text).not.toContain(privateMarker)
    expect(sessions.publicProviderContext()).toContain(architecture)

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
        } else if (event.kind === 'TURN_COMPLETED' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.completeTurn('codex-app-server', event.threadId, event.turnId, event.status)
        } else if (
          event.kind === 'ERROR' &&
          event.threadId !== undefined &&
          event.turnId !== undefined &&
          shouldCompleteTurnFromError('codex-app-server', event.status ?? 'FAILED')
        ) {
          sessions.completeTurn('codex-app-server', event.threadId, event.turnId, event.status ?? 'FAILED')
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
        ...(pendingCodex.text === undefined ? {} : { sessionContext: pendingCodex.text })
      })
      sessions.notePendingContext('codex-app-server', codexRef.threadId, codexRef.turnId, pendingCodex.turnIds)
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
      expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })

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

      const followUpContext = sessions.unseenPublicContext('ollama')
      expect(followUpContext.text).toContain('Continue a análise')
      expect(followUpContext.text).not.toContain(architecture)
      const followUpRef = await ollama.send({
        message: 'Retome no Ollama.',
        mode: 'CHAT',
        threadId: ollamaRef.threadId,
        ...(followUpContext.text === undefined ? {} : { sessionContext: followUpContext.text })
      })
      sessions.notePendingContext('ollama', followUpRef.threadId, followUpRef.turnId, followUpContext.turnIds)
      await waitFor(() => ollama.status().state === 'READY')
      const lastOllama = JSON.parse(ollamaBodies.at(-1) ?? '{}') as { messages?: Array<{ role?: string; content?: string }> }
      const sessionMessage = lastOllama.messages?.find((message) => message.content?.includes('CONTEXTO DA SESSÃO TUPINIQUIM'))
      expect(sessionMessage?.content).toContain('Continue a análise')
      expect(sessionMessage?.content).not.toContain(architecture)
      expect(sessionMessage?.content).not.toContain(privateMarker)
      expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    } finally {
      await ollama.close()
      await codex.close()
      await rm(dataRoot, { recursive: true, force: true })
    }
  }, 30_000)

  it('recusa troca BUSY, isola o primeiro send em B e não consome contexto em ERROR/CANCELLED', async () => {
    const sessions = new TupiniquimSessionService()
    const sessionA = sessions.open(workspaceRoot)
    const architecture = 'Meu projeto usa arquitetura X'
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
    let hangRelease = (): void => undefined
    let hangNotify = (): void => undefined
    let hangStarted = Promise.resolve()
    let chatMode: 'hang' | 'fail' | 'ok' = 'hang'
    const armHang = (): void => {
      hangRelease = (): void => undefined
      hangStarted = new Promise<void>((resolve) => { hangNotify = resolve })
    }
    armHang()
    const ollama = new OllamaAdapter({
      onEvent: (event) => {
        if (!sessions.acceptsProviderEvent('ollama', event.threadId)) return
        if (event.kind === 'MESSAGE_DELTA' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.applyAssistantDelta({
            provider: 'ollama',
            model: sessions.modelFor('ollama'),
            threadId: event.threadId,
            turnId: event.turnId,
            text: event.text ?? ''
          })
        } else if (event.kind === 'TURN_COMPLETED' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.completeTurn('ollama', event.threadId, event.turnId, event.status)
        } else if (event.kind === 'ERROR' && event.threadId !== undefined && event.turnId !== undefined) {
          sessions.completeTurn('ollama', event.threadId, event.turnId, event.status ?? 'FAILED')
        }
      },
      fetchImpl: (input, init) => {
        const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
        if (url.endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local', model: 'qwen-local' }] })))
        if (chatMode === 'fail') return Promise.resolve(new Response('', { status: 500 }))
        if (chatMode === 'hang') {
          const encoder = new TextEncoder()
          let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller
              controller.enqueue(encoder.encode(JSON.stringify({ message: { content: 'DELTA_A' }, done: false }) + '\n'))
              hangNotify()
              hangRelease = () => {
                streamController?.enqueue(encoder.encode(JSON.stringify({ message: { content: '_OK' }, done: true }) + '\n'))
                streamController?.close()
              }
            }
          })
          init?.signal?.addEventListener('abort', () => streamController?.error(new DOMException('Aborted', 'AbortError')), { once: true })
          return Promise.resolve(new Response(stream))
        }
        return Promise.resolve(ndjsonResponse({ message: { content: 'TUPINIQUIM_SESSION_B' }, done: true }))
      },
      getWorkspaceRoot: () => sessions.current()?.workspaceRoot ?? workspaceRoot,
      history: {
        putAIThread: (thread) => {
          sessions.bindProviderThread('ollama', thread.id, thread.model)
          return Promise.resolve()
        },
        putAITurn: () => Promise.resolve(),
        appendAIEvent: () => Promise.resolve()
      }
    })
    try {
      await ollama.connect()
      ollama.selectModel('qwen-local')
      const firstA = await ollama.send({ message: architecture, mode: 'CHAT' })
      sessions.notePendingContext('ollama', firstA.threadId, firstA.turnId, [])
      sessions.appendTurn({
        role: 'user',
        text: architecture,
        provider: 'ollama',
        model: 'qwen-local',
        threadId: firstA.threadId,
        turnId: firstA.turnId
      })
      await hangStarted
      expect(ollama.status().state).toBe('BUSY')
      expect(() => assertIdleForWorkspaceSwitch(true)).toThrow('Aguarde o turno do agente terminar antes de trocar de workspace.')
      expect(sessions.current()?.id).toBe(sessionA.id)
      await waitFor(() => (sessions.snapshot()?.turns.some((turn) => turn.role === 'assistant' && turn.text.includes('DELTA_A')) ?? false))
      hangRelease()
      await waitFor(() => ollama.status().state === 'READY')
      expect(sessions.snapshot()?.turns.some((turn) => turn.role === 'assistant' && turn.text.includes('DELTA_A_OK'))).toBe(true)
      expect(sessions.threadFor('ollama')).toBe(firstA.threadId)

      const otherRoot = `${workspaceRoot}-b`
      sessions.switchWorkspace(otherRoot)
      const sessionB = sessions.open(otherRoot)
      expect(sessionB.id).not.toBe(sessionA.id)
      expect(sessions.threadFor('ollama')).toBeUndefined()
      expect(sessions.resolveChatThread('ollama', firstA.threadId)).toBeUndefined()
      expect(sessions.scopedStatus(ollama.status())).toMatchObject({ activeThreadId: null, activeTurnId: null })
      expect(sessions.acceptsProviderEvent('ollama', firstA.threadId)).toBe(false)

      chatMode = 'ok'
      const firstB = await ollama.send({ message: 'primeira mensagem em B', mode: 'CHAT' })
      sessions.appendTurn({
        role: 'user',
        text: 'primeira mensagem em B',
        provider: 'ollama',
        model: 'qwen-local',
        threadId: firstB.threadId,
        turnId: firstB.turnId
      })
      await waitFor(() => ollama.status().state === 'READY')
      expect(firstB.threadId).not.toBe(firstA.threadId)
      expect(sessions.threadFor('ollama')).toBe(firstB.threadId)
      expect(sessions.publicProviderContext()).toContain('primeira mensagem em B')
      expect(sessions.publicProviderContext()).not.toContain(architecture)

      const restored = sessions.open(workspaceRoot)
      expect(restored.id).toBe(sessionA.id)
      expect(sessions.threadFor('ollama')).toBe(firstA.threadId)
      expect(sessions.publicProviderContext()).toContain(architecture)
      expect(sessions.publicProviderContext()).not.toContain('primeira mensagem em B')

      const pending = sessions.unseenPublicContext('codex-app-server')
      expect(pending.turnIds.length).toBeGreaterThan(0)
      const unseenBeforeError = [...pending.turnIds]
      sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-ack', pending.turnIds)
      chatMode = 'fail'
      const errorRef = await ollama.send({
        message: 'retry após erro',
        mode: 'CHAT',
        threadId: firstA.threadId,
        ...(pending.text === undefined ? {} : { sessionContext: pending.text })
      })
      sessions.notePendingContext('ollama', errorRef.threadId, errorRef.turnId, [])
      await waitFor(() => ollama.status().state === 'ERROR')
      expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(expect.arrayContaining(unseenBeforeError))

      await ollama.connect()
      chatMode = 'hang'
      armHang()
      const cancelPending = sessions.unseenPublicContext('codex-app-server')
      const cancelRef = await ollama.send({
        message: 'vai cancelar',
        mode: 'CHAT',
        threadId: firstA.threadId,
        ...(cancelPending.text === undefined ? {} : { sessionContext: cancelPending.text })
      })
      sessions.notePendingContext('ollama', cancelRef.threadId, cancelRef.turnId, [])
      await hangStarted
      await ollama.interrupt(cancelRef)
      await waitFor(() => ollama.status().state === 'READY')
      expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(expect.arrayContaining(unseenBeforeError))

      chatMode = 'ok'
      const successPending = sessions.unseenPublicContext('codex-app-server')
      const successRef = await ollama.send({
        message: 'sucesso após retry',
        mode: 'CHAT',
        threadId: firstA.threadId,
        ...(successPending.text === undefined ? {} : { sessionContext: successPending.text })
      })
      sessions.notePendingContext('ollama', successRef.threadId, successRef.turnId, [])
      await waitFor(() => ollama.status().state === 'READY')
      expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(expect.arrayContaining(unseenBeforeError))
      sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-ack', 'COMPLETED')
      const unseenAfterSuccess = sessions.unseenPublicContext('codex-app-server').turnIds
      expect(unseenBeforeError.every((turnId) => !unseenAfterSuccess.includes(turnId))).toBe(true)
      expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
    } finally {
      await ollama.close()
    }
  }, 30_000)
})

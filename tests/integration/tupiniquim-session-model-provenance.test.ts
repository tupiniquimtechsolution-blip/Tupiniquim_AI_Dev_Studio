import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase, OllamaAdapter } from '@tupiniquim/adapters'
import {
  validateTupiniquimSessionSnapshotProvenance,
  type AgentTurnReference,
  type AIEvent,
  type AIProviderKind,
  type AIThread,
  type TupiniquimDurableSnapshot
} from '@tupiniquim/contracts'
import {
  TupiniquimSessionRecovery,
  TupiniquimSessionService,
  TupiniquimSessionSnapshotCoordinator,
  isTransientTurnStatus,
  shouldCompleteTurnFromError,
  type TupiniquimSendTurnCommit,
  type TupiniquimSnapshotFlushOutcome
} from '@tupiniquim/core'

/**
 * Wave 16 — Incremento 3/4 — MODEL PROVENANCE REAL (teste obrigatório A+B).
 *
 * Fluxo REAL com SQLite real (worker v5), OllamaAdapter real (fetch fake
 * loopback) e o mesmo caminho de commit do processo main
 * (TupiniquimSessionSnapshotCoordinator.commitSendTurn).
 *
 * A. MODELO REAL NO TURN
 *    - send com modelo A → TupiniquimTurn.model == A (durável);
 *    - selecionar B e enviar na MESMA thread → novo turn.model == B (nunca A
 *      falsificado), turns antigos preservam A, binding e AIThread assumem B.
 *
 * B. CRASH CONSISTENCY (fault injection no meio da transação atômica)
 *    - S1 com AIThread.model=A + binding.model=A;
 *    - tentativa de trocar para B com failAfter no meio → ROLLBACK completo:
 *      AIThread.model=A, binding.model=A, snapshot anterior íntegro;
 *    - depois sem falha → AIThread.model=B, binding.model=B, novo turn B;
 *    - restart → HYDRATED com zero MODEL_MISMATCH.
 */

const isWindows = process.platform === 'win32'
const modelA = 'modelo-a'
const modelB = 'modelo-b'
const workspaceContext = 'CONTEXTO DO WORKSPACE — SOMENTE METADADOS'

let fixture = ''
const databases: LocalDatabase[] = []

const openDatabase = (options: { failAfter?: { snapshotWriteStatements?: number } } = {}): LocalDatabase => {
  const database = new LocalDatabase(fixture, options)
  databases.push(database)
  return database
}

const closeDatabase = async (database: LocalDatabase): Promise<void> => {
  const index = databases.indexOf(database)
  if (index >= 0) databases.splice(index, 1)
  await database.close()
}

const delay = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 20))
const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await delay()
  }
  throw new Error('Timeout aguardando estado do runtime de teste.')
}

const urlFor = (input: Parameters<typeof fetch>[0]): string => input instanceof URL ? input.href : typeof input === 'string' ? input : input.url

const makeFetchImpl = (chatBodies: string[]): typeof fetch => (input, init) => {
  const url = urlFor(input)
  if (url.endsWith('/api/tags')) {
    return Promise.resolve(new Response(JSON.stringify({ models: [{ name: modelA }, { name: modelB }] })))
  }
  if (typeof init?.body === 'string') chatBodies.push(init.body)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ message: { content: 'RESPOSTA_' }, done: false }) + '\n'))
      controller.enqueue(encoder.encode(JSON.stringify({ message: { content: 'MODELO' }, done: true }) + '\n'))
      controller.close()
    }
  })
  return Promise.resolve(new Response(stream))
}

/**
 * Espelho mínimo do wiring do processo main: publishAgentEvent (mutação da
 * sessão + write-through nos eventos terminais) e o caminho de send
 * (hydrate Ollama → agent.send → commitSendTurn). O commit de provenance é a
 * MESMA implementação usada pelo main (core), não uma cópia.
 */
interface Runtime {
  sessions: TupiniquimSessionService
  coordinator: TupiniquimSessionSnapshotCoordinator
  adapter: OllamaAdapter
  chatBodies: string[]
  flushErrors: TupiniquimSnapshotFlushOutcome[]
  send: (message: string, options?: { threadId?: string; workspaceContext?: string }) => Promise<{
    reference: AgentTurnReference
    commit: TupiniquimSendTurnCommit
  }>
  drain: () => Promise<void>
}

const createRuntime = (input: {
  database: LocalDatabase
  root: string
  sessions?: TupiniquimSessionService
  scheduleFlushes?: boolean
  openSession?: boolean
}): Runtime => {
  const sessions = input.sessions ?? new TupiniquimSessionService()
  if (input.sessions === undefined && input.openSession !== false) sessions.open(input.root)
  const flushErrors: TupiniquimSnapshotFlushOutcome[] = []
  const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, input.database, {
    onFlushError: (outcome) => { flushErrors.push(outcome) }
  })
  const chatBodies: string[] = []
  const provider: AIProviderKind = 'ollama'
  const publishAgentEvent = (event: AIEvent): void => {
    const foreignThread = !sessions.acceptsProviderEvent(provider, event.threadId)
    if (sessions.current() === null || foreignThread) return
    const model = sessions.modelFor(provider)
    const sessionRoot = sessions.current()?.workspaceRoot ?? null
    if (event.kind === 'MESSAGE_DELTA' && event.threadId !== undefined && event.turnId !== undefined) {
      sessions.applyAssistantDelta({ provider, model, threadId: event.threadId, turnId: event.turnId, text: event.text ?? '' })
    } else if (event.kind === 'TURN_COMPLETED' && event.threadId !== undefined && event.turnId !== undefined) {
      sessions.completeTurn(provider, event.threadId, event.turnId, event.status)
      if (input.scheduleFlushes !== false && sessionRoot !== null && !isTransientTurnStatus(event.status)) {
        coordinator.schedule(sessionRoot)
      }
    } else if (event.kind === 'ERROR') {
      if (event.threadId !== undefined && event.turnId !== undefined && shouldCompleteTurnFromError(provider, event.status ?? 'FAILED')) {
        sessions.completeTurn(provider, event.threadId, event.turnId, event.status ?? 'FAILED')
      }
      sessions.appendTurn({
        role: 'error',
        text: event.detail ?? 'Falha no provider.',
        provider,
        model,
        threadId: event.threadId ?? null,
        turnId: event.turnId ?? null
      })
      if (input.scheduleFlushes !== false && sessionRoot !== null) coordinator.schedule(sessionRoot)
    }
  }
  const adapter = new OllamaAdapter({
    onEvent: publishAgentEvent,
    fetchImpl: makeFetchImpl(chatBodies),
    getWorkspaceRoot: () => input.root,
    history: input.database
  })
  const send = async (message: string, options: { threadId?: string; workspaceContext?: string } = {}) => {
    const sessionBoundThread = sessions.threadFor(provider)
    const boundThread = sessions.resolveChatThread(provider, options.threadId)
    if (
      sessionBoundThread !== undefined &&
      boundThread === sessionBoundThread &&
      !adapter.hasConversation(sessionBoundThread)
    ) {
      await adapter.hydrateConversation({
        threadId: sessionBoundThread,
        model: sessions.modelFor(provider),
        messages: sessions.durableConversationForThread(sessionBoundThread)
      })
    }
    const pendingContext = sessions.unseenPublicContext(provider)
    const reference = await adapter.send({
      message,
      mode: 'CHAT',
      ...(boundThread === undefined ? {} : { threadId: boundThread }),
      ...(options.workspaceContext === undefined ? {} : { workspaceContext: options.workspaceContext })
    })
    const persistedThread = await input.database.getAIThread(reference.threadId)
    const commit = await coordinator.commitSendTurn({
      provider,
      reference,
      message,
      persistedThread,
      pendingContextTurnIds: pendingContext.turnIds,
      workspaceRoot: input.root
    })
    return { reference, commit }
  }
  const drain = async (): Promise<void> => {
    await waitFor(() => adapter.status().state === 'READY')
    await coordinator.flush(input.root)
  }
  return { sessions, coordinator, adapter, chatBodies, flushErrors, send, drain }
}

const turnModelsOf = (snapshot: TupiniquimDurableSnapshot | null): Array<string | null> =>
  (snapshot?.turns ?? []).map((turn) => turn.model)

const assertNoOrphanAssistant = (snapshot: TupiniquimDurableSnapshot | null): void => {
  const users = new Set((snapshot?.turns ?? []).filter((turn) => turn.role === 'user').map((turn) => `${turn.provider}\u001f${turn.threadId}\u001f${turn.turnId}`))
  for (const turn of snapshot?.turns ?? []) {
    if (turn.role !== 'assistant') continue
    expect(users.has(`${turn.provider}\u001f${turn.threadId}\u001f${turn.turnId}`)).toBe(true)
  }
}

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-model-provenance-'))
})

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close()
  if (fixture !== '') await rm(fixture, { recursive: true, force: true })
})

describe('Wave 16 inc3 — model provenance real com write-through atômico', () => {
  it('não hidrata thread Ollama persistida indicada só pelo renderer sem binding de sessão', async () => {
    const root = path.join(fixture, 'workspace-thread-sem-binding')
    const database = openDatabase()
    const threadId = 'thread-persistida-sem-binding'
    const now = new Date().toISOString()
    await database.putAIThread({
      id: threadId,
      provider: 'ollama',
      workspaceRoot: root,
      model: modelA,
      createdAt: now,
      updatedAt: now
    })

    const runtime = createRuntime({ database, root })
    await runtime.adapter.connect()
    runtime.adapter.selectModel(modelA)
    expect(runtime.sessions.threadFor('ollama')).toBeUndefined()
    expect(runtime.adapter.hasConversation(threadId)).toBe(false)

    await expect(runtime.send('renderer não pode dar autoridade de hydrate', { threadId }))
      .rejects.toThrow('Thread Ollama persistida não pode ser retomada sem o histórico em memória desta sessão.')

    expect(runtime.sessions.threadFor('ollama')).toBeUndefined()
    expect(runtime.adapter.hasConversation(threadId)).toBe(false)
    expect(runtime.chatBodies).toHaveLength(0)
    expect(await database.getTupiniquimSessionSnapshot(root)).toBeNull()
    await runtime.adapter.close()
  })

  it('A: modelo real no turn — A → A; selecionar B na mesma thread → B (nunca A falsificado)', async () => {
    const root = path.join(fixture, 'workspace-a')
    const database = openDatabase()
    const runtime = createRuntime({ database, root })

    await runtime.adapter.connect()
    runtime.adapter.selectModel(modelA)
    const first = await runtime.send('primeira pergunta', { workspaceContext })
    expect(first.reference.model).toBe(modelA)
    expect(first.commit.model).toBe(modelA)
    expect(first.commit.threadModelSwapped).toBe(false)
    expect(first.commit.flush.status).toBe('COMMITTED')
    await runtime.drain()

    const threadId = first.reference.threadId
    const snapshotOne = await database.getTupiniquimSessionSnapshot(root)
    expect(turnModelsOf(snapshotOne)).toEqual([modelA, modelA])
    expect(snapshotOne?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: modelA }])
    expect(await database.getAIThread(threadId)).toMatchObject({ model: modelA })
    assertNoOrphanAssistant(snapshotOne)

    // Usuário seleciona outro modelo Ollama na MESMA thread vinculada.
    runtime.adapter.selectModel(modelB)
    const second = await runtime.send('segunda pergunta', { threadId })
    expect(second.reference.model).toBe(modelB)
    expect(second.commit.model).toBe(modelB)
    expect(second.commit.threadModelSwapped).toBe(true)
    expect(second.commit.flush.status).toBe('COMMITTED')
    await runtime.drain()

    // O request REAL usou B.
    const secondBody = JSON.parse(runtime.chatBodies.at(-1) ?? '{}') as { model: string }
    expect(secondBody.model).toBe(modelB)

    const snapshotTwo = await database.getTupiniquimSessionSnapshot(root)
    // turn.model do novo turn é exatamente B; os turns antigos preservam A.
    expect(turnModelsOf(snapshotTwo)).toEqual([modelA, modelA, modelB, modelB])
    expect(snapshotTwo?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: modelB }])
    expect(await database.getAIThread(threadId)).toMatchObject({ model: modelB })
    assertNoOrphanAssistant(snapshotTwo)
    expect(runtime.flushErrors).toHaveLength(0)
    expect(runtime.coordinator.isDirty(root)).toBe(false)

    // Restart real: novo banco sobre o mesmo arquivo + recovery fail-closed.
    await runtime.adapter.close()
    await closeDatabase(database)
    const reopened = openDatabase()
    const sessions = new TupiniquimSessionService()
    const recovery = new TupiniquimSessionRecovery(sessions, reopened, reopened)
    const restored = await recovery.restore(root)
    expect(restored.outcome).toBe('HYDRATED')
    expect(restored.reasons).toEqual([])
    expect(sessions.modelFor('ollama')).toBe(modelB)
    expect(sessions.threadFor('ollama')).toBe(threadId)
    expect(sessions.snapshot()?.turns.map((turn) => turn.model)).toEqual([modelA, modelA, modelB, modelB])

    // Zero MODEL_MISMATCH: provenance integral turn → binding → AIThread.
    const snapshot = await reopened.getTupiniquimSessionSnapshot(root)
    const threads: AIThread[] = []
    const resolved = await reopened.getAIThread(threadId)
    if (resolved !== null) threads.push(resolved)
    expect(validateTupiniquimSessionSnapshotProvenance(snapshot ?? failSnapshot(), threads, root)).toEqual([])

    // Retomada pós-restart: hydrate da conversation + send na T1 com o
    // workspace context atual presente no request, sem duplicação persistida.
    const resumed = createRuntime({ database: reopened, root, sessions })
    await resumed.adapter.connect()
    const third = await resumed.send('terceira pergunta pós-restart', { threadId, workspaceContext })
    expect(third.reference.model).toBe(modelB)
    expect(third.commit.threadModelSwapped).toBe(false)
    await resumed.drain()
    const thirdBody = JSON.parse(resumed.chatBodies.at(-1) ?? '{}') as { model: string; messages: Array<{ role: string; content: string }> }
    expect(thirdBody.model).toBe(modelB)
    expect(thirdBody.messages.map((message) => message.content)).toEqual([
      workspaceContext,
      'primeira pergunta',
      'RESPOSTA_MODELO',
      'segunda pergunta',
      'RESPOSTA_MODELO',
      'terceira pergunta pós-restart'
    ])
    expect(thirdBody.messages.filter((message) => message.role === 'system')).toHaveLength(1)
    await resumed.adapter.close()
  })

  it('B: crash consistency — fault injection no meio da troca A → B faz rollback completo e depois converge', async () => {
    const root = path.join(fixture, 'workspace-b')
    // Fase 1: estado S1 consistente com modelo A (thread + binding + turns).
    const setup = openDatabase()
    const runtimeSetup = createRuntime({ database: setup, root })
    await runtimeSetup.adapter.connect()
    runtimeSetup.adapter.selectModel(modelA)
    const first = await runtimeSetup.send('primeira pergunta', { workspaceContext })
    const threadId = first.reference.threadId
    await runtimeSetup.drain()
    const snapshotOne = await setup.getTupiniquimSessionSnapshot(root)
    expect(turnModelsOf(snapshotOne)).toEqual([modelA, modelA])
    await runtimeSetup.adapter.close()
    await closeDatabase(setup)

    // Fase 2: restart + tentativa de trocar para B com falha injetada no meio
    // da transação atômica (após o UPDATE de ai_threads, antes do COMMIT).
    const faulted = openDatabase({ failAfter: { snapshotWriteStatements: 3 } })
    const sessions = new TupiniquimSessionService()
    const recovery = new TupiniquimSessionRecovery(sessions, faulted, faulted)
    const restored = await recovery.restore(root)
    expect(restored.outcome).toBe('HYDRATED')
    expect(sessions.modelFor('ollama')).toBe(modelA)
    const runtimeFaulted = createRuntime({ database: faulted, root, sessions, scheduleFlushes: false })
    await runtimeFaulted.adapter.connect()
    runtimeFaulted.adapter.selectModel(modelB)
    const swap = await runtimeFaulted.send('segunda pergunta com modelo B', { threadId })
    expect(swap.reference.model).toBe(modelB)
    expect(swap.commit.threadModelSwapped).toBe(true)
    // O flush falhou: a troca NÃO é declarada durável.
    expect(swap.commit.flush.status).toBe('FAILED')
    expect(runtimeFaulted.flushErrors).toHaveLength(1)
    expect(runtimeFaulted.coordinator.isDirty(root)).toBe(true)

    // ROLLBACK completo: AIThread.model=A, binding do snapshot=A, snapshot
    // anterior íntegro (nenhum turn novo, nenhum binding novo).
    expect(await faulted.getAIThread(threadId)).toMatchObject({ model: modelA })
    const rolled = await faulted.getTupiniquimSessionSnapshot(root)
    expect(turnModelsOf(rolled)).toEqual([modelA, modelA])
    expect(rolled?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: modelA }])
    expect(rolled?.turns.some((turn) => turn.text.includes('modelo B'))).toBe(false)
    // Em memória o turn real usou B (a execução é real); o durável permanece
    // no estado anterior consistente até o retry.
    expect(sessions.snapshot()?.turns.at(-1)?.model).toBe(modelB)
    expect(sessions.modelFor('ollama')).toBe(modelB)
    await runtimeFaulted.adapter.close()
    await closeDatabase(faulted)

    // Fase 3: sem falha — o próximo write-through converge para B.
    const clean = openDatabase()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, clean)
    await coordinator.flush(root)
    expect(coordinator.isDirty(root)).toBe(false)
    expect(await clean.getAIThread(threadId)).toMatchObject({ model: modelB })
    const converged = await clean.getTupiniquimSessionSnapshot(root)
    expect(converged?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: modelB }])
    // Turns antigos preservam o model real A; os turns do request com B são B.
    expect(turnModelsOf(converged)).toEqual([modelA, modelA, modelB, modelB])
    assertNoOrphanAssistant(converged)
    await closeDatabase(clean)

    // Fase 4: restart real — HYDRATED, zero MODEL_MISMATCH.
    const reopened = openDatabase()
    const sessionsFinal = new TupiniquimSessionService()
    const recoveryFinal = new TupiniquimSessionRecovery(sessionsFinal, reopened, reopened)
    const final = await recoveryFinal.restore(root)
    expect(final.outcome).toBe('HYDRATED')
    expect(final.reasons).toEqual([])
    expect(sessionsFinal.modelFor('ollama')).toBe(modelB)
    expect(sessionsFinal.snapshot()?.turns.map((turn) => turn.model)).toEqual([modelA, modelA, modelB, modelB])
    const finalSnapshot = await reopened.getTupiniquimSessionSnapshot(root)
    const finalThread = await reopened.getAIThread(threadId)
    expect(validateTupiniquimSessionSnapshotProvenance(finalSnapshot ?? failSnapshot(), finalThread === null ? [] : [finalThread], root)).toEqual([])
  })

  it('write-through: completion-before-send-return nunca commita assistant terminal sem o user causal', async () => {
    const root = path.join(fixture, 'workspace-c')
    const database = openDatabase()
    const sessions = new TupiniquimSessionService()
    sessions.open(root)
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, database)
    await database.putAIThread({ id: 'thread-ollama', provider: 'ollama', workspaceRoot: root, model: modelA, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    sessions.bindProviderThread('ollama', 'thread-ollama', modelA)

    // Assistant terminal concluído ANTES do user causal existir (race real de
    // completion-before-send-return): o capture exclui o assistant órfão.
    sessions.applyAssistantDelta({ provider: 'ollama', model: modelA, threadId: 'thread-ollama', turnId: 'turn-1', text: 'resposta órfã' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-1', 'COMPLETED')
    const intermediate = await coordinator.flush(root)
    expect(intermediate.status).toBe('COMMITTED')
    const snapshotIntermediate = await database.getTupiniquimSessionSnapshot(root)
    expect(snapshotIntermediate?.turns).toEqual([])
    assertNoOrphanAssistant(snapshotIntermediate)

    // O send retorna: o user causal é inserido ANTES do assistant (ordem
    // preservada) e o snapshot passa a conter o par completo.
    const commit = await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-1', model: modelA },
      message: 'pergunta causal',
      persistedThread: null,
      pendingContextTurnIds: [],
      workspaceRoot: root
    })
    expect(commit.flush.status).toBe('COMMITTED')
    const snapshotFinal = await database.getTupiniquimSessionSnapshot(root)
    expect(snapshotFinal?.turns.map((turn) => [turn.role, turn.turnId])).toEqual([['user', 'turn-1'], ['assistant', 'turn-1']])
    assertNoOrphanAssistant(snapshotFinal)
  })

  it('write-through: FAILED não avança seen e o assistant parcial não vira snapshot final', async () => {
    const root = path.join(fixture, 'workspace-d')
    const database = openDatabase()
    const sessions = new TupiniquimSessionService()
    sessions.open(root)
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, database)
    const threadTimestamp = new Date().toISOString()
    await database.putAIThread({ id: 'thread-codex', provider: 'codex-app-server', workspaceRoot: root, model: 'codex-test-model', createdAt: threadTimestamp, updatedAt: threadTimestamp })
    await database.putAIThread({ id: 'thread-ollama', provider: 'ollama', workspaceRoot: root, model: modelA, createdAt: threadTimestamp, updatedAt: threadTimestamp })
    sessions.bindProviderThread('codex-app-server', 'thread-codex', 'codex-test-model')
    sessions.bindProviderThread('ollama', 'thread-ollama', modelA)
    // Contexto público cross-provider ainda não visto pelo Ollama.
    const codexTurn = sessions.appendTurn({
      role: 'user',
      text: 'contexto público do codex',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-codex',
      turnId: 'turn-codex-1'
    })

    // Turn Ollama que FALHA: assistant parcial criado, user causal commitado.
    // O contexto público unseen é computado ANTES do send e viaja no
    // commitSendTurn (mesmo caminho do main).
    const pendingFailure = sessions.unseenPublicContext('ollama')
    expect(pendingFailure.turnIds).toEqual([codexTurn.id])
    sessions.applyAssistantDelta({ provider: 'ollama', model: modelA, threadId: 'thread-ollama', turnId: 'turn-1', text: 'parcial que vai falhar' })
    await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-1', model: modelA },
      message: 'pergunta que vai falhar',
      persistedThread: null,
      pendingContextTurnIds: pendingFailure.turnIds,
      workspaceRoot: root
    })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-1', 'FAILED')
    sessions.appendTurn({ role: 'error', text: 'Falha no provider.', provider: 'ollama', model: modelA, threadId: 'thread-ollama', turnId: 'turn-1' })
    const failed = await coordinator.flush(root)
    expect(failed.status).toBe('COMMITTED')

    const afterFailure = await database.getTupiniquimSessionSnapshot(root)
    // O user causal é durável; o assistant parcial e o turn de erro NÃO são.
    expect(afterFailure?.turns.map((turn) => [turn.role, turn.text])).toEqual([['user', 'contexto público do codex'], ['user', 'pergunta que vai falhar']])
    // FAILED não avança seen: o codex turn segue não-ACKado para o Ollama.
    expect(afterFailure?.seenByProvider.ollama).not.toContain(codexTurn.id)
    expect(sessions.unseenPublicContext('ollama').turnIds).toEqual([codexTurn.id])

    // Retry bem-sucedido consuma o contexto (ACK-only-after-success).
    const pendingRetry = sessions.unseenPublicContext('ollama')
    expect(pendingRetry.turnIds).toEqual([codexTurn.id])
    sessions.applyAssistantDelta({ provider: 'ollama', model: modelA, threadId: 'thread-ollama', turnId: 'turn-2', text: 'resposta ok' })
    await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-2', model: modelA },
      message: 'retry da pergunta',
      persistedThread: null,
      pendingContextTurnIds: pendingRetry.turnIds,
      workspaceRoot: root
    })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-2', 'COMPLETED')
    const success = await coordinator.flush(root)
    expect(success.status).toBe('COMMITTED')
    const afterSuccess = await database.getTupiniquimSessionSnapshot(root)
    expect(afterSuccess?.seenByProvider.ollama).toContain(codexTurn.id)
    expect(afterSuccess?.turns.map((turn) => turn.role)).toEqual(['user', 'user', 'user', 'assistant'])
    assertNoOrphanAssistant(afterSuccess)
  })

  it('write-through da troca de workspace: o snapshot do root que sai é commitado antes da transição', async () => {
    const rootA = path.join(fixture, 'workspace-ea')
    const rootB = path.join(fixture, 'workspace-eb')
    const database = openDatabase()
    const sessions = new TupiniquimSessionService()
    sessions.open(rootA)
    await database.putAIThread({ id: 'thread-a', provider: 'ollama', workspaceRoot: rootA, model: modelA, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    sessions.bindProviderThread('ollama', 'thread-a', modelA)
    sessions.appendTurn({ role: 'user', text: 'conversa do workspace A', provider: 'ollama', model: modelA, threadId: 'thread-a', turnId: 'turn-1' })
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, database)
    await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-a', turnId: 'turn-2', model: modelA },
      message: 'segunda do workspace A',
      persistedThread: null,
      pendingContextTurnIds: [],
      workspaceRoot: rootA
    })
    // Simula a ordem canônica do workspace.configure: flush do root que sai
    // ANTES da transição, depois recovery do root que entra.
    await coordinator.flush(rootA)
    const recovery = new TupiniquimSessionRecovery(sessions, database, database)
    const restored = await recovery.restore(rootB)
    expect(restored.outcome).toBe('NO_SNAPSHOT')

    const snapshotA = await database.getTupiniquimSessionSnapshot(rootA)
    expect(snapshotA?.session.workspaceRoot).toBe(rootA)
    expect(snapshotA?.turns.map((turn) => turn.text)).toEqual(['conversa do workspace A', 'segunda do workspace A'])
    expect(snapshotA?.providerBindings).toEqual([{ provider: 'ollama', threadId: 'thread-a', model: modelA }])
    // Isolamento cross-workspace: B não herda turns/thread de A.
    expect(sessions.snapshot()?.turns).toEqual([])
    expect(sessions.threadFor('ollama')).toBeUndefined()
    expect(sessions.unseenPublicContext('ollama').turnIds).toEqual([])
    expect(await database.getTupiniquimSessionSnapshot(rootB)).toBeNull()
  })
})

const failSnapshot = (): TupiniquimDurableSnapshot => {
  throw new Error('Snapshot durável inesperadamente ausente.')
}

import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import {
  AwaitedShutdownCoordinator,
  TupiniquimSessionRecovery,
  TupiniquimSessionService,
  TupiniquimSessionSnapshotCoordinator
} from '@tupiniquim/core'

/**
 * Wave 16 — Incremento 4/4: shutdown aguardável + restart sobre o SQLite REAL
 * (worker real, WAL real, close real), no MESMO dataRoot.
 *
 * Este teste é REGRESSÃO DE INTEGRAÇÃO da semântica de persistência do
 * shutdown — dois ciclos de vida completos de serviço sobre o mesmo dataRoot
 * (fase 1 encerra com o sequenciador real; fase 2 reabre e recupera). Ele
 * COMPLEMENTA, não substitui, o E2E Electron de restart REAL
 * (tests/e2e/desktop.spec.ts), que permanece o gate autoritativo de processo
 * real na máquina Windows F:.
 *
 * Invariantes under test:
 * - a ordem real do shutdown: flush estável → drain → (retry dirty) → drain →
 *   providers → database, com database.close SOMENTE depois da persistência;
 * - o recovery da fase 2 devolve a MESMA session (id), turns, bindings e seen
 *   commitados pela fase 1 antes do close;
 * - flush FAILED com ROLLBACK REAL (failAfter test-only) deixa o root dirty;
 *   o shutdown converte com retry final e NADA parcial é persistido;
 * - lifecycle efêmero da fase 2 começa vazio (idempotência via seenByProvider).
 */

let dataRoot = ''
let workspaceRoot = ''
const leftovers: LocalDatabase[] = []

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-shutdown-restart-'))
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-workspace-'))
})

afterEach(async () => {
  // Depois de close() o worker SQLite é terminado: uma requisição posterior
  // nunca recebe resposta. O cleanup usa orçamento próprio por database para
  // nunca pendurar a suíte (bancos já encerrados pelo shutdown são no-op:
  // um banco vivo encerra em milissegundos, muito abaixo do orçamento).
  for (const database of leftovers.splice(0)) {
    await Promise.race([
      database.close().then(() => undefined, () => undefined),
      new Promise((resolve) => setTimeout(resolve, 250))
    ])
  }
  await rm(dataRoot, { recursive: true, force: true })
  await rm(workspaceRoot, { recursive: true, force: true })
})

const ollamaThread = (model: string) => ({
  id: 'thread-ollama-shutdown',
  provider: 'ollama' as const,
  workspaceRoot,
  model,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

/** Ciclo de vida completo "processo 1": serviços reais + sequenciador real. */
const runFirstLifecycle = async (input: {
  database: LocalDatabase
  messages: string[]
  failAfterSnapshotWriteStatements?: number
}): Promise<{ sessions: TupiniquimSessionService; persistence: TupiniquimSessionSnapshotCoordinator; report: Awaited<ReturnType<AwaitedShutdownCoordinator['begin']>> }> => {
  const sessions = new TupiniquimSessionService()
  sessions.open(workspaceRoot)
  const persistence = new TupiniquimSessionSnapshotCoordinator(sessions, input.database)
  await input.database.putAIThread(ollamaThread('qwen-local'))

  let turnIndex = 0
  for (const message of input.messages) {
    turnIndex += 1
    const turnId = `turn-shutdown-${String(turnIndex)}`
    await persistence.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama-shutdown', turnId, model: 'qwen-local' },
      message,
      persistedThread: ollamaThread('qwen-local'),
      pendingContextTurnIds: [],
      workspaceRoot
    })
    // Turno assistant terminal público do mesmo request (write-through).
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'qwen-local', threadId: 'thread-ollama-shutdown', turnId, text: `resposta pública ${String(turnIndex)}` })
    sessions.completeTurn('ollama', 'thread-ollama-shutdown', turnId, 'COMPLETED')
    persistence.schedule(workspaceRoot)
  }

  const shutdown = new AwaitedShutdownCoordinator({
    flushStableState: async () => {
      const root = sessions.current()?.workspaceRoot ?? null
      if (root === null) return { status: 'NO_ACTIVE_WORKSPACE' } as const
      return await persistence.flush(root)
    },
    drainQueue: async () => await persistence.drain(),
    dirtyWorkspaceRoots: () => [...persistence.dirtyWorkspaces().keys()],
    retryDirtyWorkspace: async (root) => await persistence.flush(root),
    closeProviders: () => Promise.resolve(),
    closeDatabase: async () => { await input.database.close() }
  })
  const report = await shutdown.begin()
  return { sessions, persistence, report }
}

describe('shutdown aguardável + restart no mesmo dataRoot (SQLite real)', () => {
  it('fase 1 encerra na ordem real e a fase 2 recupera a MESMA session com bindings/seen/turns', async () => {
    const first = new LocalDatabase(dataRoot)
    leftovers.push(first)
    const { report } = await runFirstLifecycle({ database: first, messages: ['primeira pergunta', 'segunda pergunta'] })

    // Shutdown limpo: estado estável commitado, fila drenada, DB fechado 1x.
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.stableStateFlush).toBe('COMMITTED')
    expect(report.persistenceSettled).toBe(true)
    expect(report.dirtyRootsRemaining).toBe(0)
    expect(report.databaseClosed).toBe(true)
    expect(report.providersClosed).toBe(true)
    expect(report.degraded).toBe(false)

    // O database da fase 1 foi fechado pelo sequenciador (report acima); a
    // prova real de que os dados chegaram ao disco ANTES do close é a fase 2
    // abaixo: um NOVO worker sobre o MESMO dataRoot recupera o snapshot.

    // Fase 2: NOVO ciclo de vida sobre o MESMO dataRoot (novo worker SQLite).
    const second = new LocalDatabase(dataRoot)
    leftovers.push(second)
    const sessions2 = new TupiniquimSessionService()
    const recovery = new TupiniquimSessionRecovery(sessions2, second, second)
    const restored = await recovery.restore(workspaceRoot)

    expect(restored.outcome).toBe('HYDRATED')
    expect(restored.session.workspaceRoot).toBe(workspaceRoot)
    expect(restored.restored.turns).toBe(4)
    expect(restored.restored.bindings).toBe(1)
    expect(restored.restored.seenProviders).toBe(1)

    // MESMA session S: o id sobreviveu ao close/reopen do dataRoot.
    const conversation = sessions2.snapshot()
    expect(conversation?.session.id).toBe(restored.session.id)
    expect(conversation?.turns.map((turn) => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(conversation?.providerThreads).toEqual([{ provider: 'ollama', threadId: 'thread-ollama-shutdown', model: 'qwen-local' }])

    // Seen restaurado: o provider da thread já viu os próprios turns — nada a
    // retransmitir incrementalmente para o Ollama pós-restart.
    expect(sessions2.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    // Outro provider ainda NÃO viu os turns públicos (contexto incremental).
    const unseenByCodex = sessions2.unseenPublicContext('codex-app-server')
    expect(unseenByCodex.turnIds).toHaveLength(4)

    // Lifecycle efêmero da fase 2 começa INTEIRAMENTE vazio.
    expect(sessions2.ephemeralLifecycle()).toEqual({
      authority: null,
      proposalIds: 0,
      inProgress: 0,
      pending: 0,
      settledSuccess: 0,
      settledFailure: 0,
      finalizedTurns: 0,
      unsuccessfulTurns: 0
    })
    expect(sessions2.proposalAuthority()).toBeNull()
    // A thread persistida mantém a provenance do model real.
    await expect(second.getAIThread('thread-ollama-shutdown')).resolves.toMatchObject({ provider: 'ollama', model: 'qwen-local', workspaceRoot })
  }, 30_000)

  it('flush FAILED com ROLLBACK REAL: root dirty, shutdown converge no retry final e nada parcial persiste', async () => {
    // failAfter é one-shot e test-only/interno: a PRIMEIRA transação de
    // snapshot falha no 5º statement (meio da transação) e faz ROLLBACK real.
    const first = new LocalDatabase(dataRoot, { failAfter: { snapshotWriteStatements: 5 } })
    leftovers.push(first)
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceRoot)
    const persistence = new TupiniquimSessionSnapshotCoordinator(sessions, first)
    await first.putAIThread(ollamaThread('qwen-local'))

    const commit = await persistence.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama-shutdown', turnId: 'turn-shutdown-1', model: 'qwen-local' },
      message: 'pergunta que falha na primeira persistência',
      persistedThread: ollamaThread('qwen-local'),
      pendingContextTurnIds: [],
      workspaceRoot
    })
    expect(commit.flush.status).toBe('FAILED')
    expect(persistence.isDirty(workspaceRoot)).toBe(true)

    // Shutdown real: o flush estável é o RETRY FINAL — a injeção é one-shot,
    // a nova transação commita integralmente e o dirty é limpo.
    const shutdown = new AwaitedShutdownCoordinator({
      flushStableState: async () => await persistence.flush(workspaceRoot),
      drainQueue: async () => await persistence.drain(),
      dirtyWorkspaceRoots: () => [...persistence.dirtyWorkspaces().keys()],
      retryDirtyWorkspace: async (root) => await persistence.flush(root),
      closeProviders: () => Promise.resolve(),
      closeDatabase: async () => { await first.close() }
    })
    const report = await shutdown.begin()
    expect(report.stableStateFlush).toBe('COMMITTED')
    expect(report.dirtyRootsRemaining).toBe(0)
    expect(report.degraded).toBe(false)
    expect(report.databaseClosed).toBe(true)

    // Fase 2: o snapshot recuperado é o COMPLETO (rollback real não deixou
    // nada parcial; o retry commitou o estado integral).
    const second = new LocalDatabase(dataRoot)
    leftovers.push(second)
    const sessions2 = new TupiniquimSessionService()
    const recovery = new TupiniquimSessionRecovery(sessions2, second, second)
    const restored = await recovery.restore(workspaceRoot)
    expect(restored.outcome).toBe('HYDRATED')
    expect(restored.restored.turns).toBe(1)
    expect(sessions2.snapshot()?.turns[0]?.text).toBe('pergunta que falha na primeira persistência')
    expect(sessions2.unseenPublicContext('ollama').turnIds).toEqual([])
  }, 30_000)

  it('drain vazio com fila parada: shutdown do dataRoot sem workload persiste SKIPPED e fecha deterministicamente', async () => {
    const first = new LocalDatabase(dataRoot)
    leftovers.push(first)
    const sessions = new TupiniquimSessionService()
    const persistence = new TupiniquimSessionSnapshotCoordinator(sessions, first)

    const shutdown = new AwaitedShutdownCoordinator({
      flushStableState: async () => {
        const root = sessions.current()?.workspaceRoot ?? null
        if (root === null) return { status: 'NO_ACTIVE_WORKSPACE' } as const
        return await persistence.flush(root)
      },
      drainQueue: async () => await persistence.drain(),
      dirtyWorkspaceRoots: () => [...persistence.dirtyWorkspaces().keys()],
      retryDirtyWorkspace: async (root) => await persistence.flush(root),
      closeProviders: () => Promise.resolve(),
      closeDatabase: async () => { await first.close() }
    })
    const report = await shutdown.begin()
    expect(report.stableStateFlush).toBe('NO_ACTIVE_WORKSPACE')
    expect(report.degraded).toBe(false)
    expect(report.databaseClosed).toBe(true)

    // Reentrada pós-READY_TO_EXIT: idempotente, nenhum novo close.
    const again = await shutdown.begin()
    expect(again).toBe(report)
  }, 30_000)
})

describe('isolamento A → B → A pós-restart (mesma semântica do switch durável)', () => {
  it('workspace B tem sessão própria; voltar a A recupera a sessão viva com bindings', async () => {
    const first = new LocalDatabase(dataRoot)
    leftovers.push(first)
    const { sessions } = await runFirstLifecycle({ database: first, messages: ['contexto exclusivo do workspace A'] })

    // A → B: o root que sai já foi persistido pelo shutdown da fase 1; B é
    // ativado com sessão nova limpa (sem bindings — nada de A vaza).
    const workspaceB = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-workspace-b-'))
    try {
      sessions.switchWorkspace(workspaceB)

      // B não herda NADA de A: sessão nova, sem turns, sem bindings, sem seen.
      const sessionB = sessions.snapshot()
      expect(sessionB?.session.id).not.toBe(sessions.durableSnapshotFor(workspaceRoot)?.session.id)
      expect(sessionB?.turns).toEqual([])
      expect(sessionB?.providerThreads).toEqual([])
      expect(sessions.unseenPublicContext('ollama').turnIds).toEqual([])
      expect(JSON.stringify(sessionB)).not.toContain('contexto exclusivo do workspace A')

      // B → A: o estado vivo de A permanece íntegro no mesmo processo.
      sessions.switchWorkspace(workspaceRoot)
      const backToA = sessions.snapshot()
      expect(backToA?.turns.map((turn) => turn.role)).toEqual(['user', 'assistant'])
      expect(backToA?.providerThreads).toEqual([{ provider: 'ollama', threadId: 'thread-ollama-shutdown', model: 'qwen-local' }])
      expect(backToA?.turns.some((turn) => turn.text.includes('contexto exclusivo do workspace A'))).toBe(true)
    } finally {
      await rm(workspaceB, { recursive: true, force: true })
    }
  }, 30_000)
})

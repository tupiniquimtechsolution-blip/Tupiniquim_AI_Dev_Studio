import { describe, expect, it } from 'vitest'
import type { AIThread, TupiniquimDurableSnapshot } from '@tupiniquim/contracts'
import { TupiniquimSessionService } from './tupiniquim-session'
import { TupiniquimSessionSnapshotCoordinator, type TupiniquimSnapshotFlushOutcome, type TupiniquimSessionSnapshotStore } from './tupiniquim-session-persistence'

/**
 * Wave 16 — Incremento 3/4: coordinator de write-through (seção crítica).
 *
 * Invariantes under test:
 * - commits serializados FIFO: nunca reordenam;
 * - TODO commit usa a operação única com thread model (MODEL PROVENANCE REAL);
 * - commitSendTurn resolve o model EFETIVO (reference.model > AIThread > binding)
 *   e registra a troca A → B quando a AIThread persistida diverge;
 * - falha de flush NÃO declara durabilidade: root dirty + onFlushError +
 *   próxima mutação estável reintenta e limpa o dirty;
 * - flush de root sem sessão é SKIPPED;
 * - capture por workspace mesmo com outro workspace ativo.
 */

const workspaceA = 'F:\\CODEX\\workspace-a'
const workspaceB = 'F:\\CODEX\\workspace-b'
const now = new Date().toISOString()

interface RecordedCommit {
  workspaceRoot: string
  snapshot: TupiniquimDurableSnapshot
  withThreadModel: boolean
}

const createStore = (input: {
  failures?: number
  slowMs?: number
} = {}): {
  store: TupiniquimSessionSnapshotStore
  commits: RecordedCommit[]
  outcomes: TupiniquimSnapshotFlushOutcome[]
} => {
  const commits: RecordedCommit[] = []
  const outcomes: TupiniquimSnapshotFlushOutcome[] = []
  let failures = input.failures ?? 0
  const store: TupiniquimSessionSnapshotStore = {
    putTupiniquimSessionSnapshot: async (snapshot) => {
      if (input.slowMs !== undefined) await new Promise((resolve) => setTimeout(resolve, input.slowMs))
      if (failures > 0) {
        failures -= 1
        throw new Error('Falha simulada da boundary durável.')
      }
      commits.push({ workspaceRoot: snapshot.session.workspaceRoot, snapshot, withThreadModel: false })
    },
    putTupiniquimSessionSnapshotWithThreadModel: async (snapshot) => {
      if (input.slowMs !== undefined) await new Promise((resolve) => setTimeout(resolve, input.slowMs))
      if (failures > 0) {
        failures -= 1
        throw new Error('Falha simulada da boundary durável.')
      }
      commits.push({ workspaceRoot: snapshot.session.workspaceRoot, snapshot, withThreadModel: true })
    }
  }
  return { store, commits, outcomes }
}

const threadFor = (model: string): AIThread => ({
  id: 'thread-ollama',
  provider: 'ollama',
  workspaceRoot: workspaceA,
  model,
  createdAt: now,
  updatedAt: now
})

describe('TupiniquimSessionSnapshotCoordinator — write-through e provenance real', () => {
  it('serializa os commits em FIFO: nunca reordena, mesmo com store lento', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const { store, commits } = createStore({ slowMs: 15 })
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    sessions.appendTurn({ role: 'user', text: 'primeira', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    const first = coordinator.flush(workspaceA)
    sessions.appendTurn({ role: 'user', text: 'segunda', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    const second = coordinator.flush(workspaceA)
    sessions.appendTurn({ role: 'user', text: 'terceira', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3' })
    const third = coordinator.flush(workspaceA)

    expect((await first).status).toBe('COMMITTED')
    expect((await second).status).toBe('COMMITTED')
    expect((await third).status).toBe('COMMITTED')
    expect(commits.map((commit) => commit.snapshot.turns.length)).toEqual([1, 2, 3])
    expect(commits.every((commit) => commit.withThreadModel)).toBe(true)
    expect(commits.at(-1)?.snapshot.turns.map((turn) => turn.turnId)).toEqual(['turn-1', 'turn-2', 'turn-3'])
  })

  it('commitSendTurn usa o model EFETIVO do request e registra a troca A → B', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const { store, commits } = createStore()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    // Send 1: model efetivo A igual ao da AIThread persistida — sem troca.
    const first = await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-1', model: 'modelo-a' },
      message: 'primeira pergunta',
      persistedThread: threadFor('modelo-a'),
      pendingContextTurnIds: [],
      workspaceRoot: workspaceA
    })
    expect(first.model).toBe('modelo-a')
    expect(first.threadModelSwapped).toBe(false)
    expect(first.flush.status).toBe('COMMITTED')

    // Send 2: usuário selecionou B; o request real usou B; a AIThread ainda
    // diz A — troca real, commitada atomicamente pelo coordinator.
    const second = await coordinator.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-2', model: 'modelo-b' },
      message: 'segunda pergunta',
      persistedThread: threadFor('modelo-a'),
      pendingContextTurnIds: [],
      workspaceRoot: workspaceA
    })
    expect(second.model).toBe('modelo-b')
    expect(second.threadModelSwapped).toBe(true)
    expect(second.flush.status).toBe('COMMITTED')

    // O snapshot commitado tem o binding corrente B, o novo turn B e os turns
    // antigos preservando o model real A (nunca falsificados).
    const committed = commits.at(-1)?.snapshot
    expect(committed?.providerBindings).toEqual([{ provider: 'ollama', threadId: 'thread-ollama', model: 'modelo-b' }])
    expect(committed?.turns.map((turn) => [turn.turnId, turn.model])).toEqual([
      ['turn-1', 'modelo-a'],
      ['turn-2', 'modelo-b']
    ])
  })

  it('commitSendTurn sem model na referência mantém o fallback AIThread → binding', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    const { store } = createStore()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    const commit = await coordinator.commitSendTurn({
      provider: 'codex-app-server',
      reference: { threadId: 'thread-codex', turnId: 'turn-1' },
      message: 'pergunta codex',
      persistedThread: { id: 'thread-codex', provider: 'codex-app-server', workspaceRoot: workspaceA, model: 'codex-test-model', createdAt: now, updatedAt: now },
      pendingContextTurnIds: [],
      workspaceRoot: workspaceA
    })
    expect(commit.model).toBe('codex-test-model')
    expect(commit.threadModelSwapped).toBe(false)
    expect(sessions.modelFor('codex-app-server')).toBe('codex-test-model')

    const withoutThread = await coordinator.commitSendTurn({
      provider: 'codex-app-server',
      reference: { threadId: 'thread-codex', turnId: 'turn-2' },
      message: 'segunda codex',
      persistedThread: null,
      pendingContextTurnIds: [],
      workspaceRoot: workspaceA
    })
    expect(withoutThread.model).toBe('codex-test-model')
  })

  it('falha de flush não declara durabilidade: dirty + onFlushError + retry converge', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const { store, commits } = createStore({ failures: 1 })
    const errors: TupiniquimSnapshotFlushOutcome[] = []
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store, {
      onFlushError: (outcome) => { errors.push(outcome) }
    })

    sessions.appendTurn({ role: 'user', text: 'primeira', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    const failed = await coordinator.flush(workspaceA)
    expect(failed.status).toBe('FAILED')
    expect(failed.error).toContain('Falha simulada')
    expect(coordinator.isDirty(workspaceA)).toBe(true)
    expect(coordinator.dirtyWorkspaces().get(workspaceA)).toContain('Falha simulada')
    expect(errors).toHaveLength(1)
    expect(errors[0]?.status).toBe('FAILED')
    expect(commits).toHaveLength(0)

    // A próxima mutação estável reintenta o commit e limpa o dirty.
    sessions.appendTurn({ role: 'user', text: 'segunda', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    const retried = await coordinator.flush(workspaceA)
    expect(retried.status).toBe('COMMITTED')
    expect(coordinator.isDirty(workspaceA)).toBe(false)
    expect(commits.at(-1)?.snapshot.turns.map((turn) => turn.turnId)).toEqual(['turn-1', 'turn-2'])
  })

  it('flush de workspace sem sessão é SKIPPED e não toca a boundary', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    const { store, commits } = createStore()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)
    const outcome = await coordinator.flush('F:\\CODEX\\workspace-desconhecido')
    expect(outcome.status).toBe('SKIPPED')
    expect(commits).toHaveLength(0)
  })

  it('capture do root que sai na troca de workspace preserva o snapshot daquele workspace', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    sessions.appendTurn({ role: 'user', text: 'conversa A', provider: 'ollama', model: 'modelo-a', threadId: 'thread-a', turnId: 'turn-1' })
    sessions.open(workspaceB)
    sessions.bindProviderThread('codex-app-server', 'thread-b', 'codex-test-model')
    const { store, commits } = createStore()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    const outgoing = await coordinator.flush(workspaceA)
    expect(outgoing.status).toBe('COMMITTED')
    expect(outgoing.turns).toBe(1)
    expect(commits[0]?.workspaceRoot).toBe(workspaceA)
    expect(commits[0]?.snapshot.turns.map((turn) => turn.text)).toEqual(['conversa A'])
    expect(commits[0]?.snapshot.providerBindings).toEqual([{ provider: 'ollama', threadId: 'thread-a', model: 'modelo-a' }])
  })
})

describe('TupiniquimSessionSnapshotCoordinator — drain aguardável do shutdown (Incremento 4/4)', () => {
  it('drain com flush artificialmente lento: espera TODA a fila enfileirada antes da chamada, preservando FIFO', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const { store, commits } = createStore({ slowMs: 40 })
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    for (const index of [1, 2, 3]) {
      sessions.appendTurn({ role: 'user', text: `mensagem ${String(index)}`, provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: `turn-${String(index)}` })
      coordinator.schedule(workspaceA)
    }
    // Enquanto o flush lento está em andamento o drain ainda NÃO resolveu.
    const drained = coordinator.drain()
    let resolved = false
    void drained.then(() => { resolved = true })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(resolved).toBe(false)
    expect(commits.length).toBeLessThan(3)

    const result = await drained
    expect(result.dirtyWorkspaces).toEqual([])
    // A fila inteira (3 write-throughs agendados) foi esperada, em ordem FIFO.
    expect(commits).toHaveLength(3)
    expect(commits.map((commit) => commit.snapshot.turns.length)).toEqual([1, 2, 3])
  })

  it('drain espera somente o que foi enfileirado ANTES da chamada — flush posterior segue na FIFO normal', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const slow = createStore({ slowMs: 60 })
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, slow.store)
    sessions.appendTurn({ role: 'user', text: 'antes do drain', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    coordinator.schedule(workspaceA)
    const drained = coordinator.drain()
    // Enfileirado DEPOIS do início do drain: não é esperado por este drain.
    sessions.appendTurn({ role: 'user', text: 'depois do drain', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    const late = coordinator.flush(workspaceA)

    await drained
    expect(slow.commits).toHaveLength(1)
    expect(await late).toMatchObject({ status: 'COMMITTED' })
    expect(slow.commits).toHaveLength(2)
    expect(slow.commits.map((commit) => commit.snapshot.turns.length)).toEqual([1, 2])
  })

  it('drain vazio resolve imediatamente e drain repetido não duplica trabalho', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    const { store, commits } = createStore()
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)

    const first = await coordinator.drain()
    const second = await coordinator.drain()
    const third = await coordinator.drain()
    expect(first.dirtyWorkspaces).toEqual([])
    expect(second.dirtyWorkspaces).toEqual([])
    expect(third.dirtyWorkspaces).toEqual([])
    // Nenhum trabalho foi criado pelo drain: a fila continua vazia.
    expect(commits).toHaveLength(0)

    // Drain repetido depois de commits concluídos também não duplica nada.
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    sessions.appendTurn({ role: 'user', text: 'única', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    await expect(coordinator.flush(workspaceA)).resolves.toMatchObject({ status: 'COMMITTED' })
    await coordinator.drain()
    await coordinator.drain()
    expect(commits).toHaveLength(1)
  })

  it('drain tolera item FAILED: a fila não quebra e o root permanece dirty no resultado', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const { store, commits } = createStore({ failures: 2 })
    const errors: TupiniquimSnapshotFlushOutcome[] = []
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store, {
      onFlushError: (outcome) => { errors.push(outcome) }
    })

    sessions.appendTurn({ role: 'user', text: 'falha no meio da fila', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    coordinator.schedule(workspaceA)
    sessions.appendTurn({ role: 'user', text: 'depois da falha', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    coordinator.schedule(workspaceA)

    const drained = await coordinator.drain()
    // O item FAILED não quebra a fila: o SEGUNDO flush também foi processado
    // (falhou de novo, mas a fila seguiu) e nada parcial foi persistido.
    expect(commits).toHaveLength(0)
    expect(errors).toHaveLength(2)
    expect(drained.dirtyWorkspaces).toEqual([workspaceA])
    expect(coordinator.isDirty(workspaceA)).toBe(true)

    // A fila continua viva: um retry posterior converge e limpa o dirty.
    sessions.appendTurn({ role: 'user', text: 'retry', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3' })
    await expect(coordinator.flush(workspaceA)).resolves.toMatchObject({ status: 'COMMITTED' })
    expect(await coordinator.drain()).toMatchObject({ dirtyWorkspaces: [] })
    expect(coordinator.isDirty(workspaceA)).toBe(false)
  })

  it('drain não fecha a boundary durável nem agenda persistência própria', async () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    const closed: string[] = []
    const { store, commits } = createStore()
    const storeWithClose = {
      ...store,
      close: () => { closed.push('closed'); return Promise.resolve() }
    } as typeof store & { close: () => Promise<void> }
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, storeWithClose)

    await coordinator.drain()
    await coordinator.drain()
    expect(commits).toHaveLength(0)
    expect(closed).toHaveLength(0)
  })
})


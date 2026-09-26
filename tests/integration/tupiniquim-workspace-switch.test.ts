import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase, WorkspaceAdapter } from '@tupiniquim/adapters'
import type { TupiniquimDurableSnapshot } from '@tupiniquim/contracts'
import { TupiniquimSessionRecovery, TupiniquimSessionService, TupiniquimSessionSnapshotCoordinator, switchTupiniquimWorkspaceWithDurableFlush, type TupiniquimSessionSnapshotStore } from '@tupiniquim/core'

/**
 * Wave 16 — Correções da auditoria do Incremento 3/4:
 *
 * 1. TOCTOU do workspace switch: a sequência canônica
 *    (switchTupiniquimWorkspaceWithDurableFlush — a MESMA usada pelo processo
 *    main) faz o flush do root que sai ANTES de trocar o WorkspaceAdapter.
 *    Durante um flush artificialmente lento (SQLite real atrás do delay),
 *    nenhuma operação de workspace observa o root novo e o configure não foi
 *    chamado — nunca existe janela "Workspace B + Session A".
 *
 * 2. Sessão nova vazia persistida imediatamente (NO_SNAPSHOT/REJECTED): o
 *    session.id estabiliza através de close/reopen com turns=[], bindings=[],
 *    seen vazio; snapshot inválido antigo (REJECTED) é substituído pela
 *    sessão nova limpa no mesmo commit.
 */

const isWindows = process.platform === 'win32'
const now = new Date().toISOString()

let fixture = ''
const databases: LocalDatabase[] = []

const rawDatabasePath = (): string => path.join(fixture, 'database', 'studio.sqlite')
const raw = (): DatabaseSync => new DatabaseSync(rawDatabasePath())

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

const workspaceRootFor = (name: string): string => {
  const root = path.join(fixture, name)
  mkdirSync(root, { recursive: true })
  return root
}

/**
 * Store com atraso artificial delegando ao SQLite REAL: o commit do flush é
 * lento, mas verdadeiro. Registra a ordem dos eventos na MESMA timeline do
 * configure para provar que o configure só acontece DEPOIS do flush do root
 * que sai.
 */
class DelayedSnapshotStore implements TupiniquimSessionSnapshotStore {
  public constructor(
    private readonly inner: LocalDatabase,
    private readonly delayMs: number,
    private readonly timeline: string[]
  ) {}

  public async putTupiniquimSessionSnapshot(snapshot: TupiniquimDurableSnapshot): Promise<void> {
    await this.delay()
    await this.inner.putTupiniquimSessionSnapshot(snapshot)
  }

  public async putTupiniquimSessionSnapshotWithThreadModel(snapshot: TupiniquimDurableSnapshot): Promise<void> {
    this.timeline.push('flush-start')
    await this.delay()
    try {
      await this.inner.putTupiniquimSessionSnapshotWithThreadModel(snapshot)
      this.timeline.push('flush-end')
    } catch (cause) {
      this.timeline.push('flush-error')
      throw cause
    }
  }

  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))
  }
}

const until = async (predicate: () => boolean): Promise<void> => {
  while (!predicate()) await new Promise((resolve) => setTimeout(resolve, 5))
}

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-workspace-switch-'))
})

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close()
  if (fixture !== '') await rm(fixture, { recursive: true, force: true })
})

describe('Wave 16 — correções da auditoria do inc3/4: troca de workspace durável', () => {
  it('TOCTOU: flush lento do root que sai ANTES do configure — nenhuma operação de workspace observa o root novo no intervalo', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const rootB = workspaceRootFor('workspace-b')
    writeFileSync(path.join(rootB, 'marcador-do-b.txt'), 'conteúdo exclusivo do workspace B', 'utf-8')

    const database = openDatabase()
    const sessions = new TupiniquimSessionService()
    sessions.open(rootA)
    const sessionA = sessions.snapshot()?.session.id ?? ''
    expect(sessionA).not.toBe('')

    const timeline: string[] = []
    const store = new DelayedSnapshotStore(database, 150, timeline)
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, store)
    const recovery = new TupiniquimSessionRecovery(sessions, database, database)
    const workspace = new WorkspaceAdapter()
    const configuredRootA = await workspace.configure(rootA)
    expect(configuredRootA).toBe(rootA)

    const switching = switchTupiniquimWorkspaceWithDurableFlush({
      sessions,
      coordinator,
      recovery,
      configure: async (target) => {
        timeline.push('configure-start')
        const configured = await workspace.configure(target)
        timeline.push('configure-end')
        return configured
      },
      root: rootB
    })

    // Entra na janela do flush lento do root A (commit real em atraso).
    await until(() => timeline.includes('flush-start'))
    expect(timeline).not.toContain('flush-end')

    // NA JANELA: o WorkspaceAdapter continua no root A, coerente com a
    // sessão Tupiniquim ativa (A). O configure do root B NÃO foi chamado.
    expect(timeline).toEqual(['flush-start'])
    expect(workspace.getRoot()).toBe(rootA)
    expect(sessions.current()?.workspaceRoot).toBe(rootA)
    // Operações de workspace executadas no intervalo observam A, nunca B:
    // o marcador exclusivo de B não é visível pela árvore do adapter.
    const entries = await workspace.list('', 2)
    expect(entries.every((entry) => !entry.relativePath.includes('marcador-do-b'))).toBe(true)
    expect(JSON.stringify(entries)).not.toContain('marcador-do-b')
    const context = await workspace.context()
    expect(JSON.stringify(context)).not.toContain('marcador-do-b')

    // Completa a troca: flush(A) commita ANTES do configure(B) e do recovery(B).
    const result = await switching
    expect(result.configured).toBe(rootB)
    expect(result.recovery.outcome).toBe('NO_SNAPSHOT')
    // Timeline unificada — a prova da ordem canônica: o flush do root que sai
    // (A) start+end ANTES do configure do root B; o flush da sessão nova do B
    // só acontece DEPOIS do configure-end.
    expect(timeline).toEqual(['flush-start', 'flush-end', 'configure-start', 'configure-end', 'flush-start', 'flush-end'])

    // Pós-troca: adapter e sessão ativa coerentes no root B (sessão nova limpa).
    expect(workspace.getRoot()).toBe(rootB)
    expect(sessions.current()?.workspaceRoot).toBe(rootB)
    // O flush lento commitou o snapshot do root A com o MESMO session.id vivo.
    const snapshotA = await database.getTupiniquimSessionSnapshot(rootA)
    expect(snapshotA?.session.id).toBe(sessionA)
    // Sessão nova do B também foi persistida imediatamente (NO_SNAPSHOT).
    const snapshotB = await database.getTupiniquimSessionSnapshot(rootB)
    expect(snapshotB?.session.id).toBe(sessions.snapshot()?.session.id)
    await closeDatabase(database)
  })

  it('sessão nova vazia é persistida imediatamente: close/reopen devolve o MESMO session.id com turns/bindings/seen vazios', async () => {
    const rootB = workspaceRootFor('workspace-b-vazio')
    const database = openDatabase()
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceRootFor('workspace-a-inicial'))
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, database)
    const recovery = new TupiniquimSessionRecovery(sessions, database, database)

    const first = await switchTupiniquimWorkspaceWithDurableFlush({
      sessions,
      coordinator,
      recovery,
      configure: () => Promise.resolve(rootB),
      root: rootB
    })
    expect(first.recovery.outcome).toBe('NO_SNAPSHOT')
    const sessionId = sessions.snapshot()?.session.id ?? ''
    expect(sessionId).not.toBe('')
    expect(coordinator.isDirty(rootB)).toBe(false)

    // O snapshot vazio já está no SQLite real.
    const stored = await database.getTupiniquimSessionSnapshot(rootB)
    expect(stored).toMatchObject({ session: { id: sessionId } })
    expect(stored?.turns).toEqual([])
    expect(stored?.providerBindings).toEqual([])
    expect(stored?.seenByProvider).toEqual({})

    // Restart real: fecha o worker e o arquivo, reabre sobre o MESMO dataRoot.
    await closeDatabase(database)
    const reopened = openDatabase()
    const sessionsFinal = new TupiniquimSessionService()
    const recoveryFinal = new TupiniquimSessionRecovery(sessionsFinal, reopened, reopened)
    const result = await recoveryFinal.restore(rootB)
    expect(result.outcome).toBe('HYDRATED')
    expect(result.reasons).toEqual([])
    // MESMO session.id — a sessão vazia sobreviveu ao close/reopen.
    expect(sessionsFinal.snapshot()?.session.id).toBe(sessionId)
    expect(sessionsFinal.durableSnapshotFor(rootB)?.turns).toEqual([])
    expect(sessionsFinal.durableSnapshotFor(rootB)?.providerBindings).toEqual([])
    expect(sessionsFinal.durableSnapshotFor(rootB)?.seenByProvider).toEqual({})
    await closeDatabase(reopened)
  })

  it('snapshot inválido antigo (REJECTED) é substituído pela sessão nova limpa quando o flush funciona', async () => {
    const rootB = workspaceRootFor('workspace-b-rejeitado')
    const writer = openDatabase()

    // Snapshot antigo válido S_old com 1 par de turns, depois corrompido de
    // verdade no SQLite (turn apontando para thread sem binding compatível —
    // a mesma corrupção relacional do teste de recovery).
    const oldSessionId = randomUUID()
    const oldTurn: TupiniquimDurableSnapshot['turns'][number] = {
      id: randomUUID(),
      sessionId: oldSessionId,
      role: 'user',
      text: 'turno antigo',
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-antiga',
      turnId: 'turno-antigo',
      createdAt: now
    }
    const oldSnapshot: TupiniquimDurableSnapshot = {
      session: { id: oldSessionId, workspaceRoot: rootB, createdAt: now, updatedAt: now },
      turns: [oldTurn],
      providerBindings: [{ provider: 'ollama', threadId: 'thread-antiga', model: 'modelo-a' }],
      seenByProvider: { ollama: [oldTurn.id] }
    }
    await writer.putTupiniquimSessionSnapshot(oldSnapshot)
    const connection = raw()
    try {
      connection.prepare('UPDATE tupiniquim_turns SET payload = ? WHERE session_id = ?')
        .run(JSON.stringify({ ...oldTurn, threadId: 'thread-estranha' }), oldSessionId)
    } finally {
      connection.close()
    }
    await closeDatabase(writer)
    // Sanidade: o snapshot corrompido é REJEITADO pela leitura fail-closed.
    const sanity = openDatabase()
    expect((await sanity.readTupiniquimSessionSnapshot(rootB)).status).toBe('INVALID')
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceRootFor('workspace-a-rejeitado'))
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, sanity)
    const recovery = new TupiniquimSessionRecovery(sessions, sanity, sanity)

    const result = await switchTupiniquimWorkspaceWithDurableFlush({
      sessions,
      coordinator,
      recovery,
      configure: () => Promise.resolve(rootB),
      root: rootB
    })
    expect(result.recovery.outcome).toBe('REJECTED')
    expect(result.recovery.reasons).toEqual(['SNAPSHOT_INVALID'])
    const sessionId = sessions.snapshot()?.session.id ?? ''
    expect(sessionId).not.toBe('')
    expect(coordinator.isDirty(rootB)).toBe(false)

    // O snapshot inválido antigo foi SUBSTITUÍDO pela sessão nova limpa.
    const stored = await sanity.getTupiniquimSessionSnapshot(rootB)
    expect(stored).toMatchObject({ session: { id: sessionId } })
    expect(stored?.turns).toEqual([])
    expect(stored?.providerBindings).toEqual([])
    expect(stored?.seenByProvider).toEqual({})
    const verify = raw()
    try {
      // Exatamente UMA linha de sessão para o workspace B (a nova, limpa) e
      // ZERO turns/bindings/seen sobreviventes do snapshot inválido antigo.
      const sessionsRows = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_sessions WHERE workspace_root = ?').get(rootB) as { total: number }
      expect(sessionsRows.total).toBe(1)
      const oldTurns = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns WHERE session_id = ?').get(oldSessionId) as { total: number }
      expect(oldTurns.total).toBe(0)
      const oldBindings = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_bindings WHERE session_id = ?').get(oldSessionId) as { total: number }
      expect(oldBindings.total).toBe(0)
      const oldSeen = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_seen WHERE session_id = ?').get(oldSessionId) as { total: number }
      expect(oldSeen.total).toBe(0)
    } finally {
      verify.close()
    }

    // Restart real: HYDRATED com o MESMO session.id da sessão nova limpa.
    await closeDatabase(sanity)
    const reopened = openDatabase()
    const sessionsFinal = new TupiniquimSessionService()
    const recoveryFinal = new TupiniquimSessionRecovery(sessionsFinal, reopened, reopened)
    const hydrated = await recoveryFinal.restore(rootB)
    expect(hydrated.outcome).toBe('HYDRATED')
    expect(sessionsFinal.snapshot()?.session.id).toBe(sessionId)
    await closeDatabase(reopened)
  })

  it('flush da sessão nova que falha NÃO finge durabilidade: root dirty, snapshot ausente, falha reportada', async () => {
    const rootA = workspaceRootFor('workspace-a-falha')
    const rootB = workspaceRootFor('workspace-b-falha')
    // Contagem de statements do snapshot transacional (one-shot): o flush do
    // root A (sessão vazia: 4 DELETEs + 1 INSERT = 5 statements) commita; o
    // fault dispara no statement 6 — o primeiro do flush da sessão nova do B,
    // que falha com ROLLBACK real.
    const database = openDatabase({ failAfter: { snapshotWriteStatements: 6 } })
    const sessions = new TupiniquimSessionService()
    sessions.open(rootA)
    const failures: string[] = []
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, database, {
      onFlushError: (outcome) => failures.push(outcome.status + ':' + (outcome.error ?? ''))
    })
    const recovery = new TupiniquimSessionRecovery(sessions, database, database)

    const result = await switchTupiniquimWorkspaceWithDurableFlush({
      sessions,
      coordinator,
      recovery,
      configure: () => Promise.resolve(rootB),
      root: rootB
    })
    expect(result.recovery.outcome).toBe('NO_SNAPSHOT')

    // O flush do root que sai (A) commitou normalmente ANTES da falha.
    expect(await database.getTupiniquimSessionSnapshot(rootA)).not.toBeNull()
    // NÃO finge durabilidade: o root B ficou dirty com o último erro e o
    // snapshot do B não existe; a falha foi reportada pelo gancho de auditoria.
    expect(coordinator.isDirty(rootB)).toBe(true)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('FAILED:Falha injetada')
    expect(await database.getTupiniquimSessionSnapshot(rootB)).toBeNull()

    // A sessão em memória continua utilizável; a próxima mutação estável
    // reintenta o commit (fila sobrevive à falha) e converge. O turno público
    // referencia a thread vinculada com AIThread persistida (provenance real).
    await database.putAIThread({ id: 'thread-falha', provider: 'ollama', workspaceRoot: rootB, model: 'modelo-a', createdAt: now, updatedAt: now })
    sessions.bindProviderThread('ollama', 'thread-falha', 'modelo-a')
    sessions.appendTurn({ role: 'user', text: 'turno público', provider: 'ollama', model: 'modelo-a', threadId: 'thread-falha', turnId: 'turno-1' })
    const retried = await coordinator.flush(rootB)
    expect(retried.status).toBe('COMMITTED')
    expect(coordinator.isDirty(rootB)).toBe(false)
    const stored = await database.getTupiniquimSessionSnapshot(rootB)
    expect(stored?.turns.map((turn) => turn.text)).toEqual(['turno público'])
    await closeDatabase(database)
  })
})

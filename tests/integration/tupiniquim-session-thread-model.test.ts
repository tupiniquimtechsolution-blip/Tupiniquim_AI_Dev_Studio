import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import type { AIThread, TupiniquimDurableSnapshot, TupiniquimSession } from '@tupiniquim/contracts'

/**
 * Wave 16 — Incremento 3/4 (MODEL PROVENANCE REAL): contrato da operação
 * SQLite única putTupiniquimSessionSnapshotWithThreadModel no worker real.
 *
 * - ai_threads.model assume o model corrente do binding NA MESMA transação
 *   do snapshot (session + turns + bindings + seen);
 * - models já coerentes não geram UPDATE desnecessário;
 * - provenance divergente (thread ausente, outro provider, outro workspace)
 *   aborta a transação inteira com ZERO escrita;
 * - fault injection no meio da transação faz ROLLBACK real de TUDO (thread
 *   model + snapshot): nunca AIThread.model novo + snapshot antigo, nem o
 *   contrário.
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

const makeSession = (workspaceRoot: string): TupiniquimSession => ({ id: randomUUID(), workspaceRoot, createdAt: now, updatedAt: now })

const makeSnapshot = (workspaceRoot: string, input: { threadId: string; model: string; turnCount?: number } ): TupiniquimDurableSnapshot => {
  const session = makeSession(workspaceRoot)
  const turnCount = input.turnCount ?? 2
  const turns = Array.from({ length: turnCount }, (_, index) => ({
    id: randomUUID(),
    sessionId: session.id,
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    text: `turno público ${index}`,
    provider: 'ollama' as const,
    model: input.model,
    threadId: input.threadId,
    turnId: `turno-${index}`,
    createdAt: now
  }))
  return {
    session,
    turns,
    providerBindings: [{ provider: 'ollama', threadId: input.threadId, model: input.model }],
    seenByProvider: { ollama: turns.map((turn) => turn.id) }
  }
}

const putThread = async (database: LocalDatabase, input: { id: string; workspaceRoot: string; model: string | null; provider?: 'ollama' | 'codex-app-server' }): Promise<AIThread> => {
  const thread: AIThread = { id: input.id, provider: input.provider ?? 'ollama', workspaceRoot: input.workspaceRoot, model: input.model, createdAt: now, updatedAt: now }
  await database.putAIThread(thread)
  return thread
}

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-session-thread-model-'))
})

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close()
  if (fixture !== '') await rm(fixture, { recursive: true, force: true })
})

describe('putTupiniquimSessionSnapshotWithThreadModel — operação SQLite única', () => {
  it('commita snapshot + model corrente da AIThread na mesma transação', async () => {
    const database = openDatabase()
    const root = path.join(fixture, 'workspace-a')
    const threadId = 'thread-ollama-atomico'
    await putThread(database, { id: threadId, workspaceRoot: root, model: 'modelo-a' })

    // Snapshot com o binding já no model novo B: a AIThread ainda diz A.
    const snapshot = makeSnapshot(root, { threadId, model: 'modelo-b' })
    await database.putTupiniquimSessionSnapshotWithThreadModel(snapshot)

    const thread = await database.getAIThread(threadId)
    expect(thread).toMatchObject({ id: threadId, provider: 'ollama', model: 'modelo-b' })
    const stored = await database.getTupiniquimSessionSnapshot(root)
    expect(stored?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: 'modelo-b' }])
    expect(stored?.turns.map((turn) => turn.model)).toEqual(['modelo-b', 'modelo-b'])
    expect(stored?.session.id).toBe(snapshot.session.id)
  })

  it('não gera UPDATE de ai_threads quando os models já estão coerentes', async () => {
    const database = openDatabase()
    const root = path.join(fixture, 'workspace-b')
    const threadId = 'thread-ollama-coerente'
    const original = await putThread(database, { id: threadId, workspaceRoot: root, model: 'modelo-a' })

    const snapshot = makeSnapshot(root, { threadId, model: 'modelo-a' })
    await database.putTupiniquimSessionSnapshotWithThreadModel(snapshot)

    const thread = await database.getAIThread(threadId)
    expect(thread?.model).toBe('modelo-a')
    expect(thread?.updatedAt).toBe(original.updatedAt)

    const connection = raw()
    try {
      const row = connection.prepare('SELECT payload, updated_at FROM ai_threads WHERE id = ?').get(threadId) as { payload: string; updated_at: string }
      const payload = JSON.parse(row.payload) as { updatedAt: string }
      expect(payload.updatedAt).toBe(original.updatedAt)
      expect(row.updated_at).toBe(original.updatedAt)
    } finally {
      connection.close()
    }
  })

  it('aborta com ZERO escrita quando a AIThread do binding não existe, é de outro provider ou de outro workspace', async () => {
    const database = openDatabase()
    const root = path.join(fixture, 'workspace-c')
    await putThread(database, { id: 'thread-codex', workspaceRoot: root, model: 'codex-test-model', provider: 'codex-app-server' })
    await putThread(database, { id: 'thread-outro-ws', workspaceRoot: path.join(fixture, 'workspace-outro'), model: 'modelo-a' })

    const missing = makeSnapshot(root, { threadId: 'thread-inexistente', model: 'modelo-b' })
    await expect(database.putTupiniquimSessionSnapshotWithThreadModel(missing)).rejects.toThrow('não existe')
    const wrongProvider = makeSnapshot(root, { threadId: 'thread-codex', model: 'modelo-b' })
    await expect(database.putTupiniquimSessionSnapshotWithThreadModel(wrongProvider)).rejects.toThrow('outro provider')
    const wrongWorkspace = makeSnapshot(root, { threadId: 'thread-outro-ws', model: 'modelo-b' })
    await expect(database.putTupiniquimSessionSnapshotWithThreadModel(wrongWorkspace)).rejects.toThrow('outro workspace')

    // Zero escrita: nenhum snapshot foi commitado para o workspace.
    for (const workspace of [root, path.join(fixture, 'workspace-outro')]) {
      expect(await database.getTupiniquimSessionSnapshot(workspace)).toBeNull()
    }
    expect(await database.getAIThread('thread-codex')).toMatchObject({ model: 'codex-test-model' })
    expect(await database.getAIThread('thread-outro-ws')).toMatchObject({ model: 'modelo-a' })
  })

  it('aborta com ROLLBACK quando a AIThread do binding é JSON parseável mas fora do contrato completo (auditoria inc3/4)', async () => {
    const setup = openDatabase()
    const root = path.join(fixture, 'workspace-e')
    const threadId = 'thread-ollama-corrupto'
    await putThread(setup, { id: threadId, workspaceRoot: root, model: 'modelo-a' })
    // Estado anterior consistente S1.
    const s1 = makeSnapshot(root, { threadId, model: 'modelo-a', turnCount: 2 })
    await setup.putTupiniquimSessionSnapshotWithThreadModel(s1)
    await setup.close()
    databases.splice(databases.indexOf(setup), 1)

    const database = openDatabase()
    const variants: Array<{ name: string; payload: Record<string, unknown> }> = [
      { name: 'createdAt com calendário impossível', payload: { id: threadId, provider: 'ollama', workspaceRoot: root, model: 'modelo-a', createdAt: '2024-02-31T00:00:00Z', updatedAt: now } },
      { name: 'campo obrigatório ausente', payload: { id: threadId, provider: 'ollama', workspaceRoot: root, createdAt: now, updatedAt: now } },
      { name: 'datetime fora do formato ISO-8601 Z', payload: { id: threadId, provider: 'ollama', workspaceRoot: root, model: 'modelo-a', createdAt: now, updatedAt: 'ontem às dez' } },
      { name: 'model com tipo errado', payload: { id: threadId, provider: 'ollama', workspaceRoot: root, model: 42, createdAt: now, updatedAt: now } }
    ]
    for (const variant of variants) {
      const corruptPayload = JSON.stringify(variant.payload)
      const connection = raw()
      try {
        connection.prepare('UPDATE ai_threads SET payload = ? WHERE id = ?').run(corruptPayload, threadId)
      } finally {
        connection.close()
      }

      const s2 = makeSnapshot(root, { threadId, model: 'modelo-b', turnCount: 4 })
      await expect(database.putTupiniquimSessionSnapshotWithThreadModel(s2)).rejects.toThrow('contrato completo do aiThreadSchema')
      // ROLLBACK: o payload da AIThread corrupta permanece BYTE A BYTE
      // intacto (não é reescrito nem "consertado"), o snapshot S1 continua
      // íntegro e nenhuma linha parcial de S2 existe.
      const verify = raw()
      try {
        const thread = verify.prepare('SELECT payload FROM ai_threads WHERE id = ?').get(threadId) as { payload: string }
        expect(thread.payload).toBe(corruptPayload)
        const sessions = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_sessions').get() as { total: number }
        expect(sessions.total).toBe(1)
        const turns = verify.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns').get() as { total: number }
        expect(turns.total).toBe(2)
      } finally {
        verify.close()
      }
      const stored = await database.getTupiniquimSessionSnapshot(root)
      expect(stored?.session.id).toBe(s1.session.id)
      expect(stored?.turns.map((turn) => turn.model)).toEqual(['modelo-a', 'modelo-a'])
      expect(stored?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: 'modelo-a' }])

      // Restaura o payload válido para a próxima variante.
      const repair = raw()
      try {
        repair.prepare('UPDATE ai_threads SET payload = ? WHERE id = ?').run(JSON.stringify({ id: threadId, provider: 'ollama', workspaceRoot: root, model: 'modelo-a', createdAt: now, updatedAt: now }), threadId)
      } finally {
        repair.close()
      }
    }
  })

  it('fault injection no meio da transação faz ROLLBACK real de ai_threads.model E do snapshot', async () => {
    const setup = openDatabase()
    const root = path.join(fixture, 'workspace-d')
    const threadId = 'thread-ollama-fault'
    await putThread(setup, { id: threadId, workspaceRoot: root, model: 'modelo-a' })
    // Estado anterior consistente S1: binding A + snapshot com 1 par de turns.
    const before = makeSnapshot(root, { threadId, model: 'modelo-a', turnCount: 2 })
    await setup.putTupiniquimSessionSnapshotWithThreadModel(before)
    await setup.close()
    databases.splice(databases.indexOf(setup), 1)

    // A troca para B com falha injetada após o UPDATE de ai_threads (statement
    // 1) e o primeiro DELETE do snapshot (statement 2) — statement 3 falha.
    const faulted = openDatabase({ failAfter: { snapshotWriteStatements: 3 } })
    const swap = makeSnapshot(root, { threadId, model: 'modelo-b', turnCount: 4 })
    await expect(faulted.putTupiniquimSessionSnapshotWithThreadModel(swap)).rejects.toThrow('Falha injetada')

    // ROLLBACK completo: AIThread continua A e o snapshot anterior íntegro.
    expect(await faulted.getAIThread(threadId)).toMatchObject({ model: 'modelo-a' })
    const stored = await faulted.getTupiniquimSessionSnapshot(root)
    expect(stored?.providerBindings).toEqual([{ provider: 'ollama', threadId, model: 'modelo-a' }])
    expect(stored?.turns.map((turn) => turn.model)).toEqual(['modelo-a', 'modelo-a'])
    expect(stored?.session.id).toBe(before.session.id)

    const connection = raw()
    try {
      // Estado bruto coerente: nenhuma linha parcial da sessão nova.
      const sessions = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_sessions').get() as { total: number }
      expect(sessions.total).toBe(1)
      const turns = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns').get() as { total: number }
      expect(turns.total).toBe(2)
      const threads = connection.prepare('SELECT payload FROM ai_threads WHERE id = ?').get(threadId) as { payload: string }
      const payload = JSON.parse(threads.payload) as { model: string | null }
      expect(payload.model).toBe('modelo-a')
    } finally {
      connection.close()
    }
  })
})

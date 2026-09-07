import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import { maxDurableTupiniquimTurns, maxDurableTupiniquimTurnTextChars, type TupiniquimDurableSnapshot, type TupiniquimSession } from '@tupiniquim/contracts'

/**
 * Wave 16 — Incremento 1/4: snapshot durável da Tupiniquim Session no SQLite
 * real (worker real, v5, BEGIN IMMEDIATE/COMMIT/ROLLBACK reais).
 *
 * - snapshot atômico por workspace (S1 -> S2 sem órfãos);
 * - retenção de 200 turns com seen podado no mesmo commit;
 * - seen cross-workspace bloqueado por constraint estrutural;
 * - failAfter test-only/interno interrompendo a transação REAL;
 * - getTupiniquimSessionSnapshot fail-closed com validação relacional.
 */

const isWindows = process.platform === 'win32'

const now = new Date().toISOString()
let fixture = ''
const databases: LocalDatabase[] = []

const rawDatabasePath = (): string => path.join(fixture, 'database', 'studio.sqlite')

const raw = (): DatabaseSync => new DatabaseSync(rawDatabasePath())

const rawCount = (connection: DatabaseSync, table: string): number => {
  const row = connection.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }
  return row.total
}

const openDatabase = (options: { failAfter?: { snapshotWriteStatements?: number } } = {}): LocalDatabase => {
  const database = new LocalDatabase(fixture, options)
  databases.push(database)
  return database
}

const makeSession = (workspaceRoot: string): TupiniquimSession => ({
  id: randomUUID(),
  workspaceRoot,
  createdAt: now,
  updatedAt: now
})

const makeTurn = (
  session: TupiniquimSession,
  index: number,
  input: { role?: 'user' | 'assistant'; provider?: 'ollama' | 'codex-app-server'; createdAt?: string; text?: string } = {}
): TupiniquimDurableSnapshot['turns'][number] => {
  const provider = input.provider ?? 'ollama'
  return {
    id: randomUUID(),
    sessionId: session.id,
    role: input.role ?? 'user',
    text: input.text ?? `turno ${provider} ${index}`,
    provider,
    model: provider === 'ollama' ? 'qwen-local' : 'codex-test-model',
    threadId: provider === 'ollama' ? 'thread-ollama' : 'thread-codex',
    turnId: `turno-${provider}-${index}`,
    createdAt: input.createdAt ?? now
  }
}

const makeSnapshot = (
  workspaceRoot: string,
  input: {
    session?: TupiniquimSession
    turnCount?: number
    seenByProvider?: TupiniquimDurableSnapshot['seenByProvider']
  } = {}
): TupiniquimDurableSnapshot => {
  const session = input.session ?? makeSession(workspaceRoot)
  const turnCount = input.turnCount ?? 3
  const turns = Array.from({ length: turnCount }, (_, index) => makeTurn(session, index))
  const retained = new Set(turns.map((turn) => turn.id))
  const seenByProvider = input.seenByProvider ?? {
    ollama: [...turns].reverse().filter((turn) => retained.has(turn.id)).map((turn) => turn.id)
  }
  return {
    session,
    turns,
    providerBindings: [
      { provider: 'ollama', threadId: 'thread-ollama', model: 'qwen-local' },
      { provider: 'codex-app-server', threadId: 'thread-codex', model: 'codex-test-model' }
    ],
    seenByProvider
  }
}

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-session-snapshot-'))
})

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close()
  if (fixture !== '') await rm(fixture, { recursive: true, force: true })
})

describe('Tupiniquim session snapshot durável — SQLite v5 real', () => {
  it('migra o SQLite real para v5 e faz roundtrip atômico do snapshot (put/get)', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA, { turnCount: 5 })

    await database.putTupiniquimSessionSnapshot(snapshot)
    const stored = await database.getTupiniquimSessionSnapshot(rootA)

    expect(stored).not.toBeNull()
    expect(stored?.session).toEqual(snapshot.session)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(snapshot.turns.map((turn) => turn.id))
    expect(stored?.turns).toEqual(snapshot.turns)
    const storedBindings = [...(stored?.providerBindings ?? [])].sort((a, b) => a.provider.localeCompare(b.provider))
    const inputBindings = [...snapshot.providerBindings].sort((a, b) => a.provider.localeCompare(b.provider))
    expect(storedBindings).toEqual(inputBindings)
    expect([...(stored?.seenByProvider.ollama ?? [])].sort()).toEqual([...(snapshot.seenByProvider.ollama ?? [])].sort())

    const connection = raw()
    try {
      const version = connection.prepare('PRAGMA user_version').get() as { user_version: number }
      expect(version.user_version).toBe(5)
      expect(rawCount(connection, 'tupiniquim_sessions')).toBe(1)
      expect(rawCount(connection, 'tupiniquim_turns')).toBe(5)
      expect(rawCount(connection, 'tupiniquim_bindings')).toBe(2)
    } finally {
      connection.close()
    }

    // Reabertura real do "processo": nova instância/worker sobre o mesmo arquivo.
    const reopened = openDatabase()
    const afterReopen = await reopened.getTupiniquimSessionSnapshot(rootA)
    expect(afterReopen?.session.id).toBe(snapshot.session.id)
    expect(afterReopen?.turns).toEqual(snapshot.turns)
  })

  it('preserva a ordem original dos turns (posições consistentes) sem reordenar por createdAt', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const session = makeSession(rootA)
    const later = new Date(Date.now() + 60_000).toISOString()
    const earlier = new Date(Date.now() - 60_000).toISOString()
    const turns = [
      makeTurn(session, 1, { createdAt: later }),
      makeTurn(session, 2, { createdAt: earlier }),
      makeTurn(session, 3, { createdAt: later })
    ]
    const snapshot = makeSnapshot(rootA, {
      session,
      seenByProvider: { ollama: [turns[0]!.id] }
    })
    await database.putTupiniquimSessionSnapshot({ ...snapshot, turns })
    const stored = await database.getTupiniquimSessionSnapshot(rootA)

    expect(stored?.turns.map((turn) => turn.id)).toEqual(turns.map((turn) => turn.id))
    expect(stored?.turns.map((turn) => turn.createdAt)).toEqual([later, earlier, later])

    const connection = raw()
    try {
      const positions = connection.prepare('SELECT position FROM tupiniquim_turns WHERE session_id = ? ORDER BY position ASC').all(session.id) as Array<{ position: number }>
      expect(positions.map((row) => row.position)).toEqual([0, 1, 2])
    } finally {
      connection.close()
    }
  })

  it('migração v5 idempotente a partir de banco v4 preserva tabelas/turnos legados', async () => {
    const dbRoot = path.dirname(rawDatabasePath())
    mkdirSync(dbRoot, { recursive: true })
    const seed = new DatabaseSync(rawDatabasePath())
    seed.exec('PRAGMA user_version=4;')
    seed.exec('CREATE TABLE ai_threads (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);')
    seed.exec("INSERT INTO ai_threads(id,payload,updated_at) VALUES('thread-legada','{\"id\":\"thread-legada\"}','2026-01-01T00:00:00.000Z');")
    const before = seed.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(before.user_version).toBe(4)
    seed.close()

    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(snapshot)

    const connection = raw()
    try {
      const version = connection.prepare('PRAGMA user_version').get() as { user_version: number }
      expect(version.user_version).toBe(5)
      const legacy = connection.prepare('SELECT payload FROM ai_threads WHERE id = ?').get('thread-legada') as { payload: string }
      expect(legacy.payload).toContain('thread-legada')
      expect(rawCount(connection, 'tupiniquim_sessions')).toBe(1)
    } finally {
      connection.close()
    }

    // Reabrir de novo não reexecuta migração e mantém o snapshot legível.
    const reopened = openDatabase()
    expect((await reopened.getTupiniquimSessionSnapshot(rootA))?.session.id).toBe(snapshot.session.id)
  })

  it('aplica retenção de 200 turns e poda seen no mesmo snapshot transacional', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const session = makeSession(rootA)
    const total = maxDurableTupiniquimTurns + 20
    const turns = Array.from({ length: total }, (_, index) => makeTurn(session, index))
    const seenByProvider = {
      ollama: [turns[0]!.id, turns[99]!.id, turns[total - 1]!.id],
      'codex-app-server': [] as string[]
    }
    const snapshot = makeSnapshot(rootA, {
      session,
      seenByProvider
    })
    await database.putTupiniquimSessionSnapshot({ ...snapshot, turns })

    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored).not.toBeNull()
    // Somente os 200 mais recentes permanecem, com ids ORIGINAIS e ordem original.
    expect(stored?.turns).toHaveLength(maxDurableTupiniquimTurns)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(turns.slice(-maxDurableTupiniquimTurns).map((turn) => turn.id))
    expect(stored?.turns[0]?.text).toBe(turns[20]?.text)
    expect(stored?.turns.at(-1)?.text).toBe(turns[total - 1]?.text)
    // seen podado: somente ids ainda retidos; chave com lista vazia não persiste.
    expect(stored?.seenByProvider.ollama?.sort()).toEqual([turns[99]!.id, turns[total - 1]!.id].sort())
    expect(stored?.seenByProvider['codex-app-server']).toBeUndefined()

    const connection = raw()
    try {
      expect(rawCount(connection, 'tupiniquim_turns')).toBe(maxDurableTupiniquimTurns)
      const retainedIds = new Set(turns.slice(-maxDurableTupiniquimTurns).map((turn) => turn.id))
      const seenRows = connection.prepare('SELECT turn_id FROM tupiniquim_seen').all() as Array<{ turn_id: string }>
      expect(seenRows).toHaveLength(2)
      expect(seenRows.every((row) => retainedIds.has(row.turn_id))).toBe(true)
    } finally {
      connection.close()
    }
  })

  it('substitui S1 -> S2 no mesmo workspace sem turn/binding/seen órfãos de S1', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const s1Session = makeSession(rootA)
    const s1 = makeSnapshot(rootA, { session: s1Session, turnCount: 3 })
    await database.putTupiniquimSessionSnapshot(s1)

    const s2Session = makeSession(rootA)
    const s2Turns = Array.from({ length: 4 }, (_, index) => makeTurn(s2Session, index, { provider: index % 2 === 0 ? 'ollama' : 'codex-app-server' }))
    const s2 = makeSnapshot(rootA, {
      session: s2Session,
      turnCount: 0,
      seenByProvider: { ollama: [s2Turns[0]!.id] }
    })
    expect(s2Session.id).not.toBe(s1Session.id)
    await database.putTupiniquimSessionSnapshot({ ...s2, turns: s2Turns })

    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.session.id).toBe(s2Session.id)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(s2Turns.map((turn) => turn.id))
    expect(stored?.seenByProvider.ollama).toEqual([s2Turns[0]!.id])

    const connection = raw()
    try {
      expect(rawCount(connection, 'tupiniquim_sessions')).toBe(1)
      expect(rawCount(connection, 'tupiniquim_turns')).toBe(4)
      expect(rawCount(connection, 'tupiniquim_bindings')).toBe(2)
      expect(rawCount(connection, 'tupiniquim_seen')).toBe(1)
      // Nenhuma linha remanescente referencia S1 (sem órfãos de turns/bindings/seen).
      const orphans = connection.prepare(`
        SELECT
          (SELECT COUNT(*) FROM tupiniquim_turns WHERE session_id = ?) AS turns,
          (SELECT COUNT(*) FROM tupiniquim_bindings WHERE session_id = ?) AS bindings,
          (SELECT COUNT(*) FROM tupiniquim_seen WHERE session_id = ?) AS seen
      `).get(s1Session.id, s1Session.id, s1Session.id) as { turns: number; bindings: number; seen: number }
      expect(orphans).toEqual({ turns: 0, bindings: 0, seen: 0 })
      const sessions = connection.prepare('SELECT id, workspace_root FROM tupiniquim_sessions').all() as Array<{ id: string; workspace_root: string }>
      expect(sessions).toEqual([{ id: s2Session.id, workspace_root: rootA }])
    } finally {
      connection.close()
    }
  })

  it('impede seen cross-workspace por constraint estrutural do SQLite real', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const rootB = path.join(fixture, 'workspace-b')
    const s1 = makeSnapshot(rootA)
    const sB = makeSnapshot(rootB, { turnCount: 2 })
    await database.putTupiniquimSessionSnapshot(s1)
    await database.putTupiniquimSessionSnapshot(sB)

    const connection = raw()
    try {
      connection.exec('PRAGMA foreign_keys=ON;')
      // seen de A apontando para turn de B viola a FK composta (session_id, turn_id).
      expect(() => {
        connection.prepare(`
          INSERT INTO tupiniquim_seen (session_id, provider, turn_id)
          SELECT s.id, 'ollama', t.id
          FROM tupiniquim_sessions AS s, tupiniquim_turns AS t
          WHERE s.workspace_root = ? AND t.session_id = (SELECT id FROM tupiniquim_sessions WHERE workspace_root = ?)
        `).run(rootA, rootB)
      }).toThrow(/FOREIGN KEY/)
      // O caminho inverso (turn inexistente) também é bloqueado.
      expect(() => {
        connection.prepare("INSERT INTO tupiniquim_seen (session_id, provider, turn_id) SELECT id, 'ollama', ? FROM tupiniquim_sessions WHERE workspace_root = ?").run(randomUUID(), rootA)
      }).toThrow(/FOREIGN KEY/)
      // A própria linha legítima de seen continua íntegra.
      expect(rawCount(connection, 'tupiniquim_seen')).toBe((s1.seenByProvider.ollama?.length ?? 0) + (sB.seenByProvider.ollama?.length ?? 0))
    } finally {
      connection.close()
    }
  })

  it('put com seen cross-workspace é rejeitado antes da escrita e preserva o snapshot anterior', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const rootB = path.join(fixture, 'workspace-b')
    const s1 = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(s1)
    const sB = makeSnapshot(rootB, { turnCount: 2 })
    await database.putTupiniquimSessionSnapshot(sB)

    const invalid = makeSnapshot(rootA, {
      session: makeSession(rootA),
      seenByProvider: { ollama: [sB.turns[0]!.id] }
    })
    await expect(database.putTupiniquimSessionSnapshot(invalid)).rejects.toThrow(/fora do snapshot/)

    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.session.id).toBe(s1.session.id)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(s1.turns.map((turn) => turn.id))

    const connection = raw()
    try {
      const sessions = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_sessions').get() as { total: number }
      expect(sessions.total).toBe(2)
      const orphan = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns WHERE session_id = ?').get(invalid.session.id) as { total: number }
      expect(orphan.total).toBe(0)
    } finally {
      connection.close()
    }
  })

  it('failAfter test-only interrompe a transação REAL e o ROLLBACK preserva o último snapshot commitado', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const s1 = makeSnapshot(rootA, { turnCount: 3 })
    await database.putTupiniquimSessionSnapshot(s1)

    // Segundo worker real sobre o MESMO arquivo SQLite, com failAfter injetado
    // após 6 statements executados (4 DELETEs + session + 1º turn), antes do COMMIT.
    const failing = openDatabase({ failAfter: { snapshotWriteStatements: 6 } })
    const s2 = makeSnapshot(rootA, { turnCount: 3 })
    expect(s2.session.id).not.toBe(s1.session.id)
    await expect(failing.putTupiniquimSessionSnapshot(s2)).rejects.toThrow(/failAfter/)

    // O snapshot previamente commitado (S1) permanece íntegro; nada de S2 parcial.
    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.session.id).toBe(s1.session.id)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(s1.turns.map((turn) => turn.id))
    expect(stored?.turns[0]?.text).toBe(s1.turns[0]?.text)

    const connection = raw()
    try {
      const s2rows = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns WHERE session_id = ?').get(s2.session.id) as { total: number }
      expect(s2rows.total).toBe(0)
      expect(rawCount(connection, 'tupiniquim_turns')).toBe(3)
    } finally {
      connection.close()
    }

    // A falha é one-shot: a transação seguinte no MESMO worker é real e completa.
    await expect(failing.putTupiniquimSessionSnapshot(s2)).resolves.toBeUndefined()
    const replaced = await database.getTupiniquimSessionSnapshot(rootA)
    expect(replaced?.session.id).toBe(s2.session.id)
    expect(replaced?.turns.map((turn) => turn.id)).toEqual(s2.turns.map((turn) => turn.id))
  })

  it('falha na primeira transação não deixa linhas parciais e a conexão continua utilizável', async () => {
    const failing = openDatabase({ failAfter: { snapshotWriteStatements: 4 } })
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA, { turnCount: 3 })
    await expect(failing.putTupiniquimSessionSnapshot(snapshot)).rejects.toThrow(/failAfter/)

    expect(await failing.getTupiniquimSessionSnapshot(rootA)).toBeNull()
    const connection = raw()
    try {
      for (const table of ['tupiniquim_sessions', 'tupiniquim_turns', 'tupiniquim_bindings', 'tupiniquim_seen']) {
        expect(rawCount(connection, table)).toBe(0)
      }
      const version = connection.prepare('PRAGMA user_version').get() as { user_version: number }
      expect(version.user_version).toBe(5)
    } finally {
      connection.close()
    }

    await expect(failing.putTupiniquimSessionSnapshot(snapshot)).resolves.toBeUndefined()
    expect((await failing.getTupiniquimSessionSnapshot(rootA))?.session.id).toBe(snapshot.session.id)
  })

  it('get fail-closed: turn com sessionId divergente no payload é descartado', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(snapshot)
    expect((await database.getTupiniquimSessionSnapshot(rootA))?.session.id).toBe(snapshot.session.id)

    const connection = raw()
    try {
      const target = connection.prepare('SELECT payload FROM tupiniquim_turns WHERE session_id = ? LIMIT 1').get(snapshot.session.id) as { payload: string }
      const corrupted = { ...JSON.parse(target.payload) as { sessionId: string }, sessionId: randomUUID() }
      connection.prepare('UPDATE tupiniquim_turns SET payload = ? WHERE session_id = ?').run(JSON.stringify(corrupted), snapshot.session.id)
    } finally {
      connection.close()
    }

    // Snapshot inconsistente é descartado para esta abertura (fail-closed, sem estado parcial).
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()
  })

  it('get fail-closed: payload corrompido ou fora do limite durável é descartado', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(snapshot)

    const connection = raw()
    try {
      // JSON inválido na linha do turn.
      connection.prepare('UPDATE tupiniquim_turns SET payload = ? WHERE session_id = ?').run('{"id":', snapshot.session.id)
    } finally {
      connection.close()
    }
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()

    // Corrupção de texto acima do limite durável de 2.000 chars.
    await database.putTupiniquimSessionSnapshot(snapshot)
    const connection2 = raw()
    try {
      const target = connection2.prepare('SELECT payload FROM tupiniquim_turns WHERE session_id = ? LIMIT 1').get(snapshot.session.id) as { payload: string }
      const corrupted = { ...JSON.parse(target.payload) as { text: string }, text: 'x'.repeat(maxDurableTupiniquimTurnTextChars + 1) }
      connection2.prepare('UPDATE tupiniquim_turns SET payload = ? WHERE session_id = ?').run(JSON.stringify(corrupted), snapshot.session.id)
    } finally {
      connection2.close()
    }
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()
  })

  it('get fail-closed: ordem inconsistente (posições duplicadas) e metadados inválidos são descartados', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA, { turnCount: 3 })
    await database.putTupiniquimSessionSnapshot(snapshot)

    const connection = raw()
    try {
      const rows = connection.prepare('SELECT id, position FROM tupiniquim_turns WHERE session_id = ? ORDER BY position ASC').all(snapshot.session.id) as Array<{ id: string; position: number }>
      connection.prepare('UPDATE tupiniquim_turns SET position = 0 WHERE id = ?').run(rows[2]!.id)
    } finally {
      connection.close()
    }
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()

    // updated_at fora do formato ISO no SQLite real também invalida a leitura.
    await database.putTupiniquimSessionSnapshot(snapshot)
    const connection2 = raw()
    try {
      connection2.prepare("UPDATE tupiniquim_sessions SET updated_at = 'nao-e-iso' WHERE workspace_root = ?").run(rootA)
    } finally {
      connection2.close()
    }
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()
  })

  it('get fail-closed: seen órfão inserido fora das constraints é descartado na leitura', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const snapshot = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(snapshot)

    // Corrupção real de linha com FK desligada nesta conexão (estado que uma
    // base íntegra nunca produz): seen referencia turn que não está retido.
    const connection = raw()
    try {
      connection.exec('PRAGMA foreign_keys=OFF;')
      connection.prepare("INSERT INTO tupiniquim_seen (session_id, provider, turn_id) SELECT id, 'ollama', ? FROM tupiniquim_sessions WHERE workspace_root = ?").run(randomUUID(), rootA)
      expect(rawCount(connection, 'tupiniquim_seen')).toBe((snapshot.seenByProvider.ollama?.length ?? 0) + 1)
    } finally {
      connection.close()
    }

    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()
  })

  it('retorna null para workspace sem snapshot e normaliza/rejeita foras do contrato antes da escrita', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const rootB = path.join(fixture, 'workspace-b')
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()

    const snapshot = makeSnapshot(rootA)
    await database.putTupiniquimSessionSnapshot(snapshot)
    expect(await database.getTupiniquimSessionSnapshot(rootB)).toBeNull()

    // Texto acima do limite durável é NORMALIZADO na boundary (redactor
    // canônico corta em 2.000 chars), nunca persiste texto maior.
    const longText = makeSnapshot(rootA, { turnCount: 0, seenByProvider: {} })
    const oversized = {
      ...longText,
      turns: [{ ...makeTurn(longText.session, 9), text: `prefixo ${'y'.repeat(maxDurableTupiniquimTurnTextChars + 500)}` }]
    }
    await expect(database.putTupiniquimSessionSnapshot(oversized)).resolves.toBeUndefined()
    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.turns[0]?.text).toHaveLength(maxDurableTupiniquimTurnTextChars)
    expect(stored?.turns[0]?.text.startsWith('prefixo ')).toBe(true)
    expect(stored?.turns[0]?.text).not.toContain('y'.repeat(maxDurableTupiniquimTurnTextChars + 1))

    // Role fora do contrato durável (system/error) rejeita o put sem tocar no
    // SQLite (schema strict, zero escrita). Cast via unknown: o tipo durável já
    // exclui system — o teste exercita a rejeição no runtime (zod).
    const s2 = makeSnapshot(rootA, { turnCount: 0, seenByProvider: {} })
    const invalidRole = {
      ...s2,
      turns: [{ ...makeTurn(s2.session, 9), role: 'system' as const }]
    } as unknown as TupiniquimDurableSnapshot
    await expect(database.putTupiniquimSessionSnapshot(invalidRole)).rejects.toThrow()
    const connection = raw()
    try {
      const sessions = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_sessions').get() as { total: number }
      expect(sessions.total).toBe(1)
    } finally {
      connection.close()
    }
    expect((await database.getTupiniquimSessionSnapshot(rootA))?.session.id).toBe(stored?.session.id)
  })

  it('failAfter é rejeitado fora de ambiente de teste; produção normal segue sem opções', () => {
    const savedNodeEnv = process.env.NODE_ENV
    const savedVitest = process.env.VITEST
    process.env.NODE_ENV = 'production'
    delete process.env.VITEST
    try {
      expect(() => {
        new LocalDatabase(fixture, { failAfter: { snapshotWriteStatements: 1 } })
      }).toThrow(/exclusivamente test-only/)
      // Produção normal: new LocalDatabase(dataRoot) sem opções continua válido.
      const production = new LocalDatabase(fixture)
      databases.push(production)
    } finally {
      if (savedNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = savedNodeEnv
      if (savedVitest === undefined) delete process.env.VITEST
      else process.env.VITEST = savedVitest
    }
  })

  it('validação pré-commit rejeita S2 relacionalmente inválido e preserva S1 exato (zero linhas parciais)', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const s1 = makeSnapshot(rootA, { turnCount: 3 })
    await database.putTupiniquimSessionSnapshot(s1)

    const corruptions: Array<{ name: string; build: (valid: TupiniquimDurableSnapshot) => TupiniquimDurableSnapshot }> = [
      {
        name: 'turn com sessionId divergente',
        build: (valid) => ({
          ...valid,
          turns: valid.turns.map((turn, index) => index === 0 ? { ...turn, sessionId: randomUUID() } : turn)
        })
      },
      {
        name: 'turn id duplicado',
        build: (valid) => ({
          ...valid,
          turns: [...valid.turns, { ...valid.turns[0]!, text: 'duplicado' }]
        })
      },
      {
        name: 'binding duplicado para o mesmo provider',
        build: (valid) => ({
          ...valid,
          providerBindings: [
            ...valid.providerBindings,
            { provider: valid.providerBindings[0]!.provider, threadId: 'thread-outra', model: 'outro-modelo' }
          ]
        })
      },
      {
        name: 'mesma thread em dois providers',
        build: (valid) => ({
          ...valid,
          providerBindings: [
            valid.providerBindings[0]!,
            { provider: 'codex-app-server' as const, threadId: valid.providerBindings[0]!.threadId, model: 'x' }
          ]
        })
      },
      {
        name: 'turn com threadId sem binding compatível do provider',
        build: (valid) => ({
          ...valid,
          turns: valid.turns.map((turn, index) => index === 0 ? { ...turn, threadId: 'thread-sem-binding' } : turn)
        })
      }
    ]

    for (const corruption of corruptions) {
      const valid = makeSnapshot(rootA, { turnCount: 3 })
      const invalid = corruption.build(valid)
      // Validação pré-commit: rejeita ANTES do BEGIN IMMEDIATE (mensagem própria),
      // não apenas por PK/FK do SQLite no meio da transação.
      await expect(database.putTupiniquimSessionSnapshot(invalid)).rejects.toThrow(/pré-commit/)

      // S1 permanece exatamente intacto; nenhuma linha parcial da tentativa.
      const stored = await database.getTupiniquimSessionSnapshot(rootA)
      expect(stored?.session.id).toBe(s1.session.id)
      expect(stored?.turns.map((turn) => turn.id)).toEqual(s1.turns.map((turn) => turn.id))
      const storedBindings = [...(stored?.providerBindings ?? [])].sort((a, b) => a.provider.localeCompare(b.provider))
      const s1Bindings = [...s1.providerBindings].sort((a, b) => a.provider.localeCompare(b.provider))
      expect(storedBindings).toEqual(s1Bindings)
      const connection = raw()
      try {
        const orphan = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns WHERE session_id = ?').get(valid.session.id) as { total: number }
        expect(orphan.total).toBe(0)
        expect(rawCount(connection, 'tupiniquim_turns')).toBe(3)
        expect(rawCount(connection, 'tupiniquim_sessions')).toBe(1)
        expect(rawCount(connection, 'tupiniquim_bindings')).toBe(2)
        expect(rawCount(connection, 'tupiniquim_seen')).toBe(3)
      } finally {
        connection.close()
      }
    }
  })

  it('redige secrets na boundary durável antes do SQLite e preserva .env', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const session = makeSession(rootA)
    const secrets = [
      'chave exposta sk-proj-EXAMPLE123456789 no texto',
      'cabecalho authorization=BearerExampleSecret fim',
      'config api_key=ExampleSecretValue persistida',
      'segredo token=ExampleSecretValue aqui',
      '.env'
    ]
    const turns = secrets.map((text, index) => makeTurn(session, index, { text }))
    const rawSecrets = ['sk-proj-EXAMPLE123456789', 'BearerExampleSecret', 'ExampleSecretValue']
    const snapshot = makeSnapshot(rootA, { session, turnCount: 0, seenByProvider: {} })
    await database.putTupiniquimSessionSnapshot({ ...snapshot, turns })

    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.turns).toHaveLength(5)
    const storedTexts = stored?.turns.map((turn) => turn.text) ?? []
    expect(storedTexts.join('\n')).not.toContain('sk-proj-EXAMPLE123456789')
    expect(storedTexts.join('\n')).not.toContain('BearerExampleSecret')
    expect(storedTexts.join('\n')).not.toContain('ExampleSecretValue')
    expect(storedTexts.join('\n').match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(4)
    // Menção textual a .env permanece permitida e exatamente preservada.
    expect(storedTexts.at(-1)).toBe('.env')

    // Leitura do SQLite BRUTO: nenhum secret original presente em payload algum.
    const connection = raw()
    try {
      const payloads = connection.prepare('SELECT payload FROM tupiniquim_turns WHERE session_id = ?').all(session.id) as Array<{ payload: string }>
      const joined = payloads.map((row) => row.payload).join('\n')
      for (const secret of rawSecrets) expect(joined).not.toContain(secret)
      expect(joined).toContain('[REDACTED]')
      expect(joined).toContain('"text":".env"')
      // Campos originais preservados no SQLite (id/sessionId/provider/model/threadId/turnId/createdAt).
      expect(joined).toContain(session.id)
      expect(joined).toContain('"provider":"ollama"')
      expect(joined).toContain('"model":"qwen-local"')
      expect(joined).toContain('"threadId":"thread-ollama"')
    } finally {
      connection.close()
    }
  })

  it('rejeita campos privilegiados extras no put (schema strict) e prova ausência no SQLite', async () => {
    const database = openDatabase()
    const rootA = path.join(fixture, 'workspace-a')
    const s1 = makeSnapshot(rootA, { turnCount: 3 })
    await database.putTupiniquimSessionSnapshot(s1)

    const privatePayload = 'PAYLOAD_PRIVADO_QUE_NAO_PODE_PERSISTIR'
    const poisoned = makeSnapshot(rootA, { turnCount: 0, seenByProvider: {} })
    const attempted = {
      ...poisoned,
      proposalAuthority: { provider: 'ollama', threadId: 'thread-ollama', proposalIds: [randomUUID()] },
      proposalIds: [randomUUID()],
      privateProposalPayload: privatePayload,
      turns: [{ ...makeTurn(poisoned.session, 0), text: `texto ${privatePayload}` }]
    } as unknown as TupiniquimDurableSnapshot
    await expect(database.putTupiniquimSessionSnapshot(attempted)).rejects.toThrow()

    // S1 intacto e NENHUMA linha da sessão tentada; payload privado ausente do SQLite bruto.
    const stored = await database.getTupiniquimSessionSnapshot(rootA)
    expect(stored?.session.id).toBe(s1.session.id)
    expect(stored?.turns.map((turn) => turn.id)).toEqual(s1.turns.map((turn) => turn.id))
    const connection = raw()
    try {
      expect(rawCount(connection, 'tupiniquim_sessions')).toBe(1)
      expect(rawCount(connection, 'tupiniquim_turns')).toBe(3)
      const rows = connection.prepare("SELECT payload FROM tupiniquim_turns UNION ALL SELECT updated_at FROM tupiniquim_sessions").all() as Array<{ payload: string }>
      const rawJoined = JSON.stringify(rows)
      expect(rawJoined).not.toContain(privatePayload)
    } finally {
      connection.close()
    }
  })
})

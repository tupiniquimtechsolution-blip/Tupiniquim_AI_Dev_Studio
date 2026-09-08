import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '@tupiniquim/adapters'
import {
  tupiniquimDurableSnapshotSchema,
  type AIProviderKind,
  type AIThread,
  type TupiniquimDurableSnapshot,
  type TupiniquimSession,
  type TupiniquimSessionRecoveryReason
} from '@tupiniquim/contracts'
import { TupiniquimSessionRecovery, TupiniquimSessionService } from '@tupiniquim/core'

/**
 * Wave 16 — Incremento 2/4: hydrate fail-closed da Tupiniquim Session a partir
 * do snapshot durável v5 no SQLite REAL, com validação de bindings contra a
 * AIThread persistida.
 *
 * O ciclo de restart é real: grava com um LocalDatabase, fecha (close do worker
 * e do arquivo), reabre um novo LocalDatabase sobre o MESMO dataRoot e restaura
 * o workspace pelo mesmo caminho usado pelo `workspace.configure` do processo
 * main (`TupiniquimSessionRecovery.restore(root)` → `agent.session()`).
 *
 * Escopo respeitado: somente leitura. Nenhum write-through, nenhum shutdown
 * aguardável, nenhum hydrate de conversation Ollama.
 */

const isWindows = process.platform === 'win32'
const now = new Date().toISOString()
const privateMarker = 'TUPINIQUIM_SESSION_PRIVATE_PAYLOAD'

const ollamaThread = 'thread-ollama-duravel'
const codexThread = 'thread-codex-duravel'
const ollamaModel = 'qwen-local'
const codexModel = 'codex-test-model'

let fixture = ''
const databases: LocalDatabase[] = []

const rawDatabasePath = (): string => path.join(fixture, 'database', 'studio.sqlite')

const raw = (): DatabaseSync => new DatabaseSync(rawDatabasePath())

const openDatabase = (): LocalDatabase => {
  const database = new LocalDatabase(fixture)
  databases.push(database)
  return database
}

/** Fecha um banco específico (restart real) sem fechar duas vezes no afterEach. */
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

const makeSession = (workspaceRoot: string): TupiniquimSession => ({
  id: randomUUID(),
  workspaceRoot,
  createdAt: now,
  updatedAt: now
})

const makeTurn = (
  session: TupiniquimSession,
  index: number,
  provider: AIProviderKind = 'ollama'
): TupiniquimDurableSnapshot['turns'][number] => ({
  id: randomUUID(),
  sessionId: session.id,
  role: index % 2 === 0 ? 'user' : 'assistant',
  text: `turno público ${provider} ${index}`,
  provider,
  model: provider === 'ollama' ? ollamaModel : codexModel,
  threadId: provider === 'ollama' ? ollamaThread : codexThread,
  turnId: `turno-${provider}-${index}`,
  createdAt: now
})

const makeThread = (input: {
  id: string
  provider: AIProviderKind
  workspaceRoot: string
  model: string | null
}): AIThread => ({ ...input, createdAt: now, updatedAt: now })

/** Snapshot íntegro: 4 turns (2 providers), 2 bindings, seen completo do Ollama. */
const makeSnapshot = (workspaceRoot: string): TupiniquimDurableSnapshot => {
  const session = makeSession(workspaceRoot)
  const turns = [
    makeTurn(session, 0, 'ollama'),
    makeTurn(session, 1, 'codex-app-server'),
    makeTurn(session, 2, 'ollama'),
    makeTurn(session, 3, 'codex-app-server')
  ]
  return {
    session,
    turns,
    providerBindings: [
      { provider: 'ollama', threadId: ollamaThread, model: ollamaModel },
      { provider: 'codex-app-server', threadId: codexThread, model: codexModel }
    ],
    seenByProvider: { ollama: turns.map((turn) => turn.id) }
  }
}

const makeThreads = (workspaceRoot: string): AIThread[] => [
  makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot, model: ollamaModel }),
  makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot, model: codexModel })
]

/** Grava snapshot + AIThreads e devolve um banco novo sobre o mesmo dataRoot (restart). */
const persistAndRestart = async (input: {
  snapshot: TupiniquimDurableSnapshot
  threads?: readonly AIThread[]
  corrupt?: (connection: DatabaseSync) => void
}): Promise<LocalDatabase> => {
  const writer = openDatabase()
  for (const thread of input.threads ?? []) await writer.putAIThread(thread)
  await writer.putTupiniquimSessionSnapshot(input.snapshot)
  await closeDatabase(writer)
  if (input.corrupt !== undefined) {
    const connection = raw()
    try {
      input.corrupt(connection)
    } finally {
      connection.close()
    }
  }
  return openDatabase()
}

const restartFixture = (database: LocalDatabase): {
  sessions: TupiniquimSessionService
  recovery: TupiniquimSessionRecovery
} => {
  const sessions = new TupiniquimSessionService()
  return { sessions, recovery: new TupiniquimSessionRecovery(sessions, database, database) }
}

const rawText = (connection: DatabaseSync): string => {
  const tables = ['tupiniquim_sessions', 'tupiniquim_turns', 'tupiniquim_bindings', 'tupiniquim_seen', 'ai_threads', 'ai_turns', 'ai_events']
  const chunks: string[] = []
  for (const table of tables) {
    const columns = connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    const rows = connection.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>
    chunks.push(`${table}:${columns.map((column) => column.name).join(',')}:${JSON.stringify(rows)}`)
  }
  return chunks.join('\n')
}

/** Fotografia textual sanitizável de todas as linhas duráveis relevantes. */
const rawTextSnapshot = (): string => {
  const connection = raw()
  try {
    return rawText(connection)
  } finally {
    connection.close()
  }
}

const expectCleanSession = (sessions: TupiniquimSessionService, workspaceRoot: string, rejectedSessionId: string): void => {
  const conversation = sessions.snapshot()
  expect(conversation).not.toBeNull()
  expect(conversation?.session.workspaceRoot).toBe(workspaceRoot)
  expect(conversation?.session.id).not.toBe(rejectedSessionId)
  expect(conversation?.turns).toEqual([])
  expect(conversation?.providerThreads).toEqual([])
  expect(conversation?.proposalAuthority).toBeNull()
  expect(sessions.threadFor('ollama')).toBeUndefined()
  expect(sessions.threadFor('codex-app-server')).toBeUndefined()
  expect(sessions.modelFor('ollama')).toBeNull()
  expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
  expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })
  expect(sessions.ephemeralLifecycle()).toEqual({
    authority: null,
    proposalIds: 0,
    inProgress: 0,
    pending: 0,
    settledSuccess: 0,
    settledFailure: 0,
    finalizedTurns: 0
  })
}

beforeEach(async () => {
  const temp = process.env.TEMP ?? process.env.TMP ?? os.tmpdir()
  if (isWindows && (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\')) {
    throw new Error('TEMP de testes precisa estar em F:.')
  }
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-session-recovery-'))
})

afterEach(async () => {
  for (const database of databases.splice(0)) await database.close()
  if (fixture !== '') await rm(fixture, { recursive: true, force: true })
})

describe('recovery da Tupiniquim Session — SQLite real, restart real', () => {
  it('restaura a mesma sessão S com turns, bindings e seen após fechar e reabrir o LocalDatabase', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const snapshot = makeSnapshot(rootA)
    const database = await persistAndRestart({ snapshot, threads: makeThreads(rootA) })
    const { sessions, recovery } = restartFixture(database)

    const result = await recovery.restore(rootA)
    expect(result.outcome).toBe('HYDRATED')
    expect(result.reasons).toEqual([])
    expect(result.session.id).toBe(snapshot.session.id)
    expect(result.snapshotCounts).toEqual({ turns: 4, bindings: 2, seenProviders: 1 })
    expect(result.restored).toEqual({ turns: 4, bindings: 2, seenProviders: 1 })
    expect(result.expiredProposalIds).toEqual([])

    // agent.session() (snapshot da sessão ativa) devolve o estado recuperado.
    const conversation = sessions.snapshot()
    expect(conversation?.session).toEqual(snapshot.session)
    expect(conversation?.turns.map((turn) => turn.id)).toEqual(snapshot.turns.map((turn) => turn.id))
    expect(conversation?.turns.map((turn) => turn.text)).toEqual(snapshot.turns.map((turn) => turn.text))
    expect(conversation?.turns.map((turn) => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    // Bindings são um conjunto chaveado por provider: a ordem canônica vem da
    // leitura durável (ORDER BY provider), não da ordem de criação pré-restart.
    const sortedBindings = [...(conversation?.providerThreads ?? [])].sort((a, b) => a.provider.localeCompare(b.provider))
    expect(sortedBindings).toEqual([
      { provider: 'codex-app-server', threadId: codexThread, model: codexModel },
      { provider: 'ollama', threadId: ollamaThread, model: ollamaModel }
    ])
    expect(sessions.threadFor('ollama')).toBe(ollamaThread)
    expect(sessions.threadFor('codex-app-server')).toBe(codexThread)
    expect(sessions.modelFor('codex-app-server')).toBe(codexModel)

    // seen restaurado: Ollama já ACKou tudo; Codex continua com contexto pendente.
    expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    const unseenForCodex = sessions.unseenPublicContext('codex-app-server')
    expect(unseenForCodex.turnIds).toEqual(snapshot.turns.filter((turn) => turn.provider === 'ollama').map((turn) => turn.id))
    expect(unseenForCodex.text).toContain('turno público ollama 0')

    // Lifecycle efêmero NÃO é hidratado.
    expect(sessions.proposalAuthority()).toBeNull()
    expect(conversation?.proposalAuthority).toBeNull()
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
    expect(sessions.ephemeralLifecycle()).toEqual({
      authority: null,
      proposalIds: 0,
      inProgress: 0,
      pending: 0,
      settledSuccess: 0,
      settledFailure: 0,
      finalizedTurns: 0
    })
    expect(result.diagnostic).toContain('outcome=HYDRATED')
    expect(result.diagnostic).toContain('workspace=[REDACTED]')
    expect(result.diagnostic).not.toContain(rootA)
  })

  it('não possui storage de proposal authority no SQLite v5 e nunca a recupera após restart', async () => {
    const rootA = workspaceRootFor('workspace-a')
    // Sessão viva pré-restart COM autoridade de proposal concedida.
    const beforeRestart = new TupiniquimSessionService()
    beforeRestart.open(rootA)
    beforeRestart.bindProviderThread('ollama', ollamaThread, ollamaModel)
    beforeRestart.bindProviderThread('codex-app-server', codexThread, codexModel)
    beforeRestart.appendTurn({
      role: 'user',
      text: 'mensagem pública antes do restart',
      provider: 'ollama',
      model: ollamaModel,
      threadId: ollamaThread,
      turnId: 'turno-pre-restart'
    })
    const proposalId = randomUUID()
    beforeRestart.grantProposalAuthority('ollama', ollamaThread, proposalId)
    expect(beforeRestart.proposalAuthority()?.proposalIds).toEqual([proposalId])

    const conversation = beforeRestart.snapshot()
    if (conversation === null) throw new Error('Sessão pré-restart ausente.')
    const durable = tupiniquimDurableSnapshotSchema.parse({
      session: conversation.session,
      turns: conversation.turns.filter((turn) => turn.role === 'user' || turn.role === 'assistant'),
      providerBindings: conversation.providerThreads,
      seenByProvider: { ollama: conversation.turns.map((turn) => turn.id) }
    })
    // O contrato durável não tem onde carregar authority/proposalIds.
    expect(JSON.stringify(durable)).not.toContain(proposalId)
    expect(JSON.stringify(durable)).not.toContain('proposalAuthority')

    const database = await persistAndRestart({ snapshot: durable, threads: makeThreads(rootA) })
    const connection = raw()
    try {
      const persisted = rawText(connection)
      expect(persisted).not.toContain(proposalId)
      expect(persisted).not.toContain('proposalAuthority')
      expect(persisted).not.toContain(privateMarker)
      const bindingColumns = (connection.prepare('PRAGMA table_info(tupiniquim_bindings)').all() as Array<{ name: string }>).map((column) => column.name)
      expect(bindingColumns).toEqual(['session_id', 'provider', 'thread_id', 'model'])
      const tables = (connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name)
      expect(tables.some((table) => table.toLowerCase().includes('proposal'))).toBe(false)
    } finally {
      connection.close()
    }

    const { sessions, recovery } = restartFixture(database)
    const result = await recovery.restore(rootA)
    expect(result.outcome).toBe('HYDRATED')
    expect(result.session.id).toBe(conversation.session.id)
    // Restart nunca recupera proposalIds/payload privado/pending approval authority.
    expect(sessions.proposalAuthority()).toBeNull()
    expect(sessions.ephemeralLifecycle().authority).toBeNull()
    expect(sessions.ephemeralLifecycle().proposalIds).toBe(0)
    expect(sessions.snapshot()?.proposalAuthority).toBeNull()
    expect(JSON.stringify(sessions.snapshot())).not.toContain(proposalId)
  })

  it('workspace sem snapshot v5 cria sessão nova limpa e não é tratado como erro', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const database = openDatabase()
    const { sessions, recovery } = restartFixture(database)

    const result = await recovery.restore(rootA)
    expect(result.outcome).toBe('NO_SNAPSHOT')
    expect(result.reasons).toEqual([])
    expect(result.snapshotCounts).toBeNull()
    expect(result.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
    expect(result.diagnostic).toContain('outcome=NO_SNAPSHOT')
    expect(sessions.current()?.workspaceRoot).toBe(rootA)
    expect(sessions.snapshot()?.turns).toEqual([])
    expect(sessions.snapshot()?.providerThreads).toEqual([])
    expect(sessions.proposalAuthority()).toBeNull()
  })

  const provenanceRejections: Array<{
    name: string
    reason: TupiniquimSessionRecoveryReason
    threads: (rootA: string, rootB: string) => AIThread[]
  }> = [
    {
      name: 'thread ausente no SQLite',
      reason: 'THREAD_MISSING',
      threads: (rootA) => [makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: rootA, model: codexModel })]
    },
    {
      name: 'AIThread de outro provider',
      reason: 'PROVIDER_MISMATCH',
      threads: (rootA) => [
        makeThread({ id: ollamaThread, provider: 'codex-app-server', workspaceRoot: rootA, model: ollamaModel }),
        makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: rootA, model: codexModel })
      ]
    },
    {
      name: 'AIThread de outro workspace (mesmo id, provider e model)',
      reason: 'WORKSPACE_MISMATCH',
      threads: (rootA, rootB) => [
        makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot: rootB, model: ollamaModel }),
        makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: rootB, model: codexModel })
      ]
    },
    {
      name: 'model divergente entre binding e AIThread',
      reason: 'MODEL_MISMATCH',
      threads: (rootA) => [
        makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot: rootA, model: 'outro-modelo-local' }),
        makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: rootA, model: codexModel })
      ]
    },
    {
      name: 'AIThread.model null contra binding.model string',
      reason: 'MODEL_MISMATCH',
      threads: (rootA) => [
        makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot: rootA, model: null }),
        makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: rootA, model: codexModel })
      ]
    }
  ]

  for (const rejection of provenanceRejections) {
    it(`rejeita provenance inválida (${rejection.name}) e cria sessão nova limpa sem estado parcial`, async () => {
      const rootA = workspaceRootFor('workspace-a')
      const rootB = workspaceRootFor('workspace-b')
      const snapshot = makeSnapshot(rootA)
      const database = await persistAndRestart({ snapshot, threads: rejection.threads(rootA, rootB) })
      const { sessions, recovery } = restartFixture(database)

      const result = await recovery.restore(rootA)
      expect(result.outcome).toBe('REJECTED')
      expect(result.reasons).toEqual([rejection.reason])
      expect(result.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
      expect(result.diagnostic).toContain('outcome=REJECTED')
      expect(result.diagnostic).toContain(rejection.reason)
      expect(result.diagnostic).not.toContain(rootA)
      expect(result.diagnostic).not.toContain(rootB)
      expect(result.diagnostic).not.toContain('turno público')
      expectCleanSession(sessions, rootA, snapshot.session.id)

      // O snapshot permanece no SQLite (rejeição não apaga, não muta, não escreve).
      const connection = raw()
      try {
        const storedSessions = connection.prepare('SELECT id FROM tupiniquim_sessions WHERE workspace_root = ?').all(rootA) as Array<{ id: string }>
        expect(storedSessions.map((row) => row.id)).toEqual([snapshot.session.id])
        const turns = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns').get() as { total: number }
        expect(turns.total).toBe(4)
      } finally {
        connection.close()
      }
      expect((await database.getTupiniquimSessionSnapshot(rootA))?.session.id).toBe(snapshot.session.id)
    })
  }

  it('rejeita snapshot relacionalmente inconsistente no SQLite com SNAPSHOT_INVALID (leitura fail-closed)', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const snapshot = makeSnapshot(rootA)
    // Corrupção real pós-commit: turn aponta para thread sem binding compatível.
    const database = await persistAndRestart({
      snapshot,
      threads: makeThreads(rootA),
      corrupt: (connection) => {
        connection.prepare('UPDATE tupiniquim_turns SET payload = ? WHERE session_id = ?')
          .run(
            JSON.stringify({ ...snapshot.turns[0]!, threadId: 'thread-estranha' }),
            snapshot.session.id
          )
      }
    })
    const { sessions, recovery } = restartFixture(database)

    const result = await recovery.restore(rootA)
    expect(result.outcome).toBe('REJECTED')
    expect(result.reasons).toEqual(['SNAPSHOT_INVALID'])
    expectCleanSession(sessions, rootA, snapshot.session.id)
    // A boundary durável continua devolvendo null para o snapshot inconsistente.
    expect(await database.getTupiniquimSessionSnapshot(rootA)).toBeNull()
    expect((await database.readTupiniquimSessionSnapshot(rootA)).status).toBe('INVALID')
  })

  it('preserva a sessão viva no mesmo processo (A → B → A) sem rehidratar o snapshot antigo', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const rootB = workspaceRootFor('workspace-b')
    const snapshotA = makeSnapshot(rootA)
    const writer = openDatabase()
    for (const thread of makeThreads(rootA)) await writer.putAIThread(thread)
    await writer.putTupiniquimSessionSnapshot(snapshotA)
    await closeDatabase(writer)

    const database = openDatabase()
    const { sessions, recovery } = restartFixture(database)

    const openedA = await recovery.restore(rootA)
    expect(openedA.outcome).toBe('HYDRATED')
    expect(openedA.session.id).toBe(snapshotA.session.id)

    // Conversa nova em memória (ainda não durável: não há write-through neste incremento).
    const liveTurn = sessions.appendTurn({
      role: 'user',
      text: 'pergunta feita depois do restart',
      provider: 'ollama',
      model: ollamaModel,
      threadId: ollamaThread,
      turnId: 'turno-pos-restart'
    })
    sessions.bindProviderThread('ollama', ollamaThread, 'modelo-selecionado-depois')

    const openedB = await recovery.restore(rootB)
    expect(openedB.outcome).toBe('NO_SNAPSHOT')
    expect(openedB.session.id).not.toBe(snapshotA.session.id)
    expect(sessions.snapshot()?.turns).toEqual([])

    const backToA = await recovery.restore(rootA)
    expect(backToA.outcome).toBe('LIVE_SESSION')
    expect(backToA.session.id).toBe(snapshotA.session.id)
    expect(backToA.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
    // Estado vivo preservado: os 4 turns restaurados + o turn criado depois.
    expect(sessions.snapshot()?.turns.map((turn) => turn.id)).toEqual([
      ...snapshotA.turns.map((turn) => turn.id),
      liveTurn.id
    ])
    expect(sessions.modelFor('ollama')).toBe('modelo-selecionado-depois')

    // Zero write-through: o SQLite continua exatamente com o snapshot original.
    const connection = raw()
    try {
      const stored = connection.prepare('SELECT COUNT(*) AS total FROM tupiniquim_turns').get() as { total: number }
      expect(stored.total).toBe(4)
      const bindings = connection.prepare('SELECT model FROM tupiniquim_bindings WHERE provider = ?').all('ollama') as Array<{ model: string | null }>
      expect(bindings).toEqual([{ model: ollamaModel }])
      expect(rawText(connection)).not.toContain('pergunta feita depois do restart')
    } finally {
      connection.close()
    }
    expect((await database.getTupiniquimSessionSnapshot(rootA))?.turns).toHaveLength(4)
  })

  it('não faz write-through: nada do estado hidratado ou posterior é gravado no SQLite', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const snapshot = makeSnapshot(rootA)
    const database = await persistAndRestart({ snapshot, threads: makeThreads(rootA) })
    const beforeText = rawTextSnapshot()

    const { sessions, recovery } = restartFixture(database)
    expect((await recovery.restore(rootA)).outcome).toBe('HYDRATED')
    sessions.appendTurn({
      role: 'user',
      text: `${privateMarker} não pode chegar ao disco neste incremento`,
      provider: 'ollama',
      model: ollamaModel,
      threadId: ollamaThread,
      turnId: 'turno-sem-write-through'
    })
    sessions.grantProposalAuthority('ollama', ollamaThread, randomUUID())

    const afterText = rawTextSnapshot()
    expect(afterText).toBe(beforeText)
    expect(afterText).not.toContain(privateMarker)
    expect(afterText).not.toContain('proposalAuthority')
  })

  it('restaura dois workspaces isolados: sessão de A nunca usa thread ou contexto de B', async () => {
    const rootA = workspaceRootFor('workspace-a')
    const rootB = workspaceRootFor('workspace-b')
    const snapshotA = makeSnapshot(rootA)
    const sessionB = makeSession(rootB)
    const threadB = 'thread-ollama-de-b'
    const turnsB = [makeTurn(sessionB, 0, 'ollama')].map((turn) => ({ ...turn, threadId: threadB }))
    const snapshotB: TupiniquimDurableSnapshot = {
      session: sessionB,
      turns: turnsB,
      providerBindings: [{ provider: 'ollama', threadId: threadB, model: ollamaModel }],
      seenByProvider: { ollama: turnsB.map((turn) => turn.id) }
    }

    const writer = openDatabase()
    for (const thread of makeThreads(rootA)) await writer.putAIThread(thread)
    await writer.putAIThread(makeThread({ id: threadB, provider: 'ollama', workspaceRoot: rootB, model: ollamaModel }))
    await writer.putTupiniquimSessionSnapshot(snapshotA)
    await writer.putTupiniquimSessionSnapshot(snapshotB)
    await closeDatabase(writer)

    const database = openDatabase()
    const { sessions, recovery } = restartFixture(database)

    expect((await recovery.restore(rootA)).outcome).toBe('HYDRATED')
    expect(sessions.threadFor('ollama')).toBe(ollamaThread)
    expect(sessions.unseenPublicContext('codex-app-server').text).not.toContain('thread-ollama-de-b')

    const restoredB = await recovery.restore(rootB)
    expect(restoredB.outcome).toBe('HYDRATED')
    expect(restoredB.session.id).toBe(sessionB.id)
    expect(sessions.snapshot()?.turns.map((turn) => turn.id)).toEqual(turnsB.map((turn) => turn.id))
    expect(sessions.threadFor('ollama')).toBe(threadB)
    expect(sessions.threadFor('codex-app-server')).toBeUndefined()
    // Contexto de A não aparece na sessão de B.
    expect(sessions.publicProviderContext()).not.toContain('turno público codex-app-server 1')
    // A thread de A não é selecionável enquanto B está ativo: o binding de B prevalece.
    expect(sessions.resolveChatThread('ollama', ollamaThread)).toBe(threadB)
    expect(sessions.acceptsProviderEvent('ollama', ollamaThread)).toBe(false)
  })
})

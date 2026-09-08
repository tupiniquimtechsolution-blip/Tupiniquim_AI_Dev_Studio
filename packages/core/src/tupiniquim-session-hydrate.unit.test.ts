import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  AIProviderKind,
  AIThread,
  TupiniquimDurableSnapshot,
  TupiniquimSession,
  TupiniquimSessionRecoveryReason,
  TupiniquimSessionSnapshotRead
} from '@tupiniquim/contracts'
import { TupiniquimSessionService } from './tupiniquim-session'
import {
  TupiniquimSessionRecovery,
  type TupiniquimSessionSnapshotRepository,
  type TupiniquimSessionThreadRepository
} from './tupiniquim-session-recovery'

/**
 * Wave 16 — Incremento 2/4: hydrate fail-closed da Tupiniquim Session a partir
 * do snapshot durável v5 + validação de provenance contra a AIThread persistida.
 *
 * Invariante central: `Tupiniquim Session != Provider Thread`. Snapshot só é
 * hidratado com TODA a provenance válida (turn → binding → AIThread →
 * provider/workspace/model). Nunca hydrate parcial. Lifecycle efêmero
 * (authority/proposalIds/inProgress/pending/settled/finalized) nunca é hidratado.
 *
 * SQLite real (fechar/reabrir) vive em tests/integration/tupiniquim-session-recovery.test.ts.
 */

const now = new Date().toISOString()
const workspaceA = '/workspace/autorizado-a'
const workspaceB = '/workspace/autorizado-b'
const privateMarker = 'TUPINIQUIM_SESSION_PRIVATE_PAYLOAD'

const ollamaThread = 'thread-ollama'
const codexThread = 'thread-codex'
const ollamaModel = 'qwen-local'
const codexModel = 'codex-test-model'

const makeSession = (workspaceRoot: string): TupiniquimSession => ({
  id: randomUUID(),
  workspaceRoot,
  createdAt: now,
  updatedAt: now
})

const makeThread = (input: {
  id: string
  provider: AIProviderKind
  workspaceRoot: string
  model: string | null
}): AIThread => ({ ...input, createdAt: now, updatedAt: now })

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

/** Snapshot durável íntegro: 2 providers, 4 turns, seen completo do Ollama. */
const makeSnapshot = (
  workspaceRoot: string,
  overrides: Partial<TupiniquimDurableSnapshot> = {}
): TupiniquimDurableSnapshot => {
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
    seenByProvider: { ollama: turns.map((turn) => turn.id) },
    ...overrides
  }
}

const makeThreads = (workspaceRoot: string): AIThread[] => [
  makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot, model: ollamaModel }),
  makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot, model: codexModel })
]

class FakeSnapshotRepository implements TupiniquimSessionSnapshotRepository {
  public readonly byRoot = new Map<string, TupiniquimSessionSnapshotRead>()
  public readonly reads: string[] = []
  public failure: Error | null = null

  public readTupiniquimSessionSnapshot(workspaceRoot: string): Promise<TupiniquimSessionSnapshotRead> {
    this.reads.push(workspaceRoot)
    if (this.failure !== null) return Promise.reject(this.failure)
    return Promise.resolve(this.byRoot.get(workspaceRoot) ?? { status: 'ABSENT' })
  }
}

class FakeThreadRepository implements TupiniquimSessionThreadRepository {
  public readonly byId = new Map<string, AIThread>()
  public readonly reads: string[] = []
  public failure: Error | null = null

  public getAIThread(threadId: string): Promise<AIThread | null> {
    this.reads.push(threadId)
    if (this.failure !== null) return Promise.reject(this.failure)
    return Promise.resolve(this.byId.get(threadId) ?? null)
  }
}

const fixture = (roots: Record<string, TupiniquimSessionSnapshotRead> = {}): {
  sessions: TupiniquimSessionService
  snapshots: FakeSnapshotRepository
  threads: FakeThreadRepository
  recovery: TupiniquimSessionRecovery
} => {
  const sessions = new TupiniquimSessionService()
  const snapshots = new FakeSnapshotRepository()
  const threads = new FakeThreadRepository()
  for (const [root, read] of Object.entries(roots)) snapshots.byRoot.set(root, read)
  for (const thread of makeThreads(workspaceA)) threads.byId.set(thread.id, thread)
  return { sessions, snapshots, threads, recovery: new TupiniquimSessionRecovery(sessions, snapshots, threads) }
}

describe('hydrateWorkspace — hidratação íntegra (A)', () => {
  it('reconstrói session, ordem de turns, bindings e seen a partir do snapshot v5', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    const result = sessions.hydrateWorkspace(snapshot, makeThreads(workspaceA), workspaceA)

    expect(result.status).toBe('HYDRATED')
    if (result.status !== 'HYDRATED') throw new Error('hydrate deveria ter sido aceito.')
    expect(result.session.id).toBe(snapshot.session.id)
    expect(result.restored).toEqual({ turns: 4, bindings: 2, seenProviders: 1 })

    // Instala sem ativar: a ativação continua sendo switchWorkspace (preserva a
    // revogação de authority do workspace anterior).
    expect(sessions.hasWorkspace(workspaceA)).toBe(true)
    expect(sessions.current()).toBeNull()

    sessions.switchWorkspace(workspaceA)
    const conversation = sessions.snapshot()
    expect(conversation?.session).toEqual(snapshot.session)
    expect(conversation?.turns.map((turn) => turn.id)).toEqual(snapshot.turns.map((turn) => turn.id))
    expect(conversation?.turns.map((turn) => turn.text)).toEqual(snapshot.turns.map((turn) => turn.text))
    expect(conversation?.turns.map((turn) => turn.createdAt)).toEqual(snapshot.turns.map((turn) => turn.createdAt))
    expect(conversation?.providerThreads).toEqual([
      { provider: 'ollama', threadId: ollamaThread, model: ollamaModel },
      { provider: 'codex-app-server', threadId: codexThread, model: codexModel }
    ])
    expect(sessions.threadFor('ollama')).toBe(ollamaThread)
    expect(sessions.threadFor('codex-app-server')).toBe(codexThread)
    expect(sessions.modelFor('ollama')).toBe(ollamaModel)
    expect(sessions.resolveChatThread('codex-app-server')).toBe(codexThread)
  })

  it('restaura seen-by-provider: contexto já ACKado não é retransmitido', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    sessions.hydrateWorkspace(snapshot, makeThreads(workspaceA), workspaceA)
    sessions.switchWorkspace(workspaceA)

    // Ollama já tinha ACKado todos os turns antes do restart.
    expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    // Codex nunca viu os turns do Ollama: continuam pendentes (incremental, não integral).
    const unseenForCodex = sessions.unseenPublicContext('codex-app-server')
    expect(unseenForCodex.turnIds).toEqual(
      snapshot.turns.filter((turn) => turn.provider === 'ollama').map((turn) => turn.id)
    )
    expect(unseenForCodex.text).toContain('turno público ollama 0')
    expect(unseenForCodex.text).not.toContain(privateMarker)

    // ACK pós-restart continua funcionando sobre o cursor restaurado.
    sessions.acknowledgeProviderContext('codex-app-server', unseenForCodex.turnIds)
    expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })
  })

  it('copia o estado: mutação posterior do snapshot recebido não altera a sessão hidratada', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    sessions.hydrateWorkspace(snapshot, makeThreads(workspaceA), workspaceA)
    sessions.switchWorkspace(workspaceA)

    const firstTurn = snapshot.turns[0]
    if (firstTurn === undefined) throw new Error('Snapshot sem turn.')
    firstTurn.text = 'texto mutado depois do hydrate'
    snapshot.providerBindings[0] = { provider: 'ollama', threadId: 'thread-outra', model: 'outro' }

    expect(sessions.snapshot()?.turns[0]?.text).toBe('turno público ollama 0')
    expect(sessions.threadFor('ollama')).toBe(ollamaThread)
  })
})

describe('hydrateWorkspace — lifecycle efêmero nunca é hidratado (B)', () => {
  it('inicia authority, proposalIds, inProgress, pending, settled e finalized vazios', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    expect(sessions.hydrateWorkspace(snapshot, makeThreads(workspaceA), workspaceA).status).toBe('HYDRATED')
    sessions.switchWorkspace(workspaceA)

    expect(sessions.proposalAuthority()).toBeNull()
    expect(sessions.snapshot()?.proposalAuthority).toBeNull()
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
    expect(sessions.ephemeralLifecycle()).toEqual({
      authority: null,
      proposalIds: 0,
      inProgress: 0,
      pending: 0,
      settledSuccess: 0,
      settledFailure: 0,
      finalizedTurns: 0,
      unsuccessfulTurns: 0
    })
    // A autoridade pós-restart é NOVA e exige o binding restaurado do provider.
    const proposalId = randomUUID()
    sessions.grantProposalAuthority('ollama', ollamaThread, proposalId)
    expect(sessions.proposalAuthority()).toEqual({ provider: 'ollama', threadId: ollamaThread, proposalIds: [proposalId] })
    expect(sessions.ephemeralLifecycle().proposalIds).toBe(1)
    expect(() => sessions.grantProposalAuthority('codex-app-server', codexThread, randomUUID())).toThrow('não transfere')
  })

  it('rejeita snapshot que tente contrabandear proposal authority (schema strict, zero hydrate)', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    const smuggled = {
      ...snapshot,
      proposalAuthority: { provider: 'ollama', threadId: ollamaThread, proposalIds: [randomUUID()] },
      proposalIds: [randomUUID()],
      privateProposalPayload: privateMarker,
      finalizedTurns: ['qualquer-coisa']
    } as unknown as TupiniquimDurableSnapshot

    const result = sessions.hydrateWorkspace(smuggled, makeThreads(workspaceA), workspaceA)
    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') throw new Error('Snapshot privilegiado deveria ser rejeitado.')
    expect(result.reasons).toEqual(['SNAPSHOT_INVALID'])
    expect(sessions.hasWorkspace(workspaceA)).toBe(false)
    expect(sessions.current()).toBeNull()
  })
})

describe('hydrateWorkspace — sessão viva nunca é sobrescrita (C)', () => {
  it('A → B → A retorna ao estado vivo de A e nunca relê o snapshot antigo', async () => {
    const { sessions, snapshots, threads, recovery } = fixture()

    const openedA = await recovery.restore(workspaceA)
    expect(openedA.outcome).toBe('NO_SNAPSHOT')
    const liveSessionId = openedA.session.id

    // Conversa nova em memória, ainda não durável (neste incremento não há write-through).
    sessions.bindProviderThread('ollama', 'thread-viva', 'modelo-vivo')
    const liveTurn = sessions.appendTurn({
      role: 'user',
      text: 'conversa viva criada depois da abertura',
      provider: 'ollama',
      model: 'modelo-vivo',
      threadId: 'thread-viva',
      turnId: 'turno-vivo'
    })

    // Um snapshot ANTIGO de A existe no SQLite (outro processo/estado pré-restart).
    const stale = makeSnapshot(workspaceA)
    expect(stale.session.id).not.toBe(liveSessionId)
    snapshots.byRoot.set(workspaceA, { status: 'VALID', snapshot: stale })
    for (const thread of makeThreads(workspaceA)) threads.byId.set(thread.id, thread)
    // A partir daqui nenhuma leitura durável pode acontecer: A e B estão vivos.
    snapshots.reads.length = 0

    const openedB = await recovery.restore(workspaceB)
    expect(openedB.outcome).toBe('NO_SNAPSHOT')
    expect(openedB.session.id).not.toBe(liveSessionId)
    expect(sessions.snapshot()?.turns).toEqual([])

    const backToA = await recovery.restore(workspaceA)
    expect(backToA.outcome).toBe('LIVE_SESSION')
    expect(backToA.session.id).toBe(liveSessionId)
    expect(backToA.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
    // O snapshot antigo de A nunca foi consultado nesta volta: somente B (sem
    // sessão viva) chegou a ser lido.
    expect(snapshots.reads).toEqual([workspaceB])
    expect(sessions.snapshot()?.session.id).toBe(liveSessionId)
    expect(sessions.snapshot()?.session.id).not.toBe(stale.session.id)
    expect(sessions.snapshot()?.turns.map((turn) => turn.id)).toEqual([liveTurn.id])
    expect(sessions.threadFor('ollama')).toBe('thread-viva')
  })

  it('hydrate direto sobre workspace com sessão viva preserva a memória (LIVE_SESSION_PRESERVED)', () => {
    const sessions = new TupiniquimSessionService()
    const live = sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-viva', 'modelo-vivo')
    sessions.appendTurn({
      role: 'user',
      text: 'estado vivo',
      provider: 'ollama',
      model: 'modelo-vivo',
      threadId: 'thread-viva',
      turnId: 'turno-vivo'
    })

    const stale = makeSnapshot(workspaceA)
    const result = sessions.hydrateWorkspace(stale, makeThreads(workspaceA), workspaceA)
    expect(result.status).toBe('LIVE_SESSION_PRESERVED')
    if (result.status !== 'LIVE_SESSION_PRESERVED') throw new Error('Sessão viva deveria ser preservada.')
    expect(result.session.id).toBe(live.id)
    expect(sessions.current()?.id).toBe(live.id)
    expect(sessions.snapshot()?.turns).toHaveLength(1)
    expect(sessions.snapshot()?.turns[0]?.text).toBe('estado vivo')
    expect(sessions.threadFor('ollama')).toBe('thread-viva')
  })
})

describe('hydrateWorkspace — fail-closed integral sem mutação parcial (D)', () => {
  interface Corruption {
    name: string
    reasons: TupiniquimSessionRecoveryReason[]
    build: (snapshot: TupiniquimDurableSnapshot) => { snapshot: TupiniquimDurableSnapshot; threads: AIThread[]; root: string }
  }

  const corruptions: Corruption[] = [
    {
      name: 'workspaceRoot da sessão divergente da raiz configurada',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({ snapshot, threads: makeThreads(workspaceA), root: workspaceB })
    },
    {
      name: 'binding com AIThread inexistente',
      reasons: ['THREAD_MISSING'],
      build: (snapshot) => ({ snapshot, threads: [], root: workspaceA })
    },
    {
      name: 'binding com AIThread de outro provider',
      reasons: ['PROVIDER_MISMATCH'],
      build: (snapshot) => ({
        snapshot,
        threads: [
          makeThread({ id: ollamaThread, provider: 'codex-app-server', workspaceRoot: workspaceA, model: ollamaModel }),
          makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: workspaceA, model: codexModel })
        ],
        root: workspaceA
      })
    },
    {
      name: 'binding com AIThread de outro workspace (cross-workspace, mesmo id/provider/model)',
      reasons: ['WORKSPACE_MISMATCH'],
      build: (snapshot) => ({
        snapshot,
        threads: [
          makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot: workspaceB, model: ollamaModel }),
          makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: workspaceA, model: codexModel })
        ],
        root: workspaceA
      })
    },
    {
      name: 'binding.model divergente do AIThread.model',
      reasons: ['MODEL_MISMATCH'],
      build: (snapshot) => ({
        snapshot,
        threads: [
          makeThread({ id: ollamaThread, provider: 'ollama', workspaceRoot: workspaceA, model: 'outro-modelo' }),
          makeThread({ id: codexThread, provider: 'codex-app-server', workspaceRoot: workspaceA, model: codexModel })
        ],
        root: workspaceA
      })
    },
    {
      name: 'binding.model null contra AIThread.model string',
      reasons: ['MODEL_MISMATCH'],
      build: (snapshot) => ({
        snapshot: {
          ...snapshot,
          providerBindings: [{ provider: 'ollama', threadId: ollamaThread, model: null }, ...snapshot.providerBindings.slice(1)]
        },
        threads: makeThreads(workspaceA),
        root: workspaceA
      })
    },
    {
      name: 'turn sem binding compatível do provider',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({
        snapshot: { ...snapshot, turns: snapshot.turns.map((turn, index) => index === 1 ? { ...turn, threadId: 'thread-estranha' } : turn) },
        threads: makeThreads(workspaceA),
        root: workspaceA
      })
    },
    {
      name: 'seen inválido (referencia turn não retido)',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({
        snapshot: { ...snapshot, seenByProvider: { ollama: [randomUUID()] } },
        threads: makeThreads(workspaceA),
        root: workspaceA
      })
    },
    {
      name: 'schema inválido (campo privilegiado extra)',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({
        snapshot: { ...snapshot, pendingByTurn: {} } as unknown as TupiniquimDurableSnapshot,
        threads: makeThreads(workspaceA),
        root: workspaceA
      })
    },
    {
      name: 'snapshot relacionalmente inconsistente (turn de outra sessão)',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({
        snapshot: { ...snapshot, turns: snapshot.turns.map((turn, index) => index === 0 ? { ...turn, sessionId: randomUUID() } : turn) },
        threads: makeThreads(workspaceA),
        root: workspaceA
      })
    },
    {
      name: 'dois bindings para o mesmo provider',
      reasons: ['SNAPSHOT_INVALID'],
      build: (snapshot) => ({
        snapshot: { ...snapshot, providerBindings: [...snapshot.providerBindings, { provider: 'ollama' as const, threadId: 'thread-outra', model: 'outro' }] },
        threads: [...makeThreads(workspaceA), makeThread({ id: 'thread-outra', provider: 'ollama', workspaceRoot: workspaceA, model: 'outro' })],
        root: workspaceA
      })
    }
  ]

  for (const corruption of corruptions) {
    it(`rejeita ${corruption.name} sem instalar binding, turn ou seen parcial`, async () => {
      const valid = makeSnapshot(workspaceA)
      const { snapshot, threads, root } = corruption.build(valid)

      // 1) Serviço virgem: nenhuma mutação de estado (nem sessão vazia é criada).
      const pristine = new TupiniquimSessionService()
      const direct = pristine.hydrateWorkspace(snapshot, threads, root)
      expect(direct.status).toBe('REJECTED')
      if (direct.status !== 'REJECTED') throw new Error('Hydrate deveria ter sido rejeitado.')
      expect(direct.reasons).toEqual(corruption.reasons)
      expect(pristine.hasWorkspace(root)).toBe(false)
      expect(pristine.current()).toBeNull()

      // 2) Fluxo workspace.configure: sessão NOVA LIMPA para aquele workspace.
      const { sessions, snapshots, threads: threadRepository, recovery } = fixture()
      threadRepository.byId.clear()
      for (const thread of threads) threadRepository.byId.set(thread.id, thread)
      snapshots.byRoot.set(root, { status: 'VALID', snapshot })
      const restored = await recovery.restore(root)
      expect(restored.outcome).toBe('REJECTED')
      expect(restored.reasons).toEqual(corruption.reasons)
      expect(restored.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
      expect(restored.session.id).not.toBe(snapshot.session.id)
      expect(sessions.snapshot()).toMatchObject({
        session: { id: restored.session.id, workspaceRoot: root },
        turns: [],
        providerThreads: [],
        proposalAuthority: null
      })
      expect(sessions.threadFor('ollama')).toBeUndefined()
      expect(sessions.threadFor('codex-app-server')).toBeUndefined()
      expect(sessions.modelFor('ollama')).toBeNull()
      expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
      expect(sessions.ephemeralLifecycle()).toEqual({
        authority: null,
        proposalIds: 0,
        inProgress: 0,
        pending: 0,
        settledSuccess: 0,
        settledFailure: 0,
        finalizedTurns: 0,
        unsuccessfulTurns: 0
      })

      // 3) Diagnóstico sanitizado: reason code estável, sem workspace/conversa/secret.
      expect(restored.diagnostic).toContain('outcome=REJECTED')
      for (const reason of corruption.reasons) expect(restored.diagnostic).toContain(reason)
      expect(restored.diagnostic).toContain('workspace=[REDACTED]')
      expect(restored.diagnostic).not.toContain(workspaceA)
      expect(restored.diagnostic).not.toContain(workspaceB)
      expect(restored.diagnostic).not.toContain('turno público')
      expect(restored.diagnostic).not.toContain(privateMarker)
    })
  }

  it('rejeição não vaza metadado de workspace nem texto de conversa nas violações', () => {
    const sessions = new TupiniquimSessionService()
    const snapshot = makeSnapshot(workspaceA)
    const result = sessions.hydrateWorkspace(snapshot, [], workspaceA)
    if (result.status !== 'REJECTED') throw new Error('Hydrate deveria ter sido rejeitado.')
    const details = result.provenanceViolations.map((violation) => violation.detail).join(' ')
    expect(details).not.toContain(workspaceA)
    expect(details).not.toContain('turno público')
    expect(result.provenanceViolations.every((violation) => violation.reason === 'THREAD_MISSING')).toBe(true)
    expect(result.integrityViolations).toEqual([])
  })
})

describe('TupiniquimSessionRecovery — fluxo workspace.configure', () => {
  it('workspace sem snapshot cria sessão nova limpa e não é erro', async () => {
    const { sessions, snapshots, recovery } = fixture()
    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('NO_SNAPSHOT')
    expect(result.reasons).toEqual([])
    expect(result.snapshotCounts).toBeNull()
    expect(result.restored).toEqual({ turns: 0, bindings: 0, seenProviders: 0 })
    expect(result.diagnostic).toContain('outcome=NO_SNAPSHOT')
    expect(result.diagnostic).toContain('reasons=NONE')
    expect(snapshots.reads).toEqual([workspaceA])
    expect(sessions.snapshot()).toMatchObject({ turns: [], providerThreads: [], proposalAuthority: null })
    expect(sessions.current()?.workspaceRoot).toBe(workspaceA)
  })

  it('snapshot íntegro hidrata a mesma sessão e expõe o estado recuperado em agent.session()', async () => {
    const snapshot = makeSnapshot(workspaceA)
    const { sessions, threads, recovery } = fixture({
      [workspaceA]: { status: 'VALID', snapshot }
    })

    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('HYDRATED')
    expect(result.session.id).toBe(snapshot.session.id)
    expect(result.snapshotCounts).toEqual({ turns: 4, bindings: 2, seenProviders: 1 })
    expect(result.restored).toEqual({ turns: 4, bindings: 2, seenProviders: 1 })
    // Provenance consultada ANTES do hydrate, uma vez por thread distinta.
    expect(threads.reads.sort()).toEqual([codexThread, ollamaThread])
    expect(sessions.current()?.id).toBe(snapshot.session.id)
    expect(sessions.snapshot()?.turns).toHaveLength(4)
    expect(sessions.proposalAuthority()).toBeNull()
  })

  it('snapshot rejeitado pela boundary durável (INVALID) vira sessão nova limpa com SNAPSHOT_INVALID', async () => {
    const { sessions, snapshots, recovery } = fixture({ [workspaceA]: { status: 'INVALID' } })
    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('REJECTED')
    expect(result.reasons).toEqual(['SNAPSHOT_INVALID'])
    expect(sessions.snapshot()?.turns).toEqual([])
    expect(snapshots.reads).toEqual([workspaceA])
  })

  it('falha de I/O na leitura do snapshot é fail-closed (sessão nova limpa, nunca exceção)', async () => {
    const { sessions, snapshots, recovery } = fixture()
    snapshots.failure = new Error('disco indisponível')
    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('REJECTED')
    expect(result.reasons).toEqual(['SNAPSHOT_INVALID'])
    expect(sessions.current()?.workspaceRoot).toBe(workspaceA)
    expect(sessions.snapshot()?.turns).toEqual([])
  })

  it('falha ao ler a AIThread é tratada como thread ausente (THREAD_MISSING)', async () => {
    const snapshot = makeSnapshot(workspaceA)
    const { sessions, threads, recovery } = fixture({ [workspaceA]: { status: 'VALID', snapshot } })
    threads.failure = new Error('banco indisponível')
    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('REJECTED')
    expect(result.reasons).toEqual(['THREAD_MISSING'])
    expect(sessions.snapshot()?.session.id).not.toBe(snapshot.session.id)
    expect(sessions.snapshot()?.providerThreads).toEqual([])
  })

  it('revoga a authority de proposal do workspace anterior ao restaurar outro workspace', async () => {
    const { sessions, recovery } = fixture()
    const openedA = await recovery.restore(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-viva', 'modelo-vivo')
    const proposalId = randomUUID()
    sessions.grantProposalAuthority('ollama', 'thread-viva', proposalId)
    expect(sessions.proposalAuthority()?.proposalIds).toEqual([proposalId])

    const openedB = await recovery.restore(workspaceB)
    expect(openedB.expiredProposalIds).toEqual([proposalId])
    expect(openedB.outcome).toBe('NO_SNAPSHOT')
    expect(openedB.session.id).not.toBe(openedA.session.id)

    const backToA = await recovery.restore(workspaceA)
    expect(backToA.outcome).toBe('LIVE_SESSION')
    expect(backToA.expiredProposalIds).toEqual([])
    expect(sessions.proposalAuthority()).toBeNull()
  })

  it('cross-workspace: snapshot de A não pode usar thread de B mesmo com id, provider e model iguais', async () => {
    const snapshotA = makeSnapshot(workspaceA)
    const { sessions, snapshots, threads, recovery } = fixture()
    // Threads persistidas com o MESMO id/provider/model, mas pertencentes a B.
    for (const thread of makeThreads(workspaceB)) threads.byId.set(thread.id, thread)
    snapshots.byRoot.set(workspaceA, { status: 'VALID', snapshot: snapshotA })

    const result = await recovery.restore(workspaceA)
    expect(result.outcome).toBe('REJECTED')
    expect(result.reasons).toEqual(['WORKSPACE_MISMATCH'])
    expect(sessions.snapshot()?.session.id).not.toBe(snapshotA.session.id)
    expect(sessions.snapshot()?.providerThreads).toEqual([])
    expect(sessions.snapshot()?.turns).toEqual([])
    expect(sessions.threadFor('ollama')).toBeUndefined()
  })
})

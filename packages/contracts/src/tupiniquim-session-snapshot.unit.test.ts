import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  formatTupiniquimSessionRecoveryDiagnostic,
  isTupiniquimModelProvenanceCompatible,
  isTupiniquimSessionSnapshotProvenanceValid,
  maxDurableTupiniquimTurns,
  maxDurableTupiniquimTurnTextChars,
  redactTupiniquimDurableText,
  tupiniquimDurableSnapshotSchema,
  validateTupiniquimSessionSnapshotIntegrity,
  validateTupiniquimSessionSnapshotProvenance,
  type AIThread,
  type TupiniquimDurableSnapshot,
  type TupiniquimSessionProvenanceViolation,
  type TupiniquimSessionRecoveryReason
} from '@tupiniquim/contracts'

/**
 * Wave 16 — contrato durável da Tupiniquim Session: schema (forma) e
 * consistência relacional (validação pura). A integração com SQLite real/v5,
 * atomicidade, retenção e failAfter vivem em tests/integration.
 */

const now = new Date().toISOString()

const makeSession = (workspaceRoot: string): TupiniquimDurableSnapshot['session'] => ({
  id: randomUUID(),
  workspaceRoot,
  createdAt: now,
  updatedAt: now
})

const makeTurn = (
  session: TupiniquimDurableSnapshot['session'],
  index: number,
  role: 'user' | 'assistant' = 'user'
): TupiniquimDurableSnapshot['turns'][number] => ({
  id: randomUUID(),
  sessionId: session.id,
  role,
  text: `turno durável ${index}`,
  provider: 'ollama',
  model: 'modelo-teste',
  threadId: 'thread-ollama',
  turnId: `turno-${index}`,
  createdAt: now
})

const makeSnapshot = (overrides: Partial<TupiniquimDurableSnapshot> = {}): TupiniquimDurableSnapshot => {
  const session = makeSession('/tmp/workspace-duravel')
  const turns = [makeTurn(session, 1), makeTurn(session, 2, 'assistant')]
  return {
    session,
    turns,
    providerBindings: [{ provider: 'ollama', threadId: 'thread-ollama', model: 'modelo-teste' }],
    seenByProvider: { ollama: [turns[0]?.id ?? ''] },
    ...overrides
  }
}

describe('contrato durável do snapshot da sessão Tupiniquim', () => {
  it('aceita snapshot durável íntegro', () => {
    const snapshot = makeSnapshot()
    expect(tupiniquimDurableSnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejeita campos privilegiados extras (strict, fail-closed) em vez de descartá-los', () => {
    const snapshot = makeSnapshot()
    // Campos efêmeros/privilegiados não fazem parte do contrato e são REJEITADOS
    // pelo schema strict — nunca silenciosamente stripped.
    expect(tupiniquimDurableSnapshotSchema.safeParse({
      ...snapshot,
      proposalAuthority: { provider: 'ollama', threadId: 'thread-ollama', proposalIds: [randomUUID()] }
    }).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, proposalIds: [randomUUID()] }).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, privateProposalPayload: 'conteúdo privado' }).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, pendingByTurn: {}, inProgress: {}, settledSuccess: [], settledFailure: [], finalizedTurns: [] }).success).toBe(false)
    // Campo extra dentro de um durable turn também é rejeitado (strict no turn).
    expect(tupiniquimDurableSnapshotSchema.safeParse({
      ...snapshot,
      turns: [{ ...snapshot.turns[0]!, payloadPrivado: 'x' }]
    }).success).toBe(false)
  })

  it('rejeita texto de turn acima do limite durável de 2.000 chars após redaction', () => {
    const snapshot = makeSnapshot({
      turns: [makeTurn(makeSession('/tmp/ws'), 1)]
    })
    const long = { ...snapshot, turns: [{ ...snapshot.turns[0]!, text: 'x'.repeat(maxDurableTupiniquimTurnTextChars + 1) }] }
    expect(tupiniquimDurableSnapshotSchema.safeParse(long).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejeita turns não públicos (error/system) no contrato durável', () => {
    const snapshot = makeSnapshot()
    const errorTurn = { ...makeTurn(snapshot.session, 3), role: 'error' as const }
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, turns: [errorTurn] }).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, turns: [...snapshot.turns, errorTurn] }).success).toBe(false)
  })

  it('rejeita snapshot acima da retenção de 200 turns', () => {
    const session = makeSession('/tmp/ws-cap')
    const turns = Array.from({ length: maxDurableTupiniquimTurns + 1 }, (_, index) => makeTurn(session, index))
    const snapshot = makeSnapshot({ session, turns, seenByProvider: {} })
    expect(tupiniquimDurableSnapshotSchema.safeParse(snapshot).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, turns: turns.slice(0, maxDurableTupiniquimTurns) }).success).toBe(true)
  })

  it('rejeita seen com id fora do formato uuid ou provider desconhecido', () => {
    const snapshot = makeSnapshot()
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, seenByProvider: { ollama: ['nao-e-uuid'] } }).success).toBe(false)
    expect(tupiniquimDurableSnapshotSchema.safeParse({ ...snapshot, seenByProvider: { 'provider-desconhecido': [] } }).success).toBe(false)
  })
})

describe('redactor canônico da boundary durável', () => {
  it('redige secrets reais de teste e preserva menção textual a .env', () => {
    const samples = [
      'chave sk-proj-EXAMPLE123456789 usada',
      'header authorization=BearerExampleSecret fim',
      'linha api_key=ExampleSecretValue',
      'config token=ExampleSecretValue fim'
    ]
    for (const sample of samples) {
      expect(sample).not.toContain('[REDACTED]')
      expect(redactTupiniquimDurableText(sample)).toContain('[REDACTED]')
    }
    expect(redactTupiniquimDurableText('sk-proj-EXAMPLE123456789')).toBe('[REDACTED]')
    expect(redactTupiniquimDurableText('authorization=BearerExampleSecret')).toBe('authorization=[REDACTED]')
    expect(redactTupiniquimDurableText('api_key=ExampleSecretValue')).toBe('api_key=[REDACTED]')
    expect(redactTupiniquimDurableText('token=ExampleSecretValue')).toBe('token=[REDACTED]')
    // Menção textual a .env permanece permitida e preservada.
    expect(redactTupiniquimDurableText('.env')).toBe('.env')
    expect(redactTupiniquimDurableText('carregue o arquivo .env manualmente')).toBe('carregue o arquivo .env manualmente')
  })

  it('impõe o limite durável final de 2.000 chars após redaction', () => {
    const long = `texto ${'x'.repeat(2_500)}`
    const redacted = redactTupiniquimDurableText(long)
    expect(redacted).toHaveLength(2_000)
    expect(redacted.startsWith('texto ')).toBe(true)
  })
})

describe('validação relacional do snapshot durável (fail-closed)', () => {
  it('não aponta violações para snapshot íntegro', () => {
    const snapshot = makeSnapshot()
    expect(validateTupiniquimSessionSnapshotIntegrity(snapshot, snapshot.session.workspaceRoot)).toEqual([])
  })

  it('detecta workspaceRoot divergente da raiz consultada', () => {
    const snapshot = makeSnapshot()
    const violations = validateTupiniquimSessionSnapshotIntegrity(snapshot, '/tmp/outro-workspace')
    expect(violations.some((item) => item.includes('workspaceRoot'))).toBe(true)
  })

  it('detecta turn com sessionId de outra sessão', () => {
    const snapshot = makeSnapshot()
    const otherSession = makeSession(snapshot.session.workspaceRoot)
    const corrupted = { ...snapshot, turns: [{ ...snapshot.turns[0]!, sessionId: otherSession.id }] }
    const violations = validateTupiniquimSessionSnapshotIntegrity(corrupted, snapshot.session.workspaceRoot)
    expect(violations.some((item) => item.includes('outra sessão'))).toBe(true)
  })

  it('detecta ids de turn duplicados', () => {
    const snapshot = makeSnapshot()
    const duplicated = { ...snapshot, turns: [snapshot.turns[0]!, { ...snapshot.turns[0]!, text: 'cópia' }] }
    const violations = validateTupiniquimSessionSnapshotIntegrity(duplicated, snapshot.session.workspaceRoot)
    expect(violations.some((item) => item.includes('duplicado'))).toBe(true)
  })

  it('detecta binding duplicado para o mesmo provider', () => {
    const snapshot = makeSnapshot()
    const duplicated = {
      ...snapshot,
      providerBindings: [
        snapshot.providerBindings[0]!,
        { provider: 'ollama' as const, threadId: 'thread-ollama-b', model: null }
      ]
    }
    const violations = validateTupiniquimSessionSnapshotIntegrity(duplicated, snapshot.session.workspaceRoot)
    expect(violations.some((item) => item.includes('provider ollama'))).toBe(true)
  })

  it('detecta thread compartilhada entre providers no mesmo workspace', () => {
    const snapshot = makeSnapshot()
    const shared = {
      ...snapshot,
      providerBindings: [
        snapshot.providerBindings[0]!,
        { provider: 'codex-app-server' as const, threadId: 'thread-ollama', model: null }
      ]
    }
    const violations = validateTupiniquimSessionSnapshotIntegrity(shared, snapshot.session.workspaceRoot)
    expect(violations.some((item) => item.includes('thread-ollama'))).toBe(true)
  })

  it('detecta turn com thread sem binding compatível do provider', () => {
    const snapshot = makeSnapshot()
    const orphan = { ...snapshot, turns: [{ ...snapshot.turns[0]!, threadId: 'thread-estranha' }] }
    const violations = validateTupiniquimSessionSnapshotIntegrity(orphan, snapshot.session.workspaceRoot)
    expect(violations.some((item) => item.includes('sem binding compatível'))).toBe(true)
  })

  it('detecta seen apontando para turn não retido', () => {
    const snapshot = makeSnapshot()
    const droppedId = randomUUID()
    const violations = validateTupiniquimSessionSnapshotIntegrity(
      { ...snapshot, seenByProvider: { ollama: [snapshot.turns[0]!.id, droppedId] } },
      snapshot.session.workspaceRoot
    )
    expect(violations.some((item) => item.includes('turn não retido') && item.includes(droppedId))).toBe(true)
  })

  it('não cria violações para seen vazio ou turn sem provider/thread', () => {
    const session = makeSession('/tmp/ws-null')
    const turn = { ...makeTurn(session, 1), provider: null, model: null, threadId: null, turnId: null }
    const snapshot = makeSnapshot({ session, turns: [turn], providerBindings: [], seenByProvider: {} })
    expect(validateTupiniquimSessionSnapshotIntegrity(snapshot, session.workspaceRoot)).toEqual([])
  })
})

/**
 * Wave 16 — Incremento 2/4: provenance de recovery contra a AIThread persistida.
 * Validação pura (sem I/O): binding → thread existente → provider/workspace/model,
 * e turn → binding. Qualquer elo quebrado é rejeição fail-closed.
 */
const durableWorkspaceRoot = '/tmp/workspace-duravel'

const makeThread = (overrides: Partial<AIThread> = {}): AIThread => ({
  id: 'thread-ollama',
  provider: 'ollama',
  workspaceRoot: durableWorkspaceRoot,
  model: 'modelo-teste',
  createdAt: now,
  updatedAt: now,
  ...overrides
})

const reasonsOf = (violations: readonly TupiniquimSessionProvenanceViolation[]): TupiniquimSessionRecoveryReason[] =>
  violations.map((violation) => violation.reason)

describe('provenance do snapshot contra AIThread persistida (Incremento 2)', () => {
  it('aceita provenance íntegra: binding → AIThread → provider/workspace/model e turn → binding', () => {
    const snapshot = makeSnapshot()
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [makeThread()], durableWorkspaceRoot)
    expect(violations).toEqual([])
    expect(isTupiniquimSessionSnapshotProvenanceValid(snapshot, [makeThread()], durableWorkspaceRoot)).toBe(true)
  })

  it('rejeita binding com thread inexistente ou com registro ilegível (THREAD_MISSING)', () => {
    const snapshot = makeSnapshot()
    expect(reasonsOf(validateTupiniquimSessionSnapshotProvenance(snapshot, [], durableWorkspaceRoot))).toEqual(['THREAD_MISSING'])
    // Registro cru fora do aiThreadSchema (ex.: linha corrompida do SQLite) é
    // tratado como thread ausente — nunca como provenance válida.
    const illegible = { id: 'thread-ollama', provider: 'ollama' } as unknown as AIThread
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [illegible], durableWorkspaceRoot)
    expect(reasonsOf(violations)).toEqual(['THREAD_MISSING'])
    expect(violations[0]?.provider).toBe('ollama')
    expect(violations[0]?.threadId).toBe('thread-ollama')
  })

  it('rejeita AIThread de outro provider (PROVIDER_MISMATCH)', () => {
    const snapshot = makeSnapshot()
    const violations = validateTupiniquimSessionSnapshotProvenance(
      snapshot,
      [makeThread({ provider: 'codex-app-server' })],
      durableWorkspaceRoot
    )
    expect(reasonsOf(violations)).toEqual(['PROVIDER_MISMATCH'])
  })

  it('rejeita thread de outro workspace mesmo com id, provider e model iguais (WORKSPACE_MISMATCH)', () => {
    const snapshot = makeSnapshot()
    const foreign = makeThread({ workspaceRoot: '/tmp/workspace-vizinho' })
    expect(foreign.id).toBe(snapshot.providerBindings[0]?.threadId)
    expect(foreign.provider).toBe(snapshot.providerBindings[0]?.provider)
    expect(foreign.model).toBe(snapshot.providerBindings[0]?.model)
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [foreign], durableWorkspaceRoot)
    expect(reasonsOf(violations)).toEqual(['WORKSPACE_MISMATCH'])
  })

  it('rejeita workspaceRoot da sessão divergente da raiz solicitada (SNAPSHOT_INVALID)', () => {
    const snapshot = makeSnapshot()
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [makeThread()], '/tmp/outro-workspace')
    expect(reasonsOf(violations)).toContain('SNAPSHOT_INVALID')
    // Metadado de workspace nunca aparece no detalhe sanitizado.
    expect(violations.map((violation) => violation.detail).join(' ')).not.toContain('/tmp/outro-workspace')
  })

  it('aplica a regra determinística de model provenance sem corrigir nem copiar', () => {
    expect(isTupiniquimModelProvenanceCompatible(null, null)).toBe(true)
    expect(isTupiniquimModelProvenanceCompatible('modelo-teste', 'modelo-teste')).toBe(true)
    expect(isTupiniquimModelProvenanceCompatible('modelo-teste', null)).toBe(false)
    expect(isTupiniquimModelProvenanceCompatible(null, 'modelo-teste')).toBe(false)
    expect(isTupiniquimModelProvenanceCompatible('modelo-a', 'modelo-b')).toBe(false)

    const snapshot = makeSnapshot()
    const divergent = validateTupiniquimSessionSnapshotProvenance(snapshot, [makeThread({ model: 'outro-modelo' })], durableWorkspaceRoot)
    expect(reasonsOf(divergent)).toEqual(['MODEL_MISMATCH'])
    // null (thread) × string (binding) também é rejeição.
    const nullThreadModel = validateTupiniquimSessionSnapshotProvenance(snapshot, [makeThread({ model: null })], durableWorkspaceRoot)
    expect(reasonsOf(nullThreadModel)).toEqual(['MODEL_MISMATCH'])
    // string (thread) × null (binding) também é rejeição.
    const nullBindingModel = makeSnapshot({ providerBindings: [{ provider: 'ollama', threadId: 'thread-ollama', model: null }] })
    expect(reasonsOf(validateTupiniquimSessionSnapshotProvenance(nullBindingModel, [makeThread()], durableWorkspaceRoot))).toEqual(['MODEL_MISMATCH'])
    // ambos null é válido.
    const bothNull = makeSnapshot({
      providerBindings: [{ provider: 'ollama', threadId: 'thread-ollama', model: null }],
      turns: [],
      seenByProvider: {}
    })
    expect(validateTupiniquimSessionSnapshotProvenance(bothNull, [makeThread({ model: null })], durableWorkspaceRoot)).toEqual([])
  })

  it('rejeita turn sem binding compatível já validado contra AIThread (SNAPSHOT_INVALID)', () => {
    const snapshot = makeSnapshot()
    const orphanThread = { ...snapshot, turns: [{ ...snapshot.turns[0]!, threadId: 'thread-estranha' }] }
    expect(reasonsOf(validateTupiniquimSessionSnapshotProvenance(orphanThread, [makeThread()], durableWorkspaceRoot))).toContain('SNAPSHOT_INVALID')

    const orphanProvider = {
      ...snapshot,
      turns: [{ ...snapshot.turns[0]!, provider: 'codex-app-server' as const, model: 'modelo-codex' }]
    }
    const violations = validateTupiniquimSessionSnapshotProvenance(orphanProvider, [makeThread()], durableWorkspaceRoot)
    expect(reasonsOf(violations)).toContain('SNAPSHOT_INVALID')
    expect(violations.some((violation) => violation.turnId === snapshot.turns[0]?.id)).toBe(true)
  })

  it('fecha a cadeia turn → binding → AIThread: thread inválida contamina o turn do provider', () => {
    const snapshot = makeSnapshot()
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [makeThread({ provider: 'codex-app-server' })], durableWorkspaceRoot)
    expect(reasonsOf(violations)).toEqual(['PROVIDER_MISMATCH'])
    expect(isTupiniquimSessionSnapshotProvenanceValid(snapshot, [makeThread({ provider: 'codex-app-server' })], durableWorkspaceRoot)).toBe(false)
  })

  it('deduplica e ordena reason codes no diagnóstico sanitizado sem vazar metadado privado', () => {
    const session = makeSession(durableWorkspaceRoot)
    const snapshot = makeSnapshot({
      session,
      turns: [
        { ...makeTurn(session, 1), text: 'CONVERSA_PRIVADA token=ExampleSecretValue' },
        { ...makeTurn(session, 2), threadId: 'thread-estranha' }
      ],
      seenByProvider: {}
    })
    const violations = validateTupiniquimSessionSnapshotProvenance(snapshot, [], '/tmp/outro-workspace')
    const diagnostic = formatTupiniquimSessionRecoveryDiagnostic({
      outcome: 'REJECTED',
      reasons: violations.map((violation) => violation.reason),
      snapshot: { turns: snapshot.turns.length, bindings: snapshot.providerBindings.length, seenProviders: 0 },
      restored: { turns: 0, bindings: 0, seenProviders: 0 }
    })
    expect(diagnostic).toContain('outcome=REJECTED')
    expect(diagnostic).toContain('THREAD_MISSING')
    expect(diagnostic).toContain('workspace=[REDACTED]')
    expect(diagnostic).not.toContain('/tmp/outro-workspace')
    expect(diagnostic).not.toContain(durableWorkspaceRoot)
    expect(diagnostic).not.toContain('CONVERSA_PRIVADA')
    expect(diagnostic).not.toContain('ExampleSecretValue')
    expect(diagnostic).not.toContain('thread-estranha')
    // Ordem canônica e sem repetição, mesmo com várias violações do mesmo código.
    expect(diagnostic.match(/THREAD_MISSING/g)).toHaveLength(1)
    expect(formatTupiniquimSessionRecoveryDiagnostic({
      outcome: 'HYDRATED',
      reasons: [],
      snapshot: null,
      restored: { turns: 3, bindings: 2, seenProviders: 1 }
    })).toContain('reasons=NONE')
  })
})

import { z } from 'zod'
import { aiProviderKinds, aiThreadSchema, tupiniquimProviderBindingSchema, tupiniquimSessionSchema, tupiniquimTurnSchema, type AIProviderKind, type AIThread, type TupiniquimProviderBinding } from './ai'

/**
 * Wave 16 — durable Tupiniquim Session snapshot contract.
 *
 * Persistência/recuperação da sessão é um ÚNICO snapshot consistente por
 * workspace: session + turns públicos retidos + provider bindings + seen
 * cursors. Authority de proposal, proposalIds, pendingByTurn, inProgress,
 * settledSuccess/settledFailure, finalizedTurns, terminalTurns e payload
 * privado de workspace.write NUNCA fazem parte deste contrato.
 *
 * Fail-closed: os schemas deste contrato são STRICT — qualquer campo extra
 * (privilegiado ou acidental) é rejeitado, nunca silenciosamente descartado.
 */

/** Política de retenção durável: últimos 200 Tupiniquim turns públicos por workspace. */
export const maxDurableTupiniquimTurns = 200

/** Limite durável de texto por turn após redaction (boundary aplica o mesmo limite). */
export const maxDurableTupiniquimTurnTextChars = 2_000

/**
 * Redactor canônico da boundary durável (contracts/shared, sem dependency
 * cycle: contracts é folha e core/adapters dependem dele). Garante que
 * nenhum secret bruto chega ao SQLite mesmo que o chamador não tenha passado
 * pelo redaction do runtime: substitui secrets por [REDACTED] e corta em
 * maxDurableTupiniquimTurnTextChars. Menção textual a ".env" NÃO é redigida.
 */
export const redactTupiniquimDurableText = (value: string): string => value
  .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu, '[REDACTED]')
  .replace(/(authorization|api[_-]?key|token)\s*[:=]\s*\S+/giu, '$1=[REDACTED]')
  .slice(0, maxDurableTupiniquimTurnTextChars)

/** Turns duráveis são somente conversa pública redigida (user/assistant), strict. */
export const tupiniquimDurableTurnSchema = tupiniquimTurnSchema.extend({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(maxDurableTupiniquimTurnTextChars)
}).strict()
export type TupiniquimDurableTurn = z.infer<typeof tupiniquimDurableTurnSchema>

export const tupiniquimSeenByProviderSchema = z.record(z.string(), z.array(z.string().uuid())).refine(
  (seen) => Object.keys(seen).every((provider) => (aiProviderKinds as readonly string[]).includes(provider)),
  { message: 'seenByProvider contém provider desconhecido.' }
)
export type TupiniquimSeenByProvider = z.infer<typeof tupiniquimSeenByProviderSchema>

export const tupiniquimDurableSnapshotSchema = z.object({
  session: tupiniquimSessionSchema,
  turns: z.array(tupiniquimDurableTurnSchema).max(maxDurableTupiniquimTurns),
  providerBindings: z.array(tupiniquimProviderBindingSchema),
  seenByProvider: tupiniquimSeenByProviderSchema
}).strict()
export type TupiniquimDurableSnapshot = z.infer<typeof tupiniquimDurableSnapshotSchema>

/**
 * Wave 16 — Incremento 3/4 (MODEL PROVENANCE REAL): semântica da operação
 * SQLite ÚNICA `putTupiniquimSessionSnapshotWithThreadModel(snapshot)`.
 *
 * Os próprios `providerBindings` do snapshot são a fonte da verdade do model
 * corrente de cada thread da sessão. Na MESMA transação (BEGIN IMMEDIATE /
 * COMMIT; ROLLBACK em erro) o worker:
 *
 * 1. para cada binding do snapshot, lê a AIThread persistida, valida
 *    provider e workspaceRoot (iguais aos do binding/sessão) e atualiza
 *    `ai_threads.model` para `binding.model` quando divergente;
 * 2. escreve o snapshot integral (session + turns + bindings + seen).
 *
 * Coerência atômica por construção: nunca existe estado commitado com
 * `AIThread.model` novo + snapshot antigo, nem snapshot novo + `AIThread.model`
 * antigo. Crash antes do COMMIT preserva o estado anterior consistente; crash
 * depois do COMMIT deixa o estado novo consistente (thread + binding + novo
 * turn com o model REAL do request).
 */

/**
 * Wave 16 — Incremento 2/4: resultado discriminado da leitura durável.
 *
 * Distingue os dois "null" que a boundary do Incremento 1 colapsava:
 * - `ABSENT`  → workspace sem snapshot v5 (comportamento NORMAL, não erro);
 * - `INVALID` → snapshot existe no SQLite mas foi rejeitado na leitura
 *               (schema inválido, posições/ordem inconsistentes, payload
 *               corrompido, violação relacional ou seen órfão);
 * - `VALID`   → snapshot íntegro no nível durável, ainda sujeito à validação de
 *               provenance contra a AIThread persistida antes do hydrate.
 *
 * Essa distinção existe apenas para o diagnóstico sanitizado de recovery: em
 * ABSENT e INVALID o resultado operacional é o mesmo (sessão nova limpa, zero
 * estado parcial).
 */
export type TupiniquimSessionSnapshotRead =
  | { status: 'ABSENT' }
  | { status: 'INVALID' }
  | { status: 'VALID'; snapshot: TupiniquimDurableSnapshot }

/**
 * Valida a consistência relacional de um snapshot durável já conformante ao
 * schema. Retorna a lista de violações (vazia = íntegro). Usado pelo
 * getTupiniquimSessionSnapshot (fail-closed na leitura), pelo
 * putTupiniquimSessionSnapshot (validação pré-commit, zero escrita) e pelos
 * testes.
 *
 * Esta é a validação RELACIONAL (Incremento 1): o snapshot é internamente
 * consistente. A validação de PROVENANCE contra a AIThread persistida
 * (binding → thread existente, provider da thread, workspaceRoot da thread e
 * modelo) é complementar e vive em
 * validateTupiniquimSessionSnapshotProvenance (Incremento 2). O hydrate da
 * sessão exige as DUAS: nenhuma delas sozinha estabelece provenance.
 */
export const validateTupiniquimSessionSnapshotIntegrity = (
  snapshot: TupiniquimDurableSnapshot,
  expectedWorkspaceRoot?: string
): readonly string[] => {
  const violations: string[] = []
  const { session, turns, providerBindings, seenByProvider } = snapshot

  if (expectedWorkspaceRoot !== undefined && session.workspaceRoot !== expectedWorkspaceRoot) {
    violations.push(`workspaceRoot da sessão diverge da raiz consultada: '${session.workspaceRoot}'.`)
  }

  const seenTurnIds = new Set<string>()
  for (const turn of turns) {
    if (turn.sessionId !== session.id) {
      violations.push(`Turn ${turn.id} pertence a outra sessão (sessionId divergente).`)
    }
    if (seenTurnIds.has(turn.id)) {
      violations.push(`Turn duplicado: ${turn.id}.`)
    }
    seenTurnIds.add(turn.id)
  }

  const bindingByProvider = new Map<string, TupiniquimDurableSnapshot['providerBindings'][number]>()
  const boundThreadIds = new Set<string>()
  for (const binding of providerBindings) {
    const existing = bindingByProvider.get(binding.provider)
    if (existing !== undefined) {
      violations.push(`Binding duplicado para o provider ${binding.provider}.`)
    } else {
      bindingByProvider.set(binding.provider, binding)
    }
    if (boundThreadIds.has(binding.threadId)) {
      violations.push(`Binding duplicado para a thread ${binding.threadId}.`)
    }
    boundThreadIds.add(binding.threadId)
  }

  for (const turn of turns) {
    if (turn.threadId === null) continue
    if (turn.provider === null) {
      violations.push(`Turn ${turn.id} referencia thread ${turn.threadId} sem provider.`)
      continue
    }
    const binding = bindingByProvider.get(turn.provider)
    if (binding === undefined || binding.threadId !== turn.threadId) {
      violations.push(`Turn ${turn.id} referencia a thread ${turn.threadId} sem binding compatível do provider ${turn.provider}.`)
    }
  }

  for (const [provider, turnIds] of Object.entries(seenByProvider)) {
    for (const turnId of turnIds) {
      if (!seenTurnIds.has(turnId)) {
        violations.push(`seen do provider ${provider} referencia turn não retido: ${turnId}.`)
      }
    }
  }

  return violations
}

export const isTupiniquimSessionSnapshotIntegrityValid = (
  snapshot: TupiniquimDurableSnapshot,
  expectedWorkspaceRoot?: string
): boolean => validateTupiniquimSessionSnapshotIntegrity(snapshot, expectedWorkspaceRoot).length === 0

/**
 * Wave 16 — Incremento 2/4: provenance de recovery (hydrate) da Tupiniquim
 * Session contra a AIThread persistida.
 *
 * Invariante central: `Tupiniquim Session != Provider Thread`. Um snapshot só
 * pode ser hidratado se TODA a cadeia de provenance for válida:
 *
 *   turn → binding → AIThread → provider / workspaceRoot / model
 *
 * Se qualquer elo falhar, o snapshot é integralmente rejeitado (fail-closed):
 * nenhum binding parcial, nenhum turn parcial, nenhum seen parcial.
 *
 * Regra determinística de MODEL PROVENANCE (sem correção silenciosa e sem
 * copiar model de um lado para o outro):
 * - ambos null → válido;
 * - ambos string → devem ser exatamente iguais;
 * - um null e o outro string → inválido.
 */

/** Códigos estáveis de rejeição de recovery (sem metadado de workspace, sem texto de conversa). */
export const tupiniquimSessionRecoveryReasons = [
  'SNAPSHOT_INVALID',
  'THREAD_MISSING',
  'PROVIDER_MISMATCH',
  'WORKSPACE_MISMATCH',
  'MODEL_MISMATCH'
] as const
export type TupiniquimSessionRecoveryReason = (typeof tupiniquimSessionRecoveryReasons)[number]

export interface TupiniquimSessionProvenanceViolation {
  reason: TupiniquimSessionRecoveryReason
  provider: AIProviderKind | null
  threadId: string | null
  turnId: string | null
  /** Detalhe sanitizado: somente identificadores; nunca caminho de workspace, texto de conversa, secret, token ou payload de proposal. */
  detail: string
}

/** Contagens não sensíveis usadas no diagnóstico sanitizado de recovery. */
export interface TupiniquimSessionRecoveryCounts {
  turns: number
  bindings: number
  seenProviders: number
}

export const emptyTupiniquimSessionRecoveryCounts: TupiniquimSessionRecoveryCounts = {
  turns: 0,
  bindings: 0,
  seenProviders: 0
}

/**
 * Compatibilidade determinística de modelo entre binding da sessão Tupiniquim
 * e AIThread persistida do provider. Nunca corrige, nunca completa: divergência
 * (inclusive null × string) é rejeição.
 */
export const isTupiniquimModelProvenanceCompatible = (
  bindingModel: string | null,
  threadModel: string | null
): boolean => bindingModel === null ? threadModel === null : threadModel === bindingModel

const provenanceViolation = (
  reason: TupiniquimSessionRecoveryReason,
  detail: string,
  scope: { provider?: AIProviderKind | null; threadId?: string | null; turnId?: string | null } = {}
): TupiniquimSessionProvenanceViolation => ({
  reason,
  provider: scope.provider ?? null,
  threadId: scope.threadId ?? null,
  turnId: scope.turnId ?? null,
  detail
})

/**
 * Valida a provenance de um snapshot durável contra as AIThreads persistidas
 * já resolvidas pelo chamador (`database.getAIThread(binding.threadId)` para
 * cada binding, ANTES do hydrate). Pura e síncrona: não faz I/O, portanto é
 * testável isoladamente e reutilizável por core/adapters.
 *
 * Cada registro recebido é revalidado pelo aiThreadSchema (defesa contra linha
 * crua do SQLite): registro ausente OU ilegível é tratado como thread ausente.
 *
 * Ordem determinística das verificações por binding:
 * 1. thread existente/legível e com o id solicitado → THREAD_MISSING;
 * 2. AIThread.provider == binding.provider → PROVIDER_MISMATCH;
 * 3. AIThread.workspaceRoot == snapshot.session.workspaceRoot → WORKSPACE_MISMATCH
 *    (cross-workspace: mesma thread, mesmo provider e mesmo model de outro
 *    workspace continuam sendo rejeição);
 * 4. model compatível pela regra determinística → MODEL_MISMATCH.
 *
 * Em seguida, TURN PROVENANCE: todo turn com provider e threadId não nulos
 * precisa apontar para o binding daquele provider (SNAPSHOT_INVALID). Como o
 * binding já foi validado contra a AIThread, isso fecha a cadeia
 * turn → binding → AIThread → provider/workspace/model.
 */
export const validateTupiniquimSessionSnapshotProvenance = (
  snapshot: TupiniquimDurableSnapshot,
  threads: readonly AIThread[],
  expectedWorkspaceRoot?: string
): readonly TupiniquimSessionProvenanceViolation[] => {
  const violations: TupiniquimSessionProvenanceViolation[] = []

  if (expectedWorkspaceRoot !== undefined && snapshot.session.workspaceRoot !== expectedWorkspaceRoot) {
    violations.push(provenanceViolation(
      'SNAPSHOT_INVALID',
      'workspaceRoot da sessão do snapshot diverge da raiz solicitada (metadados de workspace redigidos).'
    ))
  }

  const threadById = new Map<string, AIThread>()
  for (const candidate of threads) {
    const parsed = aiThreadSchema.safeParse(candidate)
    if (parsed.success) threadById.set(parsed.data.id, parsed.data)
  }

  const bindingByProvider = new Map<AIProviderKind, TupiniquimProviderBinding>()
  for (const binding of snapshot.providerBindings) {
    bindingByProvider.set(binding.provider, binding)
    const scope = { provider: binding.provider, threadId: binding.threadId }
    const thread = threadById.get(binding.threadId)
    if (thread === undefined) {
      violations.push(provenanceViolation('THREAD_MISSING', 'AIThread persistida do binding não existe ou é ilegível.', scope))
      continue
    }
    if (thread.id !== binding.threadId) {
      violations.push(provenanceViolation('THREAD_MISSING', 'AIThread resolvida não corresponde ao id do binding.', scope))
      continue
    }
    if (thread.provider !== binding.provider) {
      violations.push(provenanceViolation('PROVIDER_MISMATCH', 'AIThread persistida pertence a outro provider.', scope))
      continue
    }
    if (thread.workspaceRoot !== snapshot.session.workspaceRoot) {
      violations.push(provenanceViolation('WORKSPACE_MISMATCH', 'AIThread persistida pertence a outro workspaceRoot (metadados de workspace redigidos).', scope))
      continue
    }
    if (!isTupiniquimModelProvenanceCompatible(binding.model, thread.model)) {
      violations.push(provenanceViolation('MODEL_MISMATCH', 'model do binding e model da AIThread persistida divergem (null × string ou strings diferentes).', scope))
    }
  }

  for (const turn of snapshot.turns) {
    if (turn.provider === null || turn.threadId === null) continue
    const binding = bindingByProvider.get(turn.provider)
    if (binding === undefined || binding.threadId !== turn.threadId) {
      violations.push(provenanceViolation(
        'SNAPSHOT_INVALID',
        'Turn referencia provider/thread sem binding compatível já validado contra AIThread.',
        { provider: turn.provider, threadId: turn.threadId, turnId: turn.id }
      ))
    }
  }

  return violations
}

export const isTupiniquimSessionSnapshotProvenanceValid = (
  snapshot: TupiniquimDurableSnapshot,
  threads: readonly AIThread[],
  expectedWorkspaceRoot?: string
): boolean => validateTupiniquimSessionSnapshotProvenance(snapshot, threads, expectedWorkspaceRoot).length === 0

/**
 * Diagnóstico sanitizado de recovery: uma única linha estável, sem caminho de
 * workspace, sem texto de conversa, sem secret/token e sem payload de proposal.
 * Única informação do snapshot são contagens e reason codes.
 */
export const formatTupiniquimSessionRecoveryDiagnostic = (input: {
  outcome: string
  reasons: readonly TupiniquimSessionRecoveryReason[]
  snapshot: TupiniquimSessionRecoveryCounts | null
  restored: TupiniquimSessionRecoveryCounts
}): string => {
  const reasons = input.reasons.length === 0
    ? 'NONE'
    : tupiniquimSessionRecoveryReasons.filter((reason) => input.reasons.includes(reason)).join(',')
  const snapshotCounts = input.snapshot === null
    ? 'n/d'
    : `turns=${String(input.snapshot.turns)},bindings=${String(input.snapshot.bindings)},seenProviders=${String(input.snapshot.seenProviders)}`
  return [
    'tupiniquim session recovery',
    `outcome=${input.outcome}`,
    `reasons=${reasons}`,
    `snapshot(${snapshotCounts})`,
    `restored(turns=${String(input.restored.turns)},bindings=${String(input.restored.bindings)},seenProviders=${String(input.restored.seenProviders)})`,
    'workspace=[REDACTED]'
  ].join(' · ')
}

import { z } from 'zod'
import { aiProviderKinds, tupiniquimProviderBindingSchema, tupiniquimSessionSchema, tupiniquimTurnSchema } from './ai'

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
 * Valida a consistência relacional de um snapshot durável já conformante ao
 * schema. Retorna a lista de violações (vazia = íntegro). Usado pelo
 * getTupiniquimSessionSnapshot (fail-closed na leitura), pelo
 * putTupiniquimSessionSnapshot (validação pré-commit, zero escrita) e pelos
 * testes.
 *
 * Validação contra AIThread completa (binding → thread existente, provider da
 * thread, workspaceRoot da thread, modelo) fica para o Incremento 2.
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

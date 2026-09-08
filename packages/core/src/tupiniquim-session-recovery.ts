import {
  emptyTupiniquimSessionRecoveryCounts,
  formatTupiniquimSessionRecoveryDiagnostic,
  type AIThread,
  type TupiniquimDurableSnapshot,
  type TupiniquimSession,
  type TupiniquimSessionRecoveryCounts,
  type TupiniquimSessionRecoveryReason,
  type TupiniquimSessionSnapshotRead
} from '@tupiniquim/contracts'
import type { TupiniquimSessionService } from './tupiniquim-session'

/**
 * Wave 16 — Incremento 2/4: recovery da Tupiniquim Session no fluxo
 * `workspace.configure`.
 *
 * Fluxo canônico (fail-closed integral):
 *
 *   workspace.configure(root)
 *   → root resolvido/autorizado pelo WorkspaceAdapter (fora daqui);
 *   → sessão viva em memória?  → switch/activate SEM hydrate (LIVE_SESSION);
 *   → snapshot durável v5?     → ausente = comportamento normal, sessão nova
 *                                limpa (NO_SNAPSHOT), nunca erro;
 *   → presente                 → validação integral (schema + relacional +
 *                                provenance contra AIThread persistida);
 *       válida                 → hydrate atômico (HYDRATED);
 *       inválida               → NENHUM hydrate parcial, sessão nova limpa e
 *                                diagnóstico sanitizado (REJECTED).
 *
 * Depois o renderer chama `agent.session()` e recebe o estado recuperado.
 *
 * LIMITAÇÃO EXPLÍCITA deste incremento (não escondida): somente a Tupiniquim
 * Session, bindings, turns e seen são restaurados. O `OllamaAdapter` continua
 * com conversations in-memory, portanto um NOVO send Ollama pós-restart sobre a
 * thread restaurada é recusado pelo próprio adapter ("Thread Ollama persistida
 * não pode ser retomada sem o histórico em memória desta sessão."). Ollama
 * conversation hydrate é escopo do Incremento 3.
 *
 * Este módulo NÃO faz write-through (nenhuma escrita de snapshot), NÃO altera
 * shutdown e NÃO toca em `.agent/*`.
 */

export interface TupiniquimSessionSnapshotRepository {
  /** Leitura durável fail-closed com resultado discriminado (ABSENT/INVALID/VALID). */
  readTupiniquimSessionSnapshot(workspaceRoot: string): Promise<TupiniquimSessionSnapshotRead>
}

export interface TupiniquimSessionThreadRepository {
  getAIThread(threadId: string): Promise<AIThread | null>
}

export const tupiniquimSessionRecoveryOutcomes = ['LIVE_SESSION', 'HYDRATED', 'NO_SNAPSHOT', 'REJECTED'] as const
export type TupiniquimSessionRecoveryOutcome = (typeof tupiniquimSessionRecoveryOutcomes)[number]

export interface TupiniquimSessionRecoveryResult {
  outcome: TupiniquimSessionRecoveryOutcome
  /** Sessão ativa depois do restore: hidratada, viva preservada ou nova limpa. */
  session: TupiniquimSession
  /** Reason codes estáveis (somente em REJECTED). */
  reasons: readonly TupiniquimSessionRecoveryReason[]
  /** Contagens do snapshot avaliado (null quando não houve snapshot). */
  snapshotCounts: TupiniquimSessionRecoveryCounts | null
  /** Contagens efetivamente restauradas em memória (zero em REJECTED/NO_SNAPSHOT). */
  restored: TupiniquimSessionRecoveryCounts
  /** Propostas revogadas pela troca de workspace (o chamador as invalida). */
  expiredProposalIds: string[]
  /** Linha única sanitizada: sem caminho de workspace, texto de conversa, secret, token ou payload de proposal. */
  diagnostic: string
}

const snapshotCountsOf = (snapshot: TupiniquimDurableSnapshot): TupiniquimSessionRecoveryCounts => ({
  turns: snapshot.turns.length,
  bindings: snapshot.providerBindings.length,
  seenProviders: Object.keys(snapshot.seenByProvider).length
})

export class TupiniquimSessionRecovery {
  public constructor(
    private readonly sessions: TupiniquimSessionService,
    private readonly snapshots: TupiniquimSessionSnapshotRepository,
    private readonly threads: TupiniquimSessionThreadRepository
  ) {}

  /**
   * Restaura (ou cria limpa) a sessão do workspace e a ativa. Nunca lança por
   * snapshot inválido: rejeição produz sessão nova limpa + diagnóstico.
   */
  public async restore(workspaceRoot: string): Promise<TupiniquimSessionRecoveryResult> {
    // 1) Sessão viva no mesmo processo tem precedência absoluta sobre o SQLite.
    if (this.sessions.hasWorkspace(workspaceRoot)) {
      return this.activate(workspaceRoot, 'LIVE_SESSION', [], null, emptyTupiniquimSessionRecoveryCounts)
    }

    // 2) Snapshot ausente é o caminho normal de workspace novo (não é erro).
    // Snapshot presente mas rejeitado pela boundary durável (schema, ordem,
    // payload corrompido, violação relacional, seen órfão) ou I/O falho é
    // SNAPSHOT_INVALID: sessão nova limpa, zero estado parcial.
    const read = await this.readSnapshot(workspaceRoot)
    if (read.status === 'unreadable' || read.status === 'INVALID') {
      return this.activate(workspaceRoot, 'REJECTED', ['SNAPSHOT_INVALID'], null, emptyTupiniquimSessionRecoveryCounts)
    }
    if (read.status === 'ABSENT') {
      return this.activate(workspaceRoot, 'NO_SNAPSHOT', [], null, emptyTupiniquimSessionRecoveryCounts)
    }
    const snapshot = read.snapshot

    // 3) Provenance ANTES do hydrate: AIThread persistida de cada binding.
    const counts = snapshotCountsOf(snapshot)
    const threads = await this.resolveThreads(snapshot)
    const hydrated = this.sessions.hydrateWorkspace(snapshot, threads, workspaceRoot)
    if (hydrated.status === 'HYDRATED') {
      return this.activate(workspaceRoot, 'HYDRATED', [], counts, hydrated.restored)
    }
    // Corrida: outra configuração criou sessão viva enquanto aguardávamos o I/O.
    if (hydrated.status === 'LIVE_SESSION_PRESERVED') {
      return this.activate(workspaceRoot, 'LIVE_SESSION', [], counts, emptyTupiniquimSessionRecoveryCounts)
    }
    return this.activate(workspaceRoot, 'REJECTED', hydrated.reasons, counts, emptyTupiniquimSessionRecoveryCounts)
  }

  /**
   * Leitura fail-closed do snapshot: falha de I/O no SQLite é tratada como
   * snapshot inutilizável (nunca estado parcial, nunca exceção para o renderer).
   */
  private async readSnapshot(workspaceRoot: string): Promise<TupiniquimSessionSnapshotRead | { status: 'unreadable' }> {
    try {
      return await this.snapshots.readTupiniquimSessionSnapshot(workspaceRoot)
    } catch {
      return { status: 'unreadable' }
    }
  }

  /**
   * Resolve as AIThreads persistidas dos bindings. Thread ausente, ilegível ou
   * erro de leitura simplesmente não entra na lista: a validação de provenance
   * converte a ausência em THREAD_MISSING (fail-closed).
   */
  private async resolveThreads(snapshot: TupiniquimDurableSnapshot): Promise<AIThread[]> {
    const threadIds = [...new Set(snapshot.providerBindings.map((binding) => binding.threadId))]
    const resolved = await Promise.all(threadIds.map(async (threadId) => {
      try {
        return await this.threads.getAIThread(threadId)
      } catch {
        return null
      }
    }))
    return resolved.filter((thread): thread is AIThread => thread !== null)
  }

  /**
   * Ativa o workspace (criando sessão nova limpa quando não há estado instalado)
   * e devolve o resultado com o diagnóstico sanitizado. `switchWorkspace` também
   * revoga a authority de proposal do workspace anterior.
   */
  private activate(
    workspaceRoot: string,
    outcome: TupiniquimSessionRecoveryOutcome,
    reasons: readonly TupiniquimSessionRecoveryReason[],
    snapshotCounts: TupiniquimSessionRecoveryCounts | null,
    restored: TupiniquimSessionRecoveryCounts
  ): TupiniquimSessionRecoveryResult {
    const expiredProposalIds = this.sessions.switchWorkspace(workspaceRoot)
    const session = this.sessions.current()
    if (session === null) throw new Error('A sessão Tupiniquim não foi ativada para o workspace autorizado.')
    return {
      outcome,
      session,
      reasons,
      snapshotCounts,
      restored,
      expiredProposalIds,
      diagnostic: formatTupiniquimSessionRecoveryDiagnostic({ outcome, reasons, snapshot: snapshotCounts, restored })
    }
  }
}

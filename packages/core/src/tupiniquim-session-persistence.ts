import type { AIThread, AgentTurnReference, AIProviderKind, TupiniquimDurableSnapshot } from '@tupiniquim/contracts'
import type { TupiniquimSessionRecovery, TupiniquimSessionRecoveryResult } from './tupiniquim-session-recovery'
import type { TupiniquimSessionService } from './tupiniquim-session'

/**
 * Wave 16 — Incremento 3/4: write-through durável da Tupiniquim Session.
 *
 * O coordinator é a SEÇÃO CRÍTICA de persistência do processo: toda mutação
 * estável da sessão agenda um capture por valor SINCRONO no ponto de mutação
 * e os commits são serializados em uma fila FIFO única — commits nunca
 * reordenam. O estado por workspace continua vivo em memória, então o flush
 * do root que sai na troca de workspace preserva exatamente o snapshot
 * daquele workspace.
 *
 * Pontos de write-through (mutações estáveis):
 * - append de user turn estável + bind de provider thread (commitSendTurn);
 * - assistant/error turn quando o turno fica terminal (schedule em
 *   TURN_COMPLETED/ERROR);
 * - ACK/seen alterado em completion SUCCESS (mesmo flush do término);
 * - troca de workspace: flush do root anterior antes da transição.
 *
 * Deltas parciais de assistant, turns FAILED/CANCELLED e assistants sem user
 * causal nunca entram no snapshot (ver TupiniquimSessionService.durableSnapshotFor).
 *
 * MODEL PROVENANCE REAL: TODO commit do coordinator usa a operação SQLite
 * única `putTupiniquimSessionSnapshotWithThreadModel` — a AIThread persistida
 * de cada binding é atualizada para o model corrente do binding NA MESMA
 * transação do snapshot. Por construção nunca existe estado commitado com
 * AIThread.model novo + snapshot antigo, nem snapshot novo + AIThread.model
 * antigo.
 *
 * Semântica de crash: o último snapshot JÁ COMMITADO permanece íntegro. Uma
 * mutação ainda não commitada pode ser perdida; snapshot parcial/corrompido
 * nunca é aceitável (BEGIN IMMEDIATE/COMMIT/ROLLBACK no worker).
 *
 * Semântica de falha de flush (explícita, nunca silenciosa): o flush que
 * falha NÃO declara durabilidade concluída — o root fica marcado dirty com o
 * último erro, o snapshot anterior commitado permanece integral e a próxima
 * mutação estável reintenta o commit na mesma fila. O gancho `onFlushError`
 * recebe o resultado para o AuditLog sanitizado do main.
 *
 * LIMITAÇÃO EXPLÍCITA (Incremento 4/4): shutdown one-shot aguardável
 * (before-quit esperando a fila) ainda não faz parte deste incremento.
 */

/** Boundary durável exigida do coordinator. `LocalDatabase` satisfaz estruturalmente. */
export interface TupiniquimSessionSnapshotStore {
  putTupiniquimSessionSnapshot(snapshot: TupiniquimDurableSnapshot): Promise<void>
  /**
   * Operação SQLite única: escreve o snapshot E atualiza `ai_threads.model`
   * de cada binding para o model corrente do binding, na mesma transação.
   */
  putTupiniquimSessionSnapshotWithThreadModel(snapshot: TupiniquimDurableSnapshot): Promise<void>
}

export type TupiniquimSnapshotFlushStatus = 'COMMITTED' | 'SKIPPED' | 'FAILED'

export interface TupiniquimSnapshotFlushOutcome {
  workspaceRoot: string
  status: TupiniquimSnapshotFlushStatus
  turns: number
  bindings: number
  seenProviders: number
  /** Somente em FAILED: mensagem de erro (ids/contagens; sem texto de conversa). */
  error?: string
}

export interface TupiniquimSendTurnCommit {
  /** Model EFETIVO do request que executou este turn (provenance real). */
  model: string | null
  /** True quando este send trocou o model corrente da thread vinculada. */
  threadModelSwapped: boolean
  /** Resultado durável do write-through deste turn (nunca lança). */
  flush: TupiniquimSnapshotFlushOutcome
}

export interface TupiniquimSessionSnapshotCoordinatorHooks {
  /** Reporta TODA falha de flush (awaited ou scheduled) para auditoria. */
  onFlushError?: (outcome: TupiniquimSnapshotFlushOutcome) => void
}

export class TupiniquimSessionSnapshotCoordinator {
  /** Seção crítica: fila serializada FIFO de commits; nunca reordena. */
  private chain: Promise<unknown> = Promise.resolve()
  private readonly dirtyRoots = new Map<string, string>()

  public constructor(
    private readonly sessions: TupiniquimSessionService,
    private readonly store: TupiniquimSessionSnapshotStore,
    private readonly hooks: TupiniquimSessionSnapshotCoordinatorHooks = {}
  ) {}

  /**
   * Enfileira o flush do workspace e AGUARDA o resultado.
   *
   * O capture acontece SINCRONAMENTE no momento do agendamento (por valor):
   * cada commit corresponde exatamente ao ponto de mutação estável que o
   * agendou — nunca a um estado lido depois, fora de ordem. Commits de todos
   * os workspaces compartilham a mesma fila FIFO (um único worker SQLite),
   * portanto nunca reordenam.
   */
  public flush(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome> {
    const snapshot = this.sessions.durableSnapshotFor(workspaceRoot)
    if (snapshot === null) {
      return Promise.resolve({ workspaceRoot, status: 'SKIPPED', turns: 0, bindings: 0, seenProviders: 0 })
    }
    const run = this.chain.then(async (): Promise<TupiniquimSnapshotFlushOutcome> => this.commitNow(workspaceRoot, snapshot))
    // A fila sobrevive a falhas individuais: erro em um flush nunca bloqueia os próximos.
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }

  /**
   * Write-through fire-and-forget para mutações disparadas por eventos síncronos.
   *
   * NÃO existe coalescing: cada schedule() gera um flush individual enfileirado
   * na FIFO (um commit por ponto de mutação estável, capturado por valor no
   * agendamento). Coalescing de flushes pendentes é escopo futuro explícito.
   */
  public schedule(workspaceRoot: string): void {
    void this.flush(workspaceRoot)
  }
  /**
   * Write-through do send: registra o pending context (ACK-only-after-success),
   * resolve o MODEL EFETIVO do request (referência do adapter > AIThread
   * persistida > binding corrente), vincula a thread, appenda o user turn
   * causal e commita o snapshot NA MESMA OPERAÇÃO SQLite que atualiza o model
   * corrente das AIThreads dos bindings.
   *
   * `persistedThread` é a AIThread lida após o retorno de `agent.send` (o
   * chamador já a resolve). A divergência `persistedThread.model !== model
   * efetivo` é a troca real A → B na mesma thread — e é commitada
   * atomicamente com o snapshot, nunca em dois writes.
   */
  public async commitSendTurn(input: {
    provider: AIProviderKind
    reference: AgentTurnReference
    message: string
    persistedThread: AIThread | null
    pendingContextTurnIds: readonly string[]
    workspaceRoot: string
  }): Promise<TupiniquimSendTurnCommit> {
    this.sessions.notePendingContext(input.provider, input.reference.threadId, input.reference.turnId, [...input.pendingContextTurnIds])
    const effectiveModel = input.reference.model ?? input.persistedThread?.model ?? this.sessions.modelFor(input.provider)
    const threadModelSwapped = input.persistedThread !== null && effectiveModel !== null && input.persistedThread.model !== effectiveModel
    this.sessions.bindProviderThread(input.provider, input.reference.threadId, effectiveModel)
    this.sessions.appendTurn({
      role: 'user',
      text: input.message,
      provider: input.provider,
      model: effectiveModel,
      threadId: input.reference.threadId,
      turnId: input.reference.turnId
    })
    // Deltas do MESMO request que chegaram antes do retorno do send herdaram o
    // model do binding antigo: o model efetivo real é autoritativo.
    this.sessions.stampRequestTurnModel(input.provider, input.reference.threadId, input.reference.turnId, effectiveModel)
    const flush = await this.flush(input.workspaceRoot)
    return { model: effectiveModel, threadModelSwapped, flush }
  }

  /** Roots com último flush FAILED (durabilidade não concluída; snapshot anterior íntegro). */
  public dirtyWorkspaces(): ReadonlyMap<string, string> {
    return this.dirtyRoots
  }

  public isDirty(workspaceRoot: string): boolean {
    return this.dirtyRoots.has(workspaceRoot)
  }

  private async commitNow(workspaceRoot: string, snapshot: TupiniquimDurableSnapshot): Promise<TupiniquimSnapshotFlushOutcome> {
    const outcome: TupiniquimSnapshotFlushOutcome = {
      workspaceRoot,
      status: 'COMMITTED',
      turns: snapshot.turns.length,
      bindings: snapshot.providerBindings.length,
      seenProviders: Object.keys(snapshot.seenByProvider).length
    }
    try {
      // MODEL PROVENANCE REAL: snapshot + ai_threads.model na MESMA transação.
      await this.store.putTupiniquimSessionSnapshotWithThreadModel(snapshot)
      this.dirtyRoots.delete(workspaceRoot)
      return outcome
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'Falha desconhecida na persistência do snapshot.'
      this.dirtyRoots.set(workspaceRoot, error)
      const failed: TupiniquimSnapshotFlushOutcome = { ...outcome, status: 'FAILED', error }
      this.hooks.onFlushError?.(failed)
      return failed
    }
  }
}

/**
 * Wave 16 — Correção da auditoria do Incremento 3/4 (TOCTOU do workspace
 * switch): sequência canônica da troca de workspace com write-through durável,
 * compartilhada entre o processo main e os testes de concorrência.
 *
 * Ordem obrigatória — NUNCA existe janela "WorkspaceAdapter no root novo +
 * sessão Tupiniquim ativa no root antigo":
 *
 * 1. O flush do snapshot do root que sai acontece ANTES de trocar o
 *    WorkspaceAdapter: durante um flush lento o adapter continua apontando
 *    para o root antigo, coerente com a sessão ativa — IPCs de
 *    workspace.read/list/search/context executados nesse intervalo observam
 *    exatamente o root antigo, nunca o novo adiantado.
 * 2. Só depois o root novo é canonicalizado (`configure`) e a sessão é
 *    ativada/hidratada pelo recovery (`restore(configured)`).
 * 3. Sessão NOVA limpa (outcome NO_SNAPSHOT ou REJECTED) é persistida
 *    imediatamente: o session.id estabiliza através de close/reopen, e para
 *    REJECTED o snapshot inválido antigo é substituído pela sessão nova
 *    limpa no mesmo commit. Se o flush falhar, a durabilidade NÃO é
 *    declarada: o root fica dirty com garantia explícita (o último snapshot
 *    commitado permanece íntegro e a próxima mutação estável reintenta) e a
 *    falha é reportada pelo gancho onFlushError do coordinator.
 */
export const switchTupiniquimWorkspaceWithDurableFlush = async (input: {
  sessions: TupiniquimSessionService
  coordinator: TupiniquimSessionSnapshotCoordinator
  recovery: TupiniquimSessionRecovery
  /** Troca o WorkspaceAdapter para o novo root; devolve o root canonicalizado. */
  configure: (root: string) => Promise<string>
  root: string
}): Promise<{ configured: string; recovery: TupiniquimSessionRecoveryResult }> => {
  const previousRoot = input.sessions.current()?.workspaceRoot ?? null
  if (previousRoot !== null) {
    await input.coordinator.flush(previousRoot)
  }
  const configured = await input.configure(input.root)
  const recovery = await input.recovery.restore(configured)
  if (recovery.outcome === 'NO_SNAPSHOT' || recovery.outcome === 'REJECTED') {
    await input.coordinator.flush(configured)
  }
  return { configured, recovery }
}

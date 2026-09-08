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
 * Wave 16 — Incremento 4/4 (CORREÇÃO DA AUDITORIA EXTERNA — Bloqueio 1):
 * SEAL/QUIESCE real do intake. O coordinator possui três estados explícitos:
 *
 *   OPEN → SEALED (seal) → FINAL (sealFinal)
 *
 * - OPEN: operação normal — flush/schedule/commitSendTurn aceitos;
 *   `flushFinal` é RECUSADO (é API exclusiva do sequenciador de shutdown);
 * - SEALED (`seal()`): o shutdown começou. `flush` e `schedule` deixam de
 *   enfileirar QUALQUER trabalho (flush devolve outcome `SEALED`; schedule é
 *   no-op — eventos pós-seal são mutações em memória que não podem mais
 *   originar trabalho durável novo); `commitSendTurn` rejeita FAIL-CLOSED
 *   antes de qualquer mutação; `flushFinal` passa a ser o ÚNICO caminho de
 *   escrita (capture final do sequenciador + retry final de roots dirty);
 * - FINAL (`sealFinal()`): acionado pelo sequenciador imediatamente antes de
 *   fechar o database — bloqueia ATÉ o `flushFinal`: nenhuma operação
 *   persistente pode mais ser postada, por nenhum caminho.
 *
 * `drain()` com intake selado tem significado FORTE: quando resolve (com
 * `quiescent: true`), a fila está realmente quiescente — chain vazia E
 * nenhum novo trabalho pode entrar. Essa é a prova que o shutdown exige
 * antes de fechar o SQLite (Bloqueio 2 da auditoria): nunca existe
 * "persistência não quiescente + database fechado + READY_TO_EXIT seguro".
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

export type TupiniquimSnapshotFlushStatus = 'COMMITTED' | 'SKIPPED' | 'FAILED' | 'SEALED'

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

/** Resultado sanitizado do drain: somente contagens/ids de workspace, sem conteúdo. */
export interface TupiniquimSnapshotDrainResult {
  /** Roots que continuam dirty depois do drain (durabilidade NÃO concluída). */
  dirtyWorkspaces: string[]
  /**
   * Prova de quiescência (Bloqueio 1/2 da auditoria): true somente quando o
   * intake está selado (SEALED/FINAL) E a chain foi aguardada até o fim —
   * nenhum trabalho novo pode entrar e nenhum trabalho antigo ficou pendente.
   * Com intake OPEN o drain continua válido como espera FIFO, mas `quiescent`
   * é false (semântica fraca; insuficiente para fechar o database).
   */
  quiescent: boolean
}

/** Estado do intake de persistência do coordinator (seal do shutdown). */
export type TupiniquimSnapshotIntakeState = 'OPEN' | 'SEALED' | 'FINAL'

export class TupiniquimSessionSnapshotCoordinator {
  /** Seção crítica: fila serializada FIFO de commits; nunca reordena. */
  private chain: Promise<unknown> = Promise.resolve()
  private readonly dirtyRoots = new Map<string, string>()
  /** Intake de persistência: OPEN → SEALED (seal) → FINAL (sealFinal). */
  private intake: TupiniquimSnapshotIntakeState = 'OPEN'

  public constructor(
    private readonly sessions: TupiniquimSessionService,
    private readonly store: TupiniquimSessionSnapshotStore,
    private readonly hooks: TupiniquimSessionSnapshotCoordinatorHooks = {}
  ) {}

  /**
   * Bloqueio 1 da auditoria: sela o intake para o shutdown. Idempotente.
   * Depois disto, NENHUMA fonte de mutação (publishAgentEvent, completion de
   * provider, onWorkspaceWriteToolCall, send de renderer, workspace switch)
   * consegue enfileirar trabalho durável novo por flush/schedule/
   * commitSendTurn — somente o sequenciador de shutdown usa `flushFinal`.
   */
  public seal(): void {
    if (this.intake === 'OPEN') this.intake = 'SEALED'
  }

  /**
   * Selo FINAL (Bloqueio 2 da auditoria): acionado pelo sequenciador
   * imediatamente antes de fechar o database. Bloqueia ATÉ o `flushFinal` —
   * depois disto nenhuma operação persistente pode mais ser postada por
   * NENHUM caminho (produção, evento ou sequenciador). Idempotente.
   */
  public sealFinal(): void {
    this.intake = 'FINAL'
  }

  public intakeState(): TupiniquimSnapshotIntakeState {
    return this.intake
  }

  public isSealed(): boolean {
    return this.intake !== 'OPEN'
  }

  private sealedOutcome(workspaceRoot: string): TupiniquimSnapshotFlushOutcome {
    // Outcome explícito (não silencioso): o chamador sabe que o trabalho não
    // foi aceito porque o intake está fechado para o shutdown.
    return { workspaceRoot, status: 'SEALED', turns: 0, bindings: 0, seenProviders: 0 }
  }

  /**
   * Enfileira o flush do workspace e AGUARDA o resultado.
   *
   * O capture acontece SINCRONAMENTE no momento do agendamento (por valor):
   * cada commit corresponde exatamente ao ponto de mutação estável que o
   * agendou — nunca a um estado lido depois, fora de ordem. Commits de todos
   * os workspaces compartilham a mesma fila FIFO (um único worker SQLite),
   * portanto nunca reordenam.
   *
   * Intake selado (Bloqueio 1): devolve outcome SEALED sem capturar e sem
   * enfileirar — nenhuma mutação pós-seal pode virar trabalho durável.
   */
  public flush(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome> {
    if (this.intake !== 'OPEN') return Promise.resolve(this.sealedOutcome(workspaceRoot))
    return this.enqueueFlush(workspaceRoot)
  }

  /**
   * Write-through fire-and-forget para mutações disparadas por eventos síncronos.
   *
   * NÃO existe coalescing: cada schedule() gera um flush individual enfileirado
   * na FIFO (um commit por ponto de mutação estável, capturado por valor no
   * agendamento). Coalescing de flushes pendentes é escopo futuro explícito.
   *
   * Intake selado (Bloqueio 1): no-op. Eventos de provider que chegam durante
   * o shutdown continuam mutando a sessão em memória (o processo está
   * encerrando), mas NUNCA originam trabalho durável novo — o capture final
   * do sequenciador é a última escrita possível.
   */
  public schedule(workspaceRoot: string): void {
    if (this.intake !== 'OPEN') return
    void this.enqueueFlush(workspaceRoot)
  }

  /**
   * Flush EXCLUSIVO do sequenciador de shutdown (capture final + retry final
   * de roots dirty). Recusado fail-closed enquanto o intake estiver OPEN
   * (uso em produção normal é bug) e depois do selo FINAL (nenhuma operação
   * persistente pode mais ser postada — Bloqueio 2).
   */
  public flushFinal(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome> {
    if (this.intake === 'OPEN') {
      return Promise.reject(new Error('flushFinal é exclusivo do shutdown: selle o intake antes (seal()).'))
    }
    if (this.intake === 'FINAL') return Promise.resolve(this.sealedOutcome(workspaceRoot))
    return this.enqueueFlush(workspaceRoot)
  }

  private enqueueFlush(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome> {
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
   * Wave 16 — Incremento 4/4: API aguardável do shutdown.
   *
   * Aguarda TODO o trabalho enfileirado ANTES desta chamada — inclusive o
   * flush em execução agora — e devolve os roots que permanecem dirty.
   *
   * Garantias:
   * - FIFO preservada: o drain não reordena, não cancela e não faz coalescing
   *   de nada que já estava na fila;
   * - tolera item FAILED: a fila sobrevive a falhas individuais (o `chain`
   *   engole rejeições), então um flush FAILED nunca bloqueia o drain nem os
   *   próximos commits — a falha é reportada pelo gancho onFlushError e o root
   *   permanece dirty no resultado;
   * - idempotente: chamadas repetidas (fila vazia ou já drenada) resolvem
   *   imediatamente sem duplicar trabalho — drain() NÃO enfileira nada;
   * - NÃO fecha o database: fechamento é do sequenciador de shutdown, depois
   *   da persistência.
   *
   * QUIESCÊNCIA FORTE (correção da auditoria, Bloqueios 1/2): com o intake
   * selado (`seal()`), `quiescent: true` no resultado é a PROVA de que a fila
   * está realmente fechada — chain aguardada até o fim E nenhum novo trabalho
   * pode entrar (flush/schedule/commitSendTurn recusados; somente
   * `flushFinal` do sequenciador, e o sequenciador não o chama depois do
   * drain final). Com intake OPEN o drain continua uma espera FIFO válida,
   * mas `quiescent: false` — semântica fraca, insuficiente para fechar o
   * database.
   */
  public async drain(): Promise<TupiniquimSnapshotDrainResult> {
    await this.chain
    return { dirtyWorkspaces: [...this.dirtyRoots.keys()], quiescent: this.isSealed() }
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
    // Bloqueio 1 da auditoria: fail-closed ANTES de qualquer mutação. Com o
    // intake selado o send não pode registrar turno durável novo — o request
    // do provider já aconteceu, mas o turno NÃO é aceito na fila de
    // persistência (o erro sobe para o IPC como falha explícita, nunca
    // silenciosa).
    if (this.intake !== 'OPEN') {
      throw new Error('A fila de persistência está selada para o encerramento; o turn não foi registrado.')
    }
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

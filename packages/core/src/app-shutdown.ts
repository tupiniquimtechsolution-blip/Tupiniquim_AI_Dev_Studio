import type { TupiniquimSnapshotDrainResult, TupiniquimSnapshotFlushOutcome } from './tupiniquim-session-persistence'

/**
 * Wave 16 — Incremento 4/4 (CORREÇÃO DA AUDITORIA EXTERNA — Bloqueios 1/2):
 * shutdown one-shot aguardável com SEAL/QUIESCE real e sem timeout-abandon da
 * seção crítica de persistência.
 *
 * State machine explícita:
 *
 *   RUNNING → SHUTTING_DOWN → READY_TO_EXIT   (caminho NORMAL)
 *                        └────→ ABORTED       (caminho FORÇADO/deadline)
 *
 * Caminho NORMAL — ordem real e obrigatória (nunca `void close()`):
 *
 *   1. sealForShutdown(): trava o runtime gate (user-driven para de iniciar)
 *      e sela o intake do coordinator — NENHUMA fonte pode enfileirar
 *      trabalho durável novo (flush/schedule/commitSendTurn recusados);
 *   2. flushFinal() do estado estável atual (capture final; único caminho de
 *      escrita pós-seal);
 *   3. drain() — espera TODA a fila; exige `quiescent: true` (prova);
 *   4. retry final único de roots dirty (flushFinal);
 *   5. drain() novamente — prova de quiescência final;
 *   6. closeProviders() — aguardado com timeout AUXILIAR (o seal já garante
 *      que um provider vivo não consegue causar nova persistência);
 *   7. sealFinalPersistence(): bloqueia ATÉ o flushFinal — nenhuma operação
 *      persistente pode mais ser postada, por nenhum caminho;
 *   8. closeDatabase() — SOMENTE com a prova de quiescência; sem timeout
 *      próprio (a seção crítica inteira é cercada pelo deadline);
 *   9. READY_TO_EXIT + relatório sanitizado + saída final (app.exit(0)).
 *
 * TIMEOUTS — semântica corrigida (Bloqueio 2):
 *
 * - A seção crítica de persistência (passos 1–5, 7, 8) NÃO tem timeout por
 *   passo. `Promise.race` não cancela a promise original: abandonar um flush
 *   que ainda aguarda a chain e fechar o database depois criaria a janela
 *   real "flush pendente → close → commitNow tardio". Isso é PROIBIDO no
 *   caminho normal: o database só fecha com `persistenceQuiescent = true`
 *   provado (drains quiescentes) e com o intake FINAL (nenhuma operação
 *   persistente pode mais ser postada).
 * - Timeout é permitido SOMENTE para passos AUXILIARES: closeProviders
 *   (diagnóstico; o seal isola a persistência de qualquer evento tardio do
 *   provider) e o gancho de auditoria onReport.
 * - Hang real da seção crítica é tratado pelo DEADLINE CRÍTICO
 *   (`criticalDeadlineMs`), que não finge nada: transita para ABORTED — o
 *   database NÃO é fechado, `databaseClosed`/`persistenceQuiescent` não são
 *   declarados, `READY_TO_EXIT` não é alcançado — e o processo sai pelo
 *   caminho forçado (`onAbort`, ex.: app.exit(1)). Semântica honesta de
 *   crash: o último snapshot commitado permanece íntegro (transação única no
 *   worker SQLite); estado não commitado pode ser perdido — e o relatório
 *   diz exatamente isso.
 *
 * Crash NÃO é shutdown: este sequenciador só cobre o encerramento normal
 * iniciado por before-quit. Um crash externo pode perder estado ainda não
 * commitado; o recovery fail-closed do Incremento 2/4 nunca aceita snapshot
 * parcial.
 */

export type AwaitedShutdownPhase = 'RUNNING' | 'SHUTTING_DOWN' | 'READY_TO_EXIT' | 'ABORTED'

/** Resultado do flush final do estado estável atual. */
export type StableStateFlushResult = TupiniquimSnapshotFlushOutcome | { status: 'NO_ACTIVE_WORKSPACE' }

export type AwaitedShutdownAbortReason = 'NONE' | 'CRITICAL_DEADLINE' | 'NOT_QUIESCENT' | 'SEAL_FAILURE' | 'CRITICAL_STEP_FAILURE'

/**
 * Plano de encerramento injetado pelo processo main (ou por testes): cada
 * capacidade é uma função aguardável isolada, na ordem canônica acima.
 * A produção usa EXATAMENTE este contrato — os testes exercitam o mesmo.
 */
export interface AwaitedShutdownPlan {
  /** 1. Trava o runtime gate e sela o intake do coordinator (síncrono). */
  sealForShutdown(): void
  /** 2. Capture final do estado estável atual (workspace ativo). */
  flushStableState(): Promise<StableStateFlushResult>
  /** 3/5. Aguarda TODA a fila e devolve a prova de quiescência. */
  drainQueue(): Promise<TupiniquimSnapshotDrainResult>
  /** 4. Roots dirty para o retry final único. */
  dirtyWorkspaceRoots(): readonly string[]
  /** 4. Retry final completo do root dirty (flushFinal). */
  retryDirtyWorkspace(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome>
  /** 6. Encerra providers (aguardável; timeout AUXILIAR permitido). */
  closeProviders(): Promise<void>
  /** 7. Selo FINAL do intake: nada mais pode ser postado (síncrono). */
  sealFinalPersistence(): void
  /** 8. Encerra o SQLite DEPOIS de toda a persistência (sem timeout próprio). */
  closeDatabase(): Promise<void>
}

export interface AwaitedShutdownReport {
  /** 'READY_TO_EXIT' = caminho normal concluído; 'ABORTED' = caminho forçado. */
  phase: 'READY_TO_EXIT' | 'ABORTED'
  /** true = deadline crítico / quiescência não provada: NADA de saída segura é declarado. */
  aborted: boolean
  abortReason: AwaitedShutdownAbortReason
  /** true quando o seal do intake foi executado com sucesso. */
  sealed: boolean
  /**
   * PROVA (Bloqueio 2): true somente no caminho normal, quando os dois drains
   * resolveram quiescentes com intake selado. `databaseClosed` só pode ser
   * true quando isto é true.
   */
  persistenceQuiescent: boolean
  /** true quando algum passo falhou/expirou ou a durabilidade não foi concluída. */
  degraded: boolean
  stableStateFlush: StableStateFlushResult['status'] | 'ABORTED'
  dirtyRootsRetried: number
  dirtyRootsRemaining: number
  providersClosed: boolean
  databaseClosed: boolean
  /** Passos AUXILIARES que excederam o orçamento (nomes estáveis, sanitizados). */
  timedOutSteps: readonly string[]
  /** Passos que lançaram erro (nomes estáveis, sanitizados; sem mensagem bruta). */
  failedSteps: readonly string[]
  durationMs: number
}

export interface AwaitedShutdownCoordinatorOptions {
  /**
   * Orçamento para passos AUXILIARES (closeProviders, onReport). NUNCA é
   * aplicado à seção crítica de persistência. Default 10s.
   */
  stepTimeoutMs?: number
  /**
   * Deadline da seção crítica INTEIRA (seal → flushFinal → drains → retry →
   * sealFinal → closeDatabase). Se excedido, o shutdown transita para ABORTED
   * (sem fechar o database, sem declarar quiescência, saída forçada via
   * onAbort). Default 120s.
   */
  criticalDeadlineMs?: number
  /** Relatório sanitizado para o AuditLog (o coordenador não loga nada sozinho). */
  onReport?: (report: AwaitedShutdownReport) => void | Promise<void>
  /** Saída final NORMAL: chamado exatamente uma vez, com recursos encerrados. */
  onReadyToExit?: (report: AwaitedShutdownReport) => void
  /** Saída FORÇADA (ABORTED): chamado exatamente uma vez; nada é declarado seguro. */
  onAbort?: (report: AwaitedShutdownReport) => void
}

const defaultStepTimeoutMs = 10_000
const defaultCriticalDeadlineMs = 120_000

/**
 * Orçamento AUXILIAR: espera com limite. A promise original NÃO é cancelada —
 * por isso só é usada onde isso é seguro (passos auxiliares isolados do lado
 * de persistência pelo seal).
 */
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<{ value?: T; timedOut: boolean }> => {
  let timer: NodeJS.Timeout | undefined
  const budget = new Promise<{ timedOut: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
  })
  try {
    const value = await Promise.race([promise.then((resolved) => ({ value: resolved, timedOut: false })), budget])
    return value
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Passo crítico aguardado INTEGRALMENTE (sem timeout): erro vira registro sanitizado. */
const awaitCritical = async <T>(promise: Promise<T>): Promise<{ value?: T; failed: boolean }> => {
  try {
    return { value: await promise, failed: false }
  } catch {
    return { failed: true }
  }
}

/**
 * Passo AUXILIAR (providers, onReport): timeout OU falha NUNCA propagam —
 * viram registro. Nada aqui pode rejeitar a execução do shutdown.
 */
const awaitAux = async <T>(promise: Promise<T>, timeoutMs: number): Promise<{ value: T | undefined; timedOut: boolean; failed: boolean }> => {
  try {
    const outcome = await withTimeout(promise, timeoutMs)
    return { value: outcome.value, timedOut: outcome.timedOut, failed: false }
  } catch {
    return { value: undefined, timedOut: false, failed: true }
  }
}

interface CriticalOutcome {
  ok: boolean
  abortReason: AwaitedShutdownAbortReason
  report?: AwaitedShutdownReport
}

/** Nome do passo responsável por cada razão de abort (relatório honesto). */
const abortStepOf = (reason: AwaitedShutdownAbortReason): string => {
  if (reason === 'SEAL_FAILURE') return 'sealForShutdown'
  if (reason === 'CRITICAL_STEP_FAILURE') return 'criticalSection'
  if (reason === 'NOT_QUIESCENT') return 'drainQueue'
  return 'criticalSectionDeadline'
}

export class AwaitedShutdownCoordinator {
  private phase: AwaitedShutdownPhase = 'RUNNING'
  private execution: Promise<AwaitedShutdownReport> | null = null
  private finishedReport: AwaitedShutdownReport | null = null
  private readonly stepTimeoutMs: number
  private readonly criticalDeadlineMs: number

  public constructor(
    private readonly plan: AwaitedShutdownPlan,
    private readonly options: AwaitedShutdownCoordinatorOptions = {}
  ) {
    this.stepTimeoutMs = options.stepTimeoutMs ?? defaultStepTimeoutMs
    this.criticalDeadlineMs = options.criticalDeadlineMs ?? defaultCriticalDeadlineMs
  }

  public state(): AwaitedShutdownPhase {
    return this.phase
  }

  public isReadyToExit(): boolean {
    return this.phase === 'READY_TO_EXIT'
  }

  /**
   * Guarda de reentrada + one-shot:
   * - primeira chamada em RUNNING inicia a ÚNICA execução do shutdown;
   * - chamadas concorrentes/subsequentes em SHUTTING_DOWN recebem a MESMA
   *   promessa (nenhum passo roda duas vezes, nenhum close duplica);
   * - chamadas após READY_TO_EXIT/ABORTED resolvem imediatamente com o
   *   relatório final (idempotente; nenhum recurso é reencerrado).
   */
  public begin(): Promise<AwaitedShutdownReport> {
    if (this.finishedReport !== null && (this.phase === 'READY_TO_EXIT' || this.phase === 'ABORTED')) {
      return Promise.resolve(this.finishedReport)
    }
    if (this.execution !== null) return this.execution
    this.phase = 'SHUTTING_DOWN'
    this.execution = this.run()
    return this.execution
  }

  private async run(): Promise<AwaitedShutdownReport> {
    const startedAt = Date.now()
    // Deadline crítico: protegido contra hang infinito SEM fingir saída
    // segura. O timer SEMPRE é limpo (nenhum handle pendurado).
    let deadlineTimer: NodeJS.Timeout | undefined
    const deadline = new Promise<'deadline'>((resolve) => {
      deadlineTimer = setTimeout(() => resolve('deadline'), this.criticalDeadlineMs)
    })
    let quiescentSoFar = false
    const critical = this.runCritical(startedAt, (value) => { quiescentSoFar = value })
    // Defensivo: a seção crítica é total (nenhum passo propaga), mas mesmo
    // um throw imprevisto aqui não pode rejeitar `run()` — vira ABORTED.
    const outcome = await Promise.race([
      critical.then(
        (result): { kind: 'critical'; result: CriticalOutcome } => ({ kind: 'critical', result }),
        (): { kind: 'critical'; result: CriticalOutcome } => ({ kind: 'critical', result: { ok: false, abortReason: 'CRITICAL_STEP_FAILURE' } })
      ),
      deadline.then((): { kind: 'deadline' } => ({ kind: 'deadline' }))
    ])
    if (deadlineTimer !== undefined) clearTimeout(deadlineTimer)

    if (outcome.kind === 'deadline') {
      // ABORTED — caminho FORÇADO, semanticamente distinto (§7 da auditoria):
      // o database NÃO é fechado, quiescência/databaseClosed NÃO são
      // declarados, READY_TO_EXIT NÃO é alcançado. O relatório é honesto:
      // crash-like (último snapshot commitado íntegro; não commitado perdido).
      const report: AwaitedShutdownReport = {
        phase: 'ABORTED',
        aborted: true,
        abortReason: 'CRITICAL_DEADLINE',
        sealed: true,
        persistenceQuiescent: false,
        degraded: true,
        stableStateFlush: 'ABORTED',
        dirtyRootsRetried: 0,
        dirtyRootsRemaining: this.safeDirtyRoots().length,
        providersClosed: false,
        databaseClosed: false,
        timedOutSteps: ['criticalSectionDeadline'],
        failedSteps: [],
        durationMs: Date.now() - startedAt
      }
      this.phase = 'ABORTED'
      this.finishedReport = report
      await this.emitReport(report)
      this.options.onAbort?.(report)
      return report
    }
    if (!outcome.result.ok) {
      // Quiescência não provada ou seal falhou: mesma honestidade do deadline
      // — NÃO fecha o database, NÃO declara READY_TO_EXIT, sai pelo caminho
      // forçado com a razão explícita.
      const report: AwaitedShutdownReport = {
        phase: 'ABORTED',
        aborted: true,
        abortReason: outcome.result.abortReason,
        sealed: outcome.result.abortReason !== 'SEAL_FAILURE',
        persistenceQuiescent: quiescentSoFar,
        degraded: true,
        stableStateFlush: 'ABORTED',
        dirtyRootsRetried: 0,
        dirtyRootsRemaining: this.safeDirtyRoots().length,
        providersClosed: false,
        databaseClosed: false,
        timedOutSteps: [],
        failedSteps: [abortStepOf(outcome.result.abortReason)],
        durationMs: Date.now() - startedAt
      }
      this.phase = 'ABORTED'
      this.finishedReport = report
      await this.emitReport(report)
      this.options.onAbort?.(report)
      return report
    }
    const report = outcome.result.report
    if (report === undefined) throw new Error('Shutdown crítico concluído sem relatório.')
    this.phase = 'READY_TO_EXIT'
    this.finishedReport = report
    await this.emitReport(report)
    this.options.onReadyToExit?.(report)
    return report
  }

  /**
   * Audit com orçamento auxiliar: se o próprio AuditLog travar OU lançar,
   * a saída final não fica pendurada nele e nada propaga.
   */
  private async emitReport(report: AwaitedShutdownReport): Promise<void> {
    if (this.options.onReport === undefined) return
    try {
      await withTimeout(Promise.resolve(this.options.onReport(report)), this.stepTimeoutMs)
    } catch {
      // Audit é AUXILIAR: falha aqui nunca bloqueia nem rejeita o shutdown.
    }
  }

  /**
   * Seção crítica — SEM timeout por passo (Bloqueio 2). Retorna
   * `{ ok: false, abortReason }` quando a quiescência não pode ser provada
   * (o chamador transita para ABORTED; o database NÃO é fechado).
   */
  private async runCritical(startedAt: number, markQuiescent: (value: boolean) => void): Promise<CriticalOutcome> {
    const timedOutSteps: string[] = []
    const failedSteps: string[] = []

    // 1. SEAL: runtime gate + intake do coordinator. Fontes de mutação
    //    Tupiniquim (publishAgentEvent, onWorkspaceWriteToolCall, send,
    //    workspace switch) ficam bloqueadas a partir daqui.
    try {
      this.plan.sealForShutdown()
    } catch {
      failedSteps.push('sealForShutdown')
      return { ok: false, abortReason: 'SEAL_FAILURE' }
    }
    const sealed = true

    // 2. Capture final do estado estável atual — aguardado integralmente.
    let stableStateFlush: AwaitedShutdownReport['stableStateFlush'] = 'FAILED'
    const stable = await awaitCritical(Promise.resolve(this.plan.flushStableState()))
    if (stable.failed) failedSteps.push('flushStableState')
    else if (stable.value !== undefined) stableStateFlush = stable.value.status

    // 3. Drain — exige PROVA de quiescência. Sem quiescência provada é
    //    PROIBIDO fechar o database (§6 da auditoria).
    const firstDrain = await awaitCritical(Promise.resolve(this.plan.drainQueue()))
    if (firstDrain.failed || firstDrain.value === undefined || !firstDrain.value.quiescent) {
      failedSteps.push('drainQueue')
      return { ok: false, abortReason: 'NOT_QUIESCENT' }
    }
    const dirtyRoots = firstDrain.value.dirtyWorkspaces
    markQuiescent(true)

    // 4. Retry final ÚNICO por root dirty — aguardado integralmente. Se
    //    falhar, durabilidade NÃO é declarada; nunca bloqueia, nunca laço.
    let dirtyRootsRetried = 0
    for (const workspaceRoot of dirtyRoots) {
      dirtyRootsRetried += 1
      const retry = await awaitCritical(Promise.resolve(this.plan.retryDirtyWorkspace(workspaceRoot)))
      if (retry.failed) failedSteps.push('retryDirtyWorkspace')
    }

    // 5. Drain pós-retry — prova final de quiescência.
    const finalDrain = await awaitCritical(Promise.resolve(this.plan.drainQueue()))
    if (finalDrain.failed || finalDrain.value === undefined || !finalDrain.value.quiescent) {
      failedSteps.push('drainQueueAfterRetry')
      return { ok: false, abortReason: 'NOT_QUIESCENT' }
    }
    const persistenceQuiescent = finalDrain.value.quiescent
    markQuiescent(persistenceQuiescent)
    const dirtyRootsRemaining = this.safeDirtyRoots().length

    // 6. Providers — AUXILIAR: timeout permitido. O seal já isola a
    //    persistência: um provider vivo emitindo evento tardio não consegue
    //    agendar persistência nova (schedule/flush recusados com intake
    //    selado), portanto prosseguir após timeout aqui não abre janela de
    //    write-after-close.
    let providersClosed = false
    const providers = await awaitAux(Promise.resolve(this.plan.closeProviders()), this.stepTimeoutMs)
    if (providers.timedOut) timedOutSteps.push('closeProviders')
    else if (providers.failed) failedSteps.push('closeProviders')
    else providersClosed = true

    // 7. Selo FINAL: bloqueia ATÉ o flushFinal — nenhuma operação persistente
    //    pode mais ser postada por nenhum caminho.
    try {
      this.plan.sealFinalPersistence()
    } catch {
      failedSteps.push('sealFinalPersistence')
      return { ok: false, abortReason: 'SEAL_FAILURE' }
    }

    // 8. SQLite — fechado SOMENTE depois de toda a persistência, com a prova
    //    de quiescência; sem timeout próprio (o deadline crítico cerca hang).
    let databaseClosed = false
    const database = await awaitCritical(Promise.resolve(this.plan.closeDatabase()))
    if (database.failed) failedSteps.push('closeDatabase')
    else databaseClosed = true

    const report: AwaitedShutdownReport = {
      phase: 'READY_TO_EXIT',
      aborted: false,
      abortReason: 'NONE',
      sealed,
      persistenceQuiescent,
      degraded: timedOutSteps.length > 0 || failedSteps.length > 0 || dirtyRootsRemaining > 0 || !providersClosed || !databaseClosed,
      stableStateFlush,
      dirtyRootsRetried,
      dirtyRootsRemaining,
      providersClosed,
      databaseClosed,
      timedOutSteps,
      failedSteps,
      durationMs: Date.now() - startedAt
    }
    return { ok: true, abortReason: 'NONE', report }
  }

  private safeDirtyRoots(): readonly string[] {
    try {
      return this.plan.dirtyWorkspaceRoots()
    } catch {
      return []
    }
  }
}

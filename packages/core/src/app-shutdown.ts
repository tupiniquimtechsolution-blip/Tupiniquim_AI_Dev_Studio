import type { TupiniquimSnapshotDrainResult, TupiniquimSnapshotFlushOutcome } from './tupiniquim-session-persistence'

/**
 * Wave 16 — Incremento 4/4 (SEGUNDA CORREÇÃO DA AUDITORIA EXTERNA —
 * Bloqueios 1/2/3): shutdown one-shot aguardável com RUNTIME QUIESCENCE real,
 * providers e database como passos CRÍTICOS, e sem timeout-abandon da seção
 * crítica.
 *
 * State machine explícita:
 *
 *   RUNNING → SHUTTING_DOWN → READY_TO_EXIT   (caminho NORMAL)
 *                        └────→ ABORTED       (caminho FORÇADO/deadline)
 *
 * Caminho NORMAL — ordem real e obrigatória (nunca `void close()`):
 *
 *   1. sealForShutdown(): trava o runtime gate (operações user-driven NOVAS
 *      param de iniciar) e sela o intake do coordinator — NENHUMA fonte pode
 *      enfileirar trabalho durável novo (flush/schedule/commitSendTurn
 *      recusados);
 *   2. awaitRuntimeQuiescent(): RUNTIME QUIESCENCE — aguarda as operações JÁ
 *      iniciadas ANTES do selo convergirem (workspace switch em andamento,
 *      send em preparação/execução, provider select, turno de provider em
 *      streaming). Sem isso o capture final poderia fotografar o workspace A
 *      enquanto um switch já iniciado ainda ativaria B depois — isso NÃO é
 *      runtime quiescence;
 *   3. flushFinal() do estado estável atual (capture final; único caminho de
 *      escrita pós-seal);
 *   4. drain() — espera TODA a fila; exige `quiescent: true` (prova);
 *   5. retry final único de roots dirty (flushFinal);
 *   6. drain() novamente — prova de quiescência final;
 *   7. closeProviders() — CRÍTICO e aguardado integralmente: Codex e Ollama
 *      gravam AIThread/AITurn/AIEvent DIRETO no SQLite pelo history
 *      repository, FORA do snapshot coordinator. Snapshot selado NÃO prova
 *      "nenhuma escrita possível": o database só pode fechar com os
 *      providers comprovadamente encerrados. Falha/rejeição → ABORTED;
 *   8. sealFinalPersistence(): bloqueia ATÉ o flushFinal — nenhuma operação
 *      persistente pode mais ser postada, por nenhum caminho;
 *   9. closeDatabase() — CRÍTICO: rejeição NÃO é "degraded READY_TO_EXIT"
 *      (isso reportaria encerramento normal via app.exit(0) sem o database
 *      confirmado). Falha → ABORTED com saída forçada (app.exit(1));
 *  10. READY_TO_EXIT + relatório sanitizado + saída final (app.exit(0)).
 *
 * TIMEOUTS/DEADLINE — semântica (Bloqueio 2 da primeira correção, mantida e
 * estendida à nova ordem):
 *
 * - NENHUM passo crítico (2–9) tem timeout próprio. `Promise.race` não
 *   cancela a promise original: abandonar um flush que ainda aguarda a chain
 *   — ou um provider close que ainda pode gravar history — e fechar o
 *   database depois criaria janelas reais de write-after-close. PROIBIDO no
 *   caminho normal: o database só fecha com `runtimeQuiescent`,
 *   `persistenceQuiescent` e `providersClosed` provados.
 * - Timeout é permitido SOMENTE no gancho de auditoria onReport (auxiliar).
 * - Hang real de QUALQUER etapa crítica (runtime quiescence, persistência
 *   final, drains, provider closure, database closure) é tratado pelo
 *   DEADLINE CRÍTICO (`criticalDeadlineMs`), que não finge nada: transita
 *   para ABORTED — o database NÃO é fechado, `databaseClosed` não é
 *   declarado, `READY_TO_EXIT` não é alcançado — e o processo sai pelo
 *   caminho forçado (`onAbort`, ex.: app.exit(1)). A promise original pode
 *   continuar viva até o processo terminar; a sequência normal NUNCA
 *   prossegue para database.close depois de um deadline vencido. Semântica
 *   honesta de crash: o último snapshot commitado permanece íntegro
 *   (transação única no worker SQLite); estado não commitado pode ser
 *   perdido — e o relatório diz exatamente isso.
 *
 * Crash NÃO é shutdown: este sequenciador só cobre o encerramento normal
 * iniciado por before-quit. Um crash externo pode perder estado ainda não
 * commitado; o recovery fail-closed do Incremento 2/4 nunca aceita snapshot
 * parcial.
 */

export type AwaitedShutdownPhase = 'RUNNING' | 'SHUTTING_DOWN' | 'READY_TO_EXIT' | 'ABORTED'

/** Resultado do flush final do estado estável atual. */
export type StableStateFlushResult = TupiniquimSnapshotFlushOutcome | { status: 'NO_ACTIVE_WORKSPACE' }

export type AwaitedShutdownAbortReason =
  | 'NONE'
  | 'CRITICAL_DEADLINE'
  | 'RUNTIME_NOT_QUIESCENT'
  | 'NOT_QUIESCENT'
  | 'SEAL_FAILURE'
  | 'PROVIDERS_CLOSE_FAILED'
  | 'DATABASE_CLOSE_FAILED'
  | 'CRITICAL_STEP_FAILURE'

/**
 * Plano de encerramento injetado pelo processo main (ou por testes): cada
 * capacidade é uma função aguardável isolada, na ordem canônica acima.
 * A produção usa EXATAMENTE este contrato — os testes exercitam o mesmo.
 */
export interface AwaitedShutdownPlan {
  /** 1. Sela NOVAS operações: runtime gate travado + intake do coordinator (síncrono). */
  sealForShutdown(): void
  /**
   * 2. RUNTIME QUIESCENCE: aguarda as operações JÁ iniciadas antes do selo
   * convergirem (workspace switch, provider select, send em
   * preparação/execução, provider busy/turno em streaming). Resolve somente
   * com o runtime livre; rejeita em falha explícita.
   */
  awaitRuntimeQuiescent(): Promise<void>
  /** 3. Capture final do estado estável atual (workspace ativo; flushFinal). */
  flushStableState(): Promise<StableStateFlushResult>
  /** 4/6. Aguarda TODA a fila e devolve a prova de quiescência. */
  drainQueue(): Promise<TupiniquimSnapshotDrainResult>
  /** 5. Roots dirty para o retry final único. */
  dirtyWorkspaceRoots(): readonly string[]
  /** 5. Retry final completo do root dirty (flushFinal). */
  retryDirtyWorkspace(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome>
  /**
   * 7. CRÍTICO: encerra os providers e é aguardado integralmente. Codex e
   * Ollama gravam history DIRETO no SQLite (fora do snapshot coordinator) —
   * sem providers encerrados o database NÃO pode fechar. Rejeição → ABORTED.
   */
  closeProviders(): Promise<void>
  /** 8. Selo FINAL do intake: nada mais pode ser postado (síncrono). */
  sealFinalPersistence(): void
  /**
   * 9. CRÍTICO: encerra o SQLite DEPOIS de toda a persistência e dos
   * providers. Rejeição → ABORTED (nunca READY_TO_EXIT com banco não
   * confirmado).
   */
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
   * PROVA (SEGUNDA correção, Bloqueio 1): true quando as operações JÁ
   * iniciadas antes do selo convergiram (workspace switch, send, provider
   * select, turnos em streaming) ANTES do capture final.
   */
  runtimeQuiescent: boolean
  /**
   * PROVA (Bloqueio 2 da primeira correção): true somente no caminho normal,
   * quando os dois drains resolveram quiescentes com intake selado.
   * `databaseClosed` só pode ser true quando isto é true.
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
   * Orçamento para o gancho de auditoria onReport (AUXILIAR — o AuditLog
   * nunca pode pendurar nem rejeitar a saída). NUNCA é aplicado a nenhum
   * passo crítico. Default 10s.
   */
  stepTimeoutMs?: number
  /**
   * Deadline da seção crítica INTEIRA (seal → runtime quiescence →
   * flushFinal → drains → retry → closeProviders → sealFinal →
   * closeDatabase). Se excedido em QUALQUER etapa, o shutdown transita para
   * ABORTED (sem fechar o database, sem declarar quiescência, saída forçada
   * via onAbort). Default 120s.
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

interface CriticalOutcome {
  ok: boolean
  abortReason: AwaitedShutdownAbortReason
  report?: AwaitedShutdownReport
}

/**
 * Progresso honesto da seção crítica: o que JÁ foi provado quando um abort
 * acontece. Os relatórios ABORTED reportam exatamente este estado — nunca
 * fingem prova que não ocorreu (nem omitem prova que ocorreu).
 */
interface ShutdownProgress {
  runtimeQuiescent: boolean
  persistenceQuiescent: boolean
  providersClosed: boolean
  dirtyRootsRetried: number
}

/** Nome do passo responsável por cada razão de abort (relatório honesto). */
const abortStepOf = (reason: AwaitedShutdownAbortReason): string => {
  if (reason === 'SEAL_FAILURE') return 'sealForShutdown'
  if (reason === 'RUNTIME_NOT_QUIESCENT') return 'awaitRuntimeQuiescent'
  if (reason === 'NOT_QUIESCENT') return 'drainQueue'
  if (reason === 'PROVIDERS_CLOSE_FAILED') return 'closeProviders'
  if (reason === 'DATABASE_CLOSE_FAILED') return 'closeDatabase'
  if (reason === 'CRITICAL_STEP_FAILURE') return 'criticalSection'
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
    const progress: ShutdownProgress = { runtimeQuiescent: false, persistenceQuiescent: false, providersClosed: false, dirtyRootsRetried: 0 }
    const critical = this.runCritical(startedAt, progress)
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
      // ABORTED — caminho FORÇADO, semanticamente distinto: o database NÃO é
      // fechado, databaseClosed NÃO é declarado, READY_TO_EXIT NÃO é
      // alcançado. O relatório é honesto sobre o que JÁ tinha sido provado
      // (progress) e crash-like sobre o resto: último snapshot commitado
      // íntegro; não commitado perdido. A sequência normal NUNCA prossegue
      // para closeDatabase depois de um deadline vencido.
      const report: AwaitedShutdownReport = {
        phase: 'ABORTED',
        aborted: true,
        abortReason: 'CRITICAL_DEADLINE',
        sealed: true,
        runtimeQuiescent: progress.runtimeQuiescent,
        persistenceQuiescent: progress.persistenceQuiescent,
        degraded: true,
        stableStateFlush: 'ABORTED',
        dirtyRootsRetried: progress.dirtyRootsRetried,
        dirtyRootsRemaining: this.safeDirtyRoots().length,
        providersClosed: progress.providersClosed,
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
      // Falha crítica explícita (runtime não quiescente, drains sem prova,
      // providers/database close falho, seal falho): mesma honestidade do
      // deadline — NÃO fecha o database, NÃO declara READY_TO_EXIT, sai pelo
      // caminho forçado com a razão explícita e o progresso real.
      const report: AwaitedShutdownReport = {
        phase: 'ABORTED',
        aborted: true,
        abortReason: outcome.result.abortReason,
        sealed: outcome.result.abortReason !== 'SEAL_FAILURE',
        runtimeQuiescent: progress.runtimeQuiescent,
        persistenceQuiescent: progress.persistenceQuiescent,
        degraded: true,
        stableStateFlush: 'ABORTED',
        dirtyRootsRetried: progress.dirtyRootsRetried,
        dirtyRootsRemaining: this.safeDirtyRoots().length,
        providersClosed: progress.providersClosed,
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
   * Seção crítica — SEM timeout por passo. Providers e database são CRÍTICOS
   * (SEGUNDA correção, Bloqueios 2/3): o database NÃO fecha sem providers
   * encerrados (history escreve FORA do snapshot coordinator) e rejeição de
   * close NUNCA vira READY_TO_EXIT. Retorna `{ ok: false, abortReason }`
   * quando uma prova crítica falha (o chamador transita para ABORTED; o
   * database NÃO é fechado). Hang de qualquer passo é cercado pelo deadline
   * crítico de `run()`.
   */
  private async runCritical(startedAt: number, progress: ShutdownProgress): Promise<CriticalOutcome> {
    const timedOutSteps: string[] = []
    const failedSteps: string[] = []

    // 1. SEAL de NOVAS operações: runtime gate travado (send/workspace
    //    switch/provider select user-driven param de iniciar) + intake do
    //    coordinator selado (flush/schedule/commitSendTurn recusados).
    try {
      this.plan.sealForShutdown()
    } catch {
      failedSteps.push('sealForShutdown')
      return { ok: false, abortReason: 'SEAL_FAILURE' }
    }
    const sealed = true

    // 2. RUNTIME QUIESCENCE (SEGUNDA correção, Bloqueio 1): aguarda as
    //    operações JÁ iniciadas convergirem ANTES do capture final — um
    //    workspace switch em andamento não pode ativar B depois do capture,
    //    um send em andamento não pode continuar usando adapters/database.
    //    Sem timeout próprio; hang é tratado pelo deadline crítico (ABORTED).
    const runtime = await awaitCritical(Promise.resolve(this.plan.awaitRuntimeQuiescent()))
    if (runtime.failed) {
      failedSteps.push('awaitRuntimeQuiescent')
      return { ok: false, abortReason: 'RUNTIME_NOT_QUIESCENT' }
    }
    progress.runtimeQuiescent = true

    // 3. Capture final do estado estável atual — aguardado integralmente.
    let stableStateFlush: AwaitedShutdownReport['stableStateFlush'] = 'FAILED'
    const stable = await awaitCritical(Promise.resolve(this.plan.flushStableState()))
    if (stable.failed) failedSteps.push('flushStableState')
    else if (stable.value !== undefined) stableStateFlush = stable.value.status

    // 4. Drain — exige PROVA de quiescência. Sem quiescência provada é
    //    PROIBIDO fechar o database.
    const firstDrain = await awaitCritical(Promise.resolve(this.plan.drainQueue()))
    if (firstDrain.failed || firstDrain.value === undefined || !firstDrain.value.quiescent) {
      failedSteps.push('drainQueue')
      return { ok: false, abortReason: 'NOT_QUIESCENT' }
    }
    const dirtyRoots = firstDrain.value.dirtyWorkspaces
    progress.persistenceQuiescent = true

    // 5. Retry final ÚNICO por root dirty — aguardado integralmente. Se
    //    falhar, durabilidade NÃO é declarada; nunca bloqueia, nunca laço.
    for (const workspaceRoot of dirtyRoots) {
      progress.dirtyRootsRetried += 1
      const retry = await awaitCritical(Promise.resolve(this.plan.retryDirtyWorkspace(workspaceRoot)))
      if (retry.failed) failedSteps.push('retryDirtyWorkspace')
    }

    // 6. Drain pós-retry — prova final de quiescência.
    const finalDrain = await awaitCritical(Promise.resolve(this.plan.drainQueue()))
    if (finalDrain.failed || finalDrain.value === undefined || !finalDrain.value.quiescent) {
      failedSteps.push('drainQueueAfterRetry')
      return { ok: false, abortReason: 'NOT_QUIESCENT' }
    }
    progress.persistenceQuiescent = finalDrain.value.quiescent
    const dirtyRootsRemaining = this.safeDirtyRoots().length

    // 7. CLOSE PROVIDERS — CRÍTICO (SEGUNDA correção, Bloqueio 2): Codex e
    //    Ollama gravam AIThread/AITurn/AIEvent DIRETO no SQLite pelo history
    //    repository, FORA do snapshot coordinator — snapshot selado NÃO prova
    //    "nenhuma escrita possível" enquanto um provider vive. Aguardado
    //    integralmente (sem timeout): só a conclusão comprovada libera o
    //    caminho para o closeDatabase. Rejeição → ABORTED (database NÃO
    //    fecha); hang → deadline crítico → ABORTED. O runtime quiescence do
    //    passo 2 já garantiu que nenhum turno continua executando.
    const providers = await awaitCritical(Promise.resolve(this.plan.closeProviders()))
    if (providers.failed) {
      failedSteps.push('closeProviders')
      return { ok: false, abortReason: 'PROVIDERS_CLOSE_FAILED' }
    }
    progress.providersClosed = true

    // 8. Selo FINAL: bloqueia ATÉ o flushFinal — nenhuma operação persistente
    //    pode mais ser postada por nenhum caminho.
    try {
      this.plan.sealFinalPersistence()
    } catch {
      failedSteps.push('sealFinalPersistence')
      return { ok: false, abortReason: 'SEAL_FAILURE' }
    }

    // 9. CLOSE DATABASE — CRÍTICO (SEGUNDA correção, Bloqueio 3): fechado
    //    SOMENTE depois de toda a persistência E dos providers, com todas as
    //    provas (runtimeQuiescent, persistenceQuiescent, providersClosed).
    //    Rejeição → ABORTED com saída forçada — NUNCA "degraded
    //    READY_TO_EXIT" (isso reportaria app.exit(0) com banco não
    //    confirmado). Sem timeout próprio; hang → deadline crítico.
    const database = await awaitCritical(Promise.resolve(this.plan.closeDatabase()))
    if (database.failed) {
      failedSteps.push('closeDatabase')
      return { ok: false, abortReason: 'DATABASE_CLOSE_FAILED' }
    }
    const databaseClosed = true

    const report: AwaitedShutdownReport = {
      phase: 'READY_TO_EXIT',
      aborted: false,
      abortReason: 'NONE',
      sealed,
      runtimeQuiescent: progress.runtimeQuiescent,
      persistenceQuiescent: progress.persistenceQuiescent,
      degraded: failedSteps.length > 0 || dirtyRootsRemaining > 0,
      stableStateFlush,
      dirtyRootsRetried: progress.dirtyRootsRetried,
      dirtyRootsRemaining,
      providersClosed: progress.providersClosed,
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

import type { TupiniquimSnapshotDrainResult, TupiniquimSnapshotFlushOutcome } from './tupiniquim-session-persistence'

/**
 * Wave 16 — Incremento 4/4: shutdown one-shot aguardável do processo.
 *
 * State machine explícita:
 *
 *   RUNNING → SHUTTING_DOWN → READY_TO_EXIT
 *
 * - RUNNING: operação normal; a primeira solicitação de encerramento inicia o
 *   shutdown UMA única vez;
 * - SHUTTING_DOWN: guarda de reentrada — novas solicitações de quit NÃO
 *   reiniciam o shutdown, NÃO duplicam closes e NÃO criam o loop
 *   `before-quit → quit → before-quit`;
 * - READY_TO_EXIT: todos os recursos aguardáveis foram encerrados na ordem
 *   correta; a saída final é permitida (o chamador sai com `app.exit(0)`).
 *
 * Ordem real e obrigatória (nunca `void close()` como garantia final):
 *
 *   1. flush do estado estável atual (workspace ativo — capture fresco);
 *   2. drain da fila Tupiniquim (TUDO que já estava enfileirado);
 *   3. retry final único de roots dirty (se falhar, durabilidade NÃO é
 *      declarada; segue sem bloquear indefinidamente);
 *   4. drain novamente (o retry também é aguardado);
 *   5. close dos providers (aguardável, uma vez cada);
 *   6. close do SQLite SOMENTE DEPOIS de toda a persistência (uma vez);
 *   7. READY_TO_EXIT + relatório sanitizado + saída final.
 *
 * Crash NÃO é shutdown: este sequenciador só cobre o encerramento normal. Um
 * crash pode perder estado ainda não commitado; o último snapshot já commitado
 * permanece íntegro (transação única no worker SQLite) e o recovery fail-closed
 * do Incremento 2/4 nunca aceita snapshot parcial.
 *
 * Cada passo é aguardado com orçamento de tempo próprio (`stepTimeoutMs`): um
 * passo que excede o orçamento é registrado como TIMEOUT no relatório
 * sanitizado e o sequenciamento CONTINUA — o processo nunca fica bloqueado
 * indefinidamente. Como o worker SQLite processa as operações em ordem FIFO,
 * mesmo no caminho de timeout o `close` é postado DEPOIS de qualquer escrita
 * já enfileirada: nenhuma persistência ocorre depois do database fechado.
 */

export type AwaitedShutdownPhase = 'RUNNING' | 'SHUTTING_DOWN' | 'READY_TO_EXIT'

/** Resultado do flush do estado estável atual. */
export type StableStateFlushResult = TupiniquimSnapshotFlushOutcome | { status: 'NO_ACTIVE_WORKSPACE' }

/**
 * Plano de encerramento injetado pelo processo main (ou por testes): cada
 * capacidade é uma função aguardável isolada, na ordem canônica acima.
 */
export interface AwaitedShutdownPlan {
  /** 1. Flush do estado estável atual (workspace ativo). */
  flushStableState(): Promise<StableStateFlushResult>
  /** 2/4. Aguarda TODA a fila Tupiniquim enfileirada antes da chamada. */
  drainQueue(): Promise<TupiniquimSnapshotDrainResult>
  /** 3. Roots dirty para o retry final único. */
  dirtyWorkspaceRoots(): readonly string[]
  /** 3. Retry final completo do root dirty (novo flush). */
  retryDirtyWorkspace(workspaceRoot: string): Promise<TupiniquimSnapshotFlushOutcome>
  /** 5. Encerra providers (aguardável; uma vez cada). */
  closeProviders(): Promise<void>
  /** 6. Encerra o SQLite DEPOIS de toda a persistência (uma vez). */
  closeDatabase(): Promise<void>
}

export interface AwaitedShutdownReport {
  phase: AwaitedShutdownPhase
  /** true quando algum passo falhou ou expirou (durabilidade não declarada / recurso não confirmado). */
  degraded: boolean
  stableStateFlush: StableStateFlushResult['status'] | 'TIMEOUT'
  /** true quando os dois drains resolveram dentro do orçamento. */
  persistenceSettled: boolean
  dirtyRootsRetried: number
  dirtyRootsRemaining: number
  providersClosed: boolean
  databaseClosed: boolean
  /** Passos que excederam o orçamento de tempo (nomes estáveis, sanitizados). */
  timedOutSteps: readonly string[]
  /** Passos que lançaram erro (nomes estáveis, sanitizados; sem mensagem bruta). */
  failedSteps: readonly string[]
  durationMs: number
}

export interface AwaitedShutdownCoordinatorOptions {
  /** Orçamento por passo (default 10s). Nunca infinito. */
  stepTimeoutMs?: number
  /** Relatório sanitizado para o AuditLog (o coordenador não loga nada sozinho). */
  onReport?: (report: AwaitedShutdownReport) => void | Promise<void>
  /** Saída final: chamado exatamente uma vez, com todos os recursos já encerrados. */
  onReadyToExit?: (report: AwaitedShutdownReport) => void
}

const defaultStepTimeoutMs = 10_000

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

/**
 * Passo aguardável blindado: um passo que lança ou excede o orçamento NUNCA
 * interrompe o sequenciamento — o resultado registra o ocorrido (nomes
 * estáveis, sem mensagem bruta) e o shutdown continua determinístico.
 */
const settle = async <T>(promise: Promise<T>, timeoutMs: number): Promise<{ value?: T; timedOut: boolean; failed: boolean }> => {
  try {
    const outcome = await withTimeout(promise, timeoutMs)
    return { ...outcome, failed: false }
  } catch {
    return { timedOut: false, failed: true }
  }
}

export class AwaitedShutdownCoordinator {
  private phase: AwaitedShutdownPhase = 'RUNNING'
  private execution: Promise<AwaitedShutdownReport> | null = null
  private finishedReport: AwaitedShutdownReport | null = null
  private readonly stepTimeoutMs: number

  public constructor(
    private readonly plan: AwaitedShutdownPlan,
    private readonly options: AwaitedShutdownCoordinatorOptions = {}
  ) {
    this.stepTimeoutMs = options.stepTimeoutMs ?? defaultStepTimeoutMs
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
   * - chamadas após READY_TO_EXIT resolvem imediatamente com o relatório
   *   final (idempotente; nenhum recurso é reencerrado).
   */
  public begin(): Promise<AwaitedShutdownReport> {
    if (this.phase === 'READY_TO_EXIT' && this.finishedReport !== null) return Promise.resolve(this.finishedReport)
    if (this.execution !== null) return this.execution
    this.phase = 'SHUTTING_DOWN'
    this.execution = this.run()
    return this.execution
  }

  private async run(): Promise<AwaitedShutdownReport> {
    const startedAt = Date.now()
    const timedOutSteps: string[] = []
    const failedSteps: string[] = []
    let stableStateFlush: AwaitedShutdownReport['stableStateFlush'] = 'TIMEOUT'
    let persistenceSettled = true
    let dirtyRootsRetried = 0
    let providersClosed = false
    let databaseClosed = false
    let dirtyRoots: readonly string[] = []

    // 1. Flush do estado estável atual (workspace ativo).
    const stable = await settle(Promise.resolve(this.plan.flushStableState()), this.stepTimeoutMs)
    if (stable.timedOut) {
      timedOutSteps.push('flushStableState')
      persistenceSettled = false
    } else if (stable.failed) {
      failedSteps.push('flushStableState')
      stableStateFlush = 'FAILED'
    } else if (stable.value !== undefined) {
      stableStateFlush = stable.value.status
    }

    // 2. Drain da fila Tupiniquim: TUDO que já estava enfileirado.
    const firstDrain = await settle(Promise.resolve(this.plan.drainQueue()), this.stepTimeoutMs)
    if (firstDrain.timedOut) {
      timedOutSteps.push('drainQueue')
      persistenceSettled = false
    } else if (firstDrain.failed) {
      failedSteps.push('drainQueue')
      persistenceSettled = false
    } else if (firstDrain.value !== undefined) {
      dirtyRoots = firstDrain.value.dirtyWorkspaces
    } else {
      dirtyRoots = this.safeDirtyRoots()
    }

    // 3. Retry final ÚNICO por root dirty. Se falhar (ou expirar), a
    //    durabilidade NÃO é declarada — o root permanece no relatório e o
    //    shutdown continua determinístico. Nunca um loop de retry.
    for (const workspaceRoot of dirtyRoots) {
      dirtyRootsRetried += 1
      const retry = await settle(Promise.resolve(this.plan.retryDirtyWorkspace(workspaceRoot)), this.stepTimeoutMs)
      if (retry.timedOut) {
        timedOutSteps.push('retryDirtyWorkspace')
        persistenceSettled = false
      } else if (retry.failed) {
        failedSteps.push('retryDirtyWorkspace')
      }
    }

    // 4. Drain pós-retry: o retry também é aguardado antes dos closes.
    const finalDrain = await settle(Promise.resolve(this.plan.drainQueue()), this.stepTimeoutMs)
    if (finalDrain.timedOut) {
      timedOutSteps.push('drainQueueAfterRetry')
      persistenceSettled = false
    } else if (finalDrain.failed) {
      failedSteps.push('drainQueueAfterRetry')
      persistenceSettled = false
    }
    const dirtyRootsRemaining = this.safeDirtyRoots().length

    // 5. Providers: aguardados, uma única vez.
    const providers = await settle(Promise.resolve(this.plan.closeProviders()), this.stepTimeoutMs)
    if (providers.timedOut) timedOutSteps.push('closeProviders')
    else if (providers.failed) failedSteps.push('closeProviders')
    else providersClosed = true

    // 6. SQLite: fechado SOMENTE depois de toda a persistência acima.
    const database = await settle(Promise.resolve(this.plan.closeDatabase()), this.stepTimeoutMs)
    if (database.timedOut) timedOutSteps.push('closeDatabase')
    else if (database.failed) failedSteps.push('closeDatabase')
    else databaseClosed = true

    const report: AwaitedShutdownReport = {
      phase: 'READY_TO_EXIT',
      degraded: timedOutSteps.length > 0 || failedSteps.length > 0 || dirtyRootsRemaining > 0 || !providersClosed || !databaseClosed,
      stableStateFlush,
      persistenceSettled,
      dirtyRootsRetried,
      dirtyRootsRemaining,
      providersClosed,
      databaseClosed,
      timedOutSteps,
      failedSteps,
      durationMs: Date.now() - startedAt
    }

    // 7. READY_TO_EXIT: relatório sanitizado (audit é aguardado, com orçamento
    //    próprio — se o próprio AuditLog travar, a saída final não pode ficar
    //    pendurada nele) e saída final exatamente uma vez.
    this.phase = 'READY_TO_EXIT'
    this.finishedReport = report
    if (this.options.onReport !== undefined) {
      await withTimeout(Promise.resolve(this.options.onReport(report)), this.stepTimeoutMs)
    }
    this.options.onReadyToExit?.(report)
    return report
  }

  private safeDirtyRoots(): readonly string[] {
    try {
      return this.plan.dirtyWorkspaceRoots()
    } catch {
      return []
    }
  }
}

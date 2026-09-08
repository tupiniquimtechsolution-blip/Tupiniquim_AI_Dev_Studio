import { describe, expect, it } from 'vitest'
import { AwaitedShutdownCoordinator, type AwaitedShutdownPlan, type AwaitedShutdownReport } from './app-shutdown'
import type { TupiniquimSnapshotDrainResult, TupiniquimSnapshotFlushOutcome } from './tupiniquim-session-persistence'

/**
 * Wave 16 — Incremento 4/4: shutdown one-shot aguardável.
 *
 * Invariantes under test:
 * - ordem real: flush estável → drain → retry dirty → drain → providers →
 *   database (NUNCA database antes da persistência; nunca `void close()`);
 * - one-shot + guarda de reentrada: duas solicitações de quit executam o
 *   shutdown UMA vez; `database.close()` e provider closes ocorrem 1x;
 * - FAILED não trava o shutdown: durabilidade não declarada (dirty restante),
 *   erro reportado de forma sanitizada, nada parcial persistido, término
 *   determinístico;
 * - passo lento é aguardado; passo travado é cercado por timeout (nunca
 *   bloqueio indefinido) e o sequenciamento continua;
 * - READY_TO_EXIT é final: begin() posterior não reexecuta nada.
 */

const workspaceA = 'F:\\CODEX\\workspace-a'

const committed = (workspaceRoot: string, turns: number): TupiniquimSnapshotFlushOutcome => ({
  workspaceRoot,
  status: 'COMMITTED',
  turns,
  bindings: 1,
  seenProviders: 1
})

const failed = (workspaceRoot: string): TupiniquimSnapshotFlushOutcome => ({
  workspaceRoot,
  status: 'FAILED',
  turns: 0,
  bindings: 0,
  seenProviders: 0,
  error: 'Falha simulada da boundary durável.'
})

interface PlanHarness {
  plan: AwaitedShutdownPlan
  events: string[]
  counts: { flushStableState: number; drains: number; retries: number; closeProviders: number; closeDatabase: number }
  dirty: string[]
}

const createPlan = (input: {
  stableFlush?: () => Promise<TupiniquimSnapshotFlushOutcome | { status: 'NO_ACTIVE_WORKSPACE' }>
  retryOutcome?: (workspaceRoot: string) => Promise<TupiniquimSnapshotFlushOutcome>
  closeProvidersBehavior?: () => Promise<void>
  closeDatabaseBehavior?: () => Promise<void>
} = {}): PlanHarness => {
  const events: string[] = []
  const counts = { flushStableState: 0, drains: 0, retries: 0, closeProviders: 0, closeDatabase: 0 }
  let dirty: string[] = []
  const plan: AwaitedShutdownPlan = {
    flushStableState: input.stableFlush ?? (async () => {
      counts.flushStableState += 1
      events.push('flushStableState:start')
      await new Promise((resolve) => setTimeout(resolve, 20))
      events.push('flushStableState:end')
      return committed(workspaceA, 2)
    }),
    drainQueue: (): Promise<TupiniquimSnapshotDrainResult> => {
      counts.drains += 1
      events.push(`drain:${String(counts.drains)}`)
      return Promise.resolve({ dirtyWorkspaces: [...dirty] })
    },
    dirtyWorkspaceRoots: () => [...dirty],
    retryDirtyWorkspace: input.retryOutcome ?? ((workspaceRoot: string) => {
      counts.retries += 1
      events.push(`retry:${workspaceRoot}`)
      dirty = dirty.filter((root) => root !== workspaceRoot)
      return Promise.resolve(committed(workspaceRoot, 2))
    }),
    closeProviders: input.closeProvidersBehavior ?? (() => {
      counts.closeProviders += 1
      events.push('closeProviders')
      return Promise.resolve()
    }),
    closeDatabase: input.closeDatabaseBehavior ?? (() => {
      counts.closeDatabase += 1
      events.push('closeDatabase')
      return Promise.resolve()
    })
  }
  return { plan, events, counts, get dirty () { return dirty }, set dirty (value: string[]) { dirty = value } }
}

describe('AwaitedShutdownCoordinator — shutdown one-shot aguardável', () => {
  it('flush lento: shutdown espera a persistência terminar ANTES de fechar database e providers', async () => {
    const harness = createPlan()
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)

    const shutdown = coordinator.begin()
    // Enquanto o flush lento (20ms) está em andamento, NADA foi fechado.
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(harness.events).not.toContain('closeProviders')
    expect(harness.events).not.toContain('closeDatabase')
    expect(harness.counts.closeDatabase).toBe(0)

    const report = await shutdown
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.stableStateFlush).toBe('COMMITTED')
    expect(report.databaseClosed).toBe(true)
    expect(report.providersClosed).toBe(true)
    expect(report.degraded).toBe(false)
    // Ordem real comprovada: flush → drains → providers → database.
    expect(harness.events).toEqual([
      'flushStableState:start',
      'flushStableState:end',
      'drain:1',
      'drain:2',
      'closeProviders',
      'closeDatabase'
    ])
  })

  it('reentrada: duas solicitações de shutdown executam o shutdown UMA vez, closes 1x cada', async () => {
    const harness = createPlan()
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)

    const first = coordinator.begin()
    const second = coordinator.begin()
    const third = coordinator.begin()
    const [firstReport, secondReport, thirdReport] = await Promise.all([first, second, third])

    expect(coordinator.state()).toBe('READY_TO_EXIT')
    expect(harness.counts.flushStableState).toBe(1)
    expect(harness.counts.drains).toBe(2)
    expect(harness.counts.closeProviders).toBe(1)
    expect(harness.counts.closeDatabase).toBe(1)
    expect(secondReport).toBe(firstReport)
    expect(thirdReport).toBe(firstReport)

    // begin() DEPOIS de READY_TO_EXIT é idempotente: nada reexecuta.
    const late = await coordinator.begin()
    expect(late).toBe(firstReport)
    expect(harness.counts.flushStableState).toBe(1)
    expect(harness.counts.closeDatabase).toBe(1)
  })

  it('nenhuma persistência depois do database fechado: todo flush precede o close', async () => {
    const persistenceEvents: string[] = []
    const harness = createPlan({
      stableFlush: () => {
        persistenceEvents.push('stable')
        return Promise.resolve(committed(workspaceA, 1))
      },
      retryOutcome: (workspaceRoot: string) => {
        persistenceEvents.push(`retry:${workspaceRoot}`)
        return Promise.resolve(committed(workspaceRoot, 2))
      }
    })
    harness.dirty = [workspaceA]
    const closes: string[] = []
    const harness2 = harness
    const coordinator = new AwaitedShutdownCoordinator({
      ...harness2.plan,
      closeDatabase: async () => {
        closes.push('database')
        await harness2.plan.closeDatabase()
      }
    })

    const report = await coordinator.begin()
    expect(report.databaseClosed).toBe(true)
    // O último evento de persistência acontece ANTES do fechamento do SQLite.
    for (const event of persistenceEvents) {
      expect(harness2.events.indexOf(event)).toBeLessThan(harness2.events.indexOf('closeDatabase'))
    }
    expect(closes).toEqual(['database'])
  })

  it('dirty root FAILED: durabilidade NÃO declarada, erro sanitizado, término determinístico', async () => {
    const harness = createPlan({
      stableFlush: () => {
        harness.dirty = [workspaceA]
        return Promise.resolve(failed(workspaceA))
      },
      retryOutcome: (workspaceRoot: string) => Promise.resolve(failed(workspaceRoot))
    })
    const reports: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(harness.plan, {
      onReport: (report) => { reports.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })

    const report = await coordinator.begin()
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.stableStateFlush).toBe('FAILED')
    expect(report.dirtyRootsRetried).toBe(1)
    expect(report.dirtyRootsRemaining).toBe(1)
    expect(report.degraded).toBe(true)
    expect(report.persistenceSettled).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(report.providersClosed).toBe(true)
    // Relatório sanitizado: nenhum texto de conversa, path ou payload —
    // somente contagens e nomes estáveis de passo.
    expect(JSON.stringify(report)).not.toContain('Falha simulada')
    expect(reports).toHaveLength(1)
    expect(reports[0]).toBe(report)
    expect(exits).toHaveLength(1)
  })

  it('dirty root com retry bem-sucedido: durabilidade declarada e shutdown limpo', async () => {
    const harness = createPlan({
      stableFlush: () => {
        harness.dirty = [workspaceA]
        return Promise.resolve(failed(workspaceA))
      }
      // retryOutcome default converge e limpa o dirty.
    })
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)

    const report = await coordinator.begin()
    expect(report.stableStateFlush).toBe('FAILED')
    expect(report.dirtyRootsRetried).toBe(1)
    expect(report.dirtyRootsRemaining).toBe(0)
    expect(report.degraded).toBe(false)
    expect(harness.events).toContain(`retry:${workspaceA}`)
  })

  it('workspace sem sessão ativa: flush NO_ACTIVE_WORKSPACE e shutdown normal', async () => {
    const harness = createPlan({
      stableFlush: () => Promise.resolve({ status: 'NO_ACTIVE_WORKSPACE' } as const)
    })
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)
    const report = await coordinator.begin()
    expect(report.stableStateFlush).toBe('NO_ACTIVE_WORKSPACE')
    expect(report.degraded).toBe(false)
    expect(report.databaseClosed).toBe(true)
  })

  it('passo travado é cercado pelo orçamento: nunca bloqueia indefinidamente, sequência continua', async () => {
    const harness = createPlan({
      stableFlush: () => new Promise(() => undefined) // nunca resolve
    })
    const coordinator = new AwaitedShutdownCoordinator(harness.plan, { stepTimeoutMs: 40 })

    const startedAt = Date.now()
    const report = await coordinator.begin()
    const elapsed = Date.now() - startedAt
    expect(report.timedOutSteps).toEqual(['flushStableState'])
    expect(report.stableStateFlush).toBe('TIMEOUT')
    expect(report.persistenceSettled).toBe(false)
    expect(report.degraded).toBe(true)
    // O database AINDA é fechado (depois da fila, na ordem), e a saída acontece.
    expect(report.databaseClosed).toBe(true)
    expect(report.providersClosed).toBe(true)
    expect(elapsed).toBeLessThan(2_000)
    expect(harness.events).toContain('closeDatabase')
  })

  it('passo que lança não interrompe o sequenciamento: close do database e saída ainda ocorrem', async () => {
    const harness = createPlan({
      closeProvidersBehavior: () => {
        harness.counts.closeProviders += 1
        return Promise.reject(new Error('provider close explodiu'))
      }
    })
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)

    const report = await coordinator.begin()
    expect(report.failedSteps).toEqual(['closeProviders'])
    expect(report.providersClosed).toBe(false)
    expect(report.databaseClosed).toBe(true)
    expect(report.degraded).toBe(true)
    expect(coordinator.state()).toBe('READY_TO_EXIT')
  })

  it('state machine RUNNING → SHUTTING_DOWN → READY_TO_EXIT observável', async () => {
    const harness = createPlan()
    const coordinator = new AwaitedShutdownCoordinator(harness.plan)
    expect(coordinator.state()).toBe('RUNNING')
    expect(coordinator.isReadyToExit()).toBe(false)

    const shutdown = coordinator.begin()
    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(coordinator.isReadyToExit()).toBe(false)

    await shutdown
    expect(coordinator.state()).toBe('READY_TO_EXIT')
    expect(coordinator.isReadyToExit()).toBe(true)
  })
})

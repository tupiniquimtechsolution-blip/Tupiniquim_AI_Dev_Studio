import { describe, expect, it } from 'vitest'
import { AwaitedShutdownCoordinator, type AwaitedShutdownPlan, type AwaitedShutdownReport } from './app-shutdown'
import { PrivilegedRuntimeGate, TupiniquimSessionService, agentRuntimeSealedMessage } from './tupiniquim-session'
import { TupiniquimSessionSnapshotCoordinator, type TupiniquimSnapshotDrainResult, type TupiniquimSessionSnapshotStore } from './tupiniquim-session-persistence'
import type { TupiniquimDurableSnapshot } from '@tupiniquim/contracts'

/**
 * Wave 16 — Incremento 4/4 (SEGUNDA CORREÇÃO DA AUDITORIA EXTERNA —
 * Bloqueios 1/2/3): shutdown one-shot aguardável com RUNTIME QUIESCENCE real,
 * providers e database CRÍTICOS.
 *
 * Invariantes under test:
 * - SEAL real: durante SHUTTING_DOWN, eventos tardios (production-path
 *   schedule/flush/commitSendTurn) NÃO entram na fila após o seal; o drain
 *   retorna quiescent: true; nada é escrito depois do close do database;
 * - RUNTIME QUIESCENCE (Bloqueio 1): operações JÁ iniciadas (workspace
 *   switch, send, provider select, provider busy) convergem ANTES do capture
 *   final — o MESMO gate que o main usa; novas operações são recusadas
 *   imediatamente; hang de quiescência → deadline crítico → ABORTED;
 * - ordem real: seal → runtime quiescence → flushFinal → drain → retry →
 *   drain → providers (CRÍTICO) → sealFinal → database (CRÍTICO);
 * - PROVIDERS são CRÍTICOS (Bloqueio 2): providers gravam history DIRETO no
 *   SQLite (fora do snapshot coordinator) — close pendente NÃO libera
 *   database.close; falha → ABORTED; zero history write-after-close;
 * - DATABASE CLOSE é CRÍTICO (Bloqueio 3): rejeição → ABORTED com saída
 *   forçada (nunca READY_TO_EXIT/app.exit(0) com banco não confirmado);
 * - one-shot + guarda de reentrada: dois quits executam 1x, closes 1x cada;
 * - DELAYED CHAIN: flush aguardando a chain não é abandonado por timeout —
 *   o database só fecha DEPOIS da chain destravar e do drain confirmar
 *   quiescência; zero write-after-close;
 * - DEADLINE crítico: hang real em QUALQUER etapa crítica transita para
 *   ABORTED — database NÃO fecha, nada é declarado seguro, saída forçada;
 * - FAILED não trava o shutdown: durabilidade não declarada, término
 *   determinístico, relatório sanitizado.
 */

const workspaceA = 'F:\\CODEX\\workspace-a'

/** Store fake com log de eventos para provar ordenação e zero write-after-close. */
interface RecordingStore {
  store: TupiniquimSessionSnapshotStore
  log: string[]
  commits: number
  closeDatabase: () => Promise<void>
}

const createRecordingStore = (input: { blockFirstCommit?: Promise<void> } = {}): RecordingStore => {
  const log: string[] = []
  let commits = 0
  let databaseClosed = false
  const store: TupiniquimSessionSnapshotStore = {
    putTupiniquimSessionSnapshot: () => Promise.reject(new Error('operação não usada pelo coordinator')),
    putTupiniquimSessionSnapshotWithThreadModel: async (snapshot) => {
      if (input.blockFirstCommit !== undefined && commits === 0) {
        log.push('commit:waiting-chain')
        await input.blockFirstCommit
      }
      if (databaseClosed) throw new Error('WRITE-AFTER-CLOSE DETECTADO')
      commits += 1
      log.push(`commit:${String(commits)}:turns=${String(snapshot.turns.length)}`)
    }
  }
  return {
    store,
    log,
    get commits () { return commits },
    closeDatabase: () => {
      if (databaseClosed) return Promise.reject(new Error('close duplicado'))
      databaseClosed = true
      log.push('database:close')
      return Promise.resolve()
    }
  }
}

/** Produção-path real: sessions + coordinator reais, store fake (boundary). */
const createProductionCoordinator = (recording: RecordingStore): TupiniquimSessionSnapshotCoordinator => {
  const sessions = new TupiniquimSessionService()
  sessions.open(workspaceA)
  sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
  return new TupiniquimSessionSnapshotCoordinator(sessions, recording.store)
}

const sessionsOf = (coordinator: TupiniquimSessionSnapshotCoordinator): TupiniquimSessionService =>
  (coordinator as unknown as { sessions: TupiniquimSessionService }).sessions

/**
 * Runtime de produção para os testes: o MESMO PrivilegedRuntimeGate que o
 * main usa (agentBusy controlável = estado busy/starting dos providers) +
 * log de passos do plan para provar ordenação.
 */
interface ProductionRuntime {
  gate: PrivilegedRuntimeGate
  steps: string[]
  setAgentBusy: (busy: boolean) => void
}

const createProductionRuntime = (input: { agentBusy?: boolean } = {}): ProductionRuntime => {
  let agentBusy = input.agentBusy ?? false
  const steps: string[] = []
  const gate = new PrivilegedRuntimeGate(() => agentBusy)
  return { gate, steps, setAgentBusy: (busy: boolean) => { agentBusy = busy } }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms) })

const deferred = (): { gate: Promise<void>; release: () => void } => {
  let releaseFn: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { releaseFn = resolve })
  return { gate, release: () => releaseFn?.() }
}

const productionPlan = (
  persistence: TupiniquimSessionSnapshotCoordinator,
  recording: RecordingStore,
  runtime: ProductionRuntime = createProductionRuntime(),
  extras: { closeProviders?: () => Promise<void>; awaitRuntimeQuiescent?: () => Promise<void> } = {}
): AwaitedShutdownPlan => ({
  sealForShutdown: () => {
    runtime.steps.push('step:sealForShutdown')
    runtime.gate.sealForShutdown()
    persistence.seal()
  },
  awaitRuntimeQuiescent: extras.awaitRuntimeQuiescent ?? (() => {
    runtime.steps.push('step:awaitRuntimeQuiescent')
    return runtime.gate.awaitQuiescent()
  }),
  flushStableState: () => {
    runtime.steps.push('step:flushStableState')
    return persistence.flushFinal(workspaceA)
  },
  drainQueue: () => persistence.drain(),
  dirtyWorkspaceRoots: () => [...persistence.dirtyWorkspaces().keys()],
  retryDirtyWorkspace: (root: string) => persistence.flushFinal(root),
  closeProviders: extras.closeProviders ?? (() => {
    runtime.steps.push('step:closeProviders')
    return Promise.resolve()
  }),
  sealFinalPersistence: () => { persistence.sealFinal() },
  closeDatabase: () => recording.closeDatabase()
})

describe('AwaitedShutdownCoordinator — runtime quiescence, seal/quiesce e one-shot', () => {
  it('flush lento: shutdown espera a persistência terminar ANTES de fechar o database', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording))

    const report = await coordinator.begin()
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.aborted).toBe(false)
    expect(report.sealed).toBe(true)
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    expect(report.stableStateFlush).toBe('COMMITTED')
    expect(report.databaseClosed).toBe(true)
    expect(report.providersClosed).toBe(true)
    expect(report.degraded).toBe(false)
    // Ordem real comprovada: capture final → close do database.
    expect(recording.log).toEqual(['commit:1:turns=0', 'database:close'])
  })

  it('reentrada: duas solicitações de shutdown executam o shutdown UMA vez, closes 1x cada', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const closes: string[] = []
    const plan: AwaitedShutdownPlan = {
      ...productionPlan(persistence, recording),
      closeDatabase: async () => { closes.push('database'); await recording.closeDatabase() }
    }
    const coordinator = new AwaitedShutdownCoordinator(plan)

    const first = coordinator.begin()
    const second = coordinator.begin()
    const third = coordinator.begin()
    const [firstReport, secondReport, thirdReport] = await Promise.all([first, second, third])

    expect(coordinator.state()).toBe('READY_TO_EXIT')
    expect(closes).toEqual(['database'])
    expect(secondReport).toBe(firstReport)
    expect(thirdReport).toBe(firstReport)

    // begin() DEPOIS de READY_TO_EXIT é idempotente: nada reexecuta.
    const late = await coordinator.begin()
    expect(late).toBe(firstReport)
    expect(closes).toEqual(['database'])
  })

  it('nenhuma persistência depois do database fechado: todo commit precede o close no log', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'pergunta estável', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording))

    const report = await coordinator.begin()
    expect(report.databaseClosed).toBe(true)
    // O único commit (capture final com o turn) acontece ANTES do close.
    expect(recording.log).toEqual(['commit:1:turns=1', 'database:close'])
    // Pós-shutdown: nenhuma fonte consegue escrever (intake FINAL).
    expect(persistence.intakeState()).toBe('FINAL')
    sessions.appendTurn({ role: 'user', text: 'evento tardio', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    persistence.schedule(workspaceA)
    await expect(persistence.flush(workspaceA)).resolves.toMatchObject({ status: 'SEALED' })
    await expect(persistence.flushFinal(workspaceA)).resolves.toMatchObject({ status: 'SEALED' })
    expect(recording.commits).toBe(1)
    expect(recording.log.filter((entry) => entry.startsWith('commit:'))).toHaveLength(1)
  })

  it('selo pós-seal (primeira correção, production-path): evento tardio durante SHUTTING_DOWN não entra após o seal; drain quiescente; zero write pós-close', async () => {
    const release = deferred()
    const recording = createRecordingStore({ blockFirstCommit: release.gate })
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)

    // Produção-path: user turn estável agendado ANTES do shutdown.
    sessions.appendTurn({ role: 'user', text: 'antes do shutdown', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    persistence.schedule(workspaceA)

    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording))
    const finished = coordinator.begin()
    // SHUTTING_DOWN em andamento: a chain está bloqueada no primeiro commit.
    await sleep(15)
    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(recording.log).toContain('commit:waiting-chain')
    expect(recording.log).not.toContain('database:close')
    expect(persistence.intakeState()).toBe('SEALED')

    // Evento tardio de provider (publishAgentEvent → schedule) e flush direto:
    // NÃO podem entrar após o seal.
    sessions.appendTurn({ role: 'user', text: 'evento tardio pós-seal', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2' })
    persistence.schedule(workspaceA)
    const sealedFlush = await persistence.flush(workspaceA)
    expect(sealedFlush.status).toBe('SEALED')
    await expect(persistence.commitSendTurn({
      provider: 'ollama',
      reference: { threadId: 'thread-ollama', turnId: 'turn-3', model: 'modelo-a' },
      message: 'send tardio',
      persistedThread: null,
      pendingContextTurnIds: [],
      workspaceRoot: workspaceA
    })).rejects.toThrow('selada')

    // Libera a chain: o flush pré-seal termina, o capture final também.
    release.release()
    const final = await finished
    expect(final.phase).toBe('READY_TO_EXIT')
    expect(final.runtimeQuiescent).toBe(true)
    expect(final.persistenceQuiescent).toBe(true)
    expect(final.databaseClosed).toBe(true)
    expect(final.degraded).toBe(false)

    // O turno tardio NÃO foi persistido: commits = pré-seal + capture final.
    expect(recording.commits).toBe(2)
    // Zero write-after-close: nada após database:close no log.
    expect(recording.log.at(-1)).toBe('database:close')
    // E o drain pós-close continua quiescente sem novo trabalho.
    const drained = await persistence.drain()
    expect(drained.quiescent).toBe(true)
    expect(drained.dirtyWorkspaces).toEqual([])
  })

  it('BLOQUEIO 2 primeira correção (delayed chain): flush esperando a chain NÃO é abandonado; database só fecha depois da quiescência real', async () => {
    const release = deferred()
    const recording = createRecordingStore({ blockFirstCommit: release.gate })
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)

    // Reprodução determinística: um flush pré-existente segura a chain; o
    // capture final do shutdown fica AGUARDANDO a chain.
    sessions.appendTurn({ role: 'user', text: 'flush que segura a chain', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    persistence.schedule(workspaceA)
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording), { criticalDeadlineMs: 60_000 })
    const finished = coordinator.begin()

    // Orçamento/timeout de passo NÃO existe na seção crítica: depois de
    // várias voltas do event loop o database continua ABERTO enquanto o flush
    // ainda pode chegar ao commitNow.
    for (let tick = 0; tick < 6; tick += 1) {
      await sleep(15)
      expect(coordinator.state()).toBe('SHUTTING_DOWN')
      expect(recording.log).not.toContain('database:close')
    }

    // Libera a chain: flush termina; drain confirma quiescência; SÓ ENTÃO o
    // database fecha.
    release.release()
    const report = await finished
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.persistenceQuiescent).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(report.aborted).toBe(false)
    expect(recording.log).toEqual(['commit:waiting-chain', 'commit:1:turns=1', 'commit:2:turns=1', 'database:close'])
    // Prova de zero write-after-close: nenhuma entrada depois do close.
    expect(recording.log.at(-1)).toBe('database:close')
    expect(recording.commits).toBe(2)
  })

  it('BLOQUEIO 2 primeira correção (deadline crítico): chain travada para sempre → ABORTED honesto, sem close do database e sem READY_TO_EXIT', async () => {
    // Chain que NUNCA destrava: sem timeout-abandon, a única saída é o
    // deadline crítico — que não finge databaseClosed/persistenceQuiescent.
    const never = new Promise<void>(() => undefined)
    const recording = createRecordingStore({ blockFirstCommit: never })
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'flush eterno', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    persistence.schedule(workspaceA)

    const aborts: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording), {
      criticalDeadlineMs: 60,
      onAbort: (report) => { aborts.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })

    const startedAt = Date.now()
    const report = await coordinator.begin()
    expect(Date.now() - startedAt).toBeLessThan(5_000)
    expect(report.phase).toBe('ABORTED')
    expect(report.aborted).toBe(true)
    expect(report.abortReason).toBe('CRITICAL_DEADLINE')
    expect(report.databaseClosed).toBe(false)
    expect(report.persistenceQuiescent).toBe(false)
    expect(report.providersClosed).toBe(false)
    expect(report.degraded).toBe(true)
    expect(coordinator.state()).toBe('ABORTED')
    expect(coordinator.isReadyToExit()).toBe(false)
    // Saída forçada exatamente uma vez; NENHUMA saída normal.
    expect(aborts).toHaveLength(1)
    expect(exits).toHaveLength(0)
    // O database NUNCA foi fechado (sem close no log).
    expect(recording.log).not.toContain('database:close')
    // begin() pós-ABORTED é idempotente.
    const again = await coordinator.begin()
    expect(again).toBe(report)
    expect(aborts).toHaveLength(1)
  })

  it('quiescência de persistência não provada (drain sem seal) → ABORTED: o database não fecha sem a prova', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    // Plano INCORRETO de propósito: o drainQueue ignora o seal do coordinator
    // (retorna quiescent false porque nada foi selado) — o sequenciador TEM
    // que recusar fechar o database.
    const unsealedPlan: AwaitedShutdownPlan = {
      ...productionPlan(persistence, recording),
      sealForShutdown: () => undefined,
      drainQueue: (): Promise<TupiniquimSnapshotDrainResult> => Promise.resolve({ dirtyWorkspaces: [], quiescent: false })
    }
    const coordinator = new AwaitedShutdownCoordinator(unsealedPlan)
    const report = await coordinator.begin()
    expect(report.phase).toBe('ABORTED')
    expect(report.abortReason).toBe('NOT_QUIESCENT')
    expect(report.databaseClosed).toBe(false)
    expect(recording.log).not.toContain('database:close')
  })

  it('seal que falha → ABORTED com SEAL_FAILURE (nenhum close)', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const plan: AwaitedShutdownPlan = {
      ...productionPlan(persistence, recording),
      sealForShutdown: () => { throw new Error('gate indisponível') }
    }
    const coordinator = new AwaitedShutdownCoordinator(plan)
    const report = await coordinator.begin()
    expect(report.phase).toBe('ABORTED')
    expect(report.abortReason).toBe('SEAL_FAILURE')
    expect(report.sealed).toBe(false)
    expect(report.databaseClosed).toBe(false)
    expect(recording.log).not.toContain('database:close')
  })

  it('BLOQUEIO 1 segunda correção (workspace switch em andamento): quiescência aguardável — capture final SOMENTE depois do switch convergir', async () => {
    const runtime = createProductionRuntime()
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'estado estável do workspace A', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })

    // Operação JÁ iniciada ANTES do shutdown: workspace switch em andamento
    // (flush A lento / configure em execução — reprodução do race da
    // auditoria: o switch continuaria e ativaria B DEPOIS do capture).
    runtime.gate.beginWorkspaceSwitch()

    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording, runtime))
    const finished = coordinator.begin()
    await sleep(15)

    // O selo bloqueou NOVAS operações user-driven IMEDIATAMENTE.
    expect(() => runtime.gate.beginWorkspaceSwitch()).toThrow(agentRuntimeSealedMessage)
    expect(() => runtime.gate.beginSend()).toThrow(agentRuntimeSealedMessage)
    expect(() => runtime.gate.beginProviderSelect()).toThrow(agentRuntimeSealedMessage)
    expect(runtime.gate.isSealedForShutdown()).toBe(true)
    // Mas o shutdown NÃO prosseguiu: o capture final AINDA NÃO ocorreu porque
    // o switch antigo continua vivo (runtime não quiescente).
    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(runtime.steps).toContain('step:awaitRuntimeQuiescent')
    expect(runtime.steps).not.toContain('step:flushStableState')
    expect(recording.log).not.toContain('database:close')

    // O switch antigo converge (endWorkspaceSwitch): o runtime fica
    // quiescente e SOMENTE ENTÃO o capture final acontece.
    runtime.gate.endWorkspaceSwitch()
    const report = await finished
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(report.degraded).toBe(false)
    // Ordem comprovada: quiescência ANTES do capture final.
    expect(runtime.steps.indexOf('step:awaitRuntimeQuiescent')).toBeLessThan(runtime.steps.indexOf('step:flushStableState'))
    expect(recording.log.at(-1)).toBe('database:close')
  })

  it('BLOQUEIO 1 segunda correção (send em andamento): quiescência aguardável — capture final espera o send antigo estabilizar', async () => {
    const runtime = createProductionRuntime()
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'pergunta estável', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })

    // Send JÁ iniciado antes do before-quit: a preparação/execução continua
    // usando adapters/database (agent.send + commitSendTurn).
    runtime.gate.beginSend()

    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording, runtime))
    const finished = coordinator.begin()
    await sleep(15)

    // Novos sends são recusados; o send antigo continua vivo.
    expect(() => runtime.gate.beginSend()).toThrow(agentRuntimeSealedMessage)
    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(runtime.steps).not.toContain('step:flushStableState')
    expect(recording.log).not.toContain('database:close')

    // O send antigo termina (endSend — o commitSendTurn dele já encontrou o
    // intake selado e falhou closed, o que é o comportamento aprovado): o
    // runtime fica quiescente e o shutdown prossegue para o capture final.
    runtime.gate.endSend()
    const report = await finished
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(runtime.steps.indexOf('step:awaitRuntimeQuiescent')).toBeLessThan(runtime.steps.indexOf('step:flushStableState'))
  })

  it('BLOQUEIO 1 segunda correção (provider BUSY): turno em streaming segura a quiescência; notificação de estado resolve os waiters', async () => {
    // Provider já BUSY no instante do shutdown: o turno continua executando e
    // pode gravar AIThread/AITurn/AIEvent no SQLite — o runtime NÃO está
    // quiescente enquanto isso (documentação explícita do caminho seguro).
    const runtime = createProductionRuntime({ agentBusy: true })
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)

    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording, runtime))
    const finished = coordinator.begin()
    await sleep(15)

    expect(coordinator.state()).toBe('SHUTTING_DOWN')
    expect(runtime.steps).not.toContain('step:flushStableState')
    expect(recording.log).not.toContain('database:close')

    // O turno termina: busy → livre. A notificação de estado (o que
    // publishAgentEvent faz no main em CADA evento de agente) resolve os
    // waiters de quiescência deterministicamente.
    runtime.setAgentBusy(false)
    runtime.gate.notifyAgentStateChanged()

    const report = await finished
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(runtime.steps.indexOf('step:awaitRuntimeQuiescent')).toBeLessThan(runtime.steps.indexOf('step:flushStableState'))
  })

  it('BLOQUEIO 1 segunda correção (deadline): operação antiga que NUNCA converge → ABORTED sem capture e sem close', async () => {
    const runtime = createProductionRuntime()
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)

    // Workspace switch que nunca termina (operação travada).
    runtime.gate.beginWorkspaceSwitch()

    const aborts: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording, runtime), {
      criticalDeadlineMs: 60,
      onAbort: (report) => { aborts.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })
    const report = await coordinator.begin()

    expect(report.phase).toBe('ABORTED')
    expect(report.abortReason).toBe('CRITICAL_DEADLINE')
    expect(report.runtimeQuiescent).toBe(false)
    expect(report.databaseClosed).toBe(false)
    // O capture final NUNCA aconteceu (quiescência antes do flush).
    expect(runtime.steps).not.toContain('step:flushStableState')
    expect(recording.log).not.toContain('database:close')
    expect(aborts).toHaveLength(1)
    expect(exits).toHaveLength(0)
  })

  it('awaitRuntimeQuiescent que rejeita → ABORTED com RUNTIME_NOT_QUIESCENT (nenhum capture, nenhum close)', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const plan = productionPlan(persistence, recording, undefined, {
      awaitRuntimeQuiescent: () => Promise.reject(new Error('runtime indisponível'))
    })
    const coordinator = new AwaitedShutdownCoordinator(plan)
    const report = await coordinator.begin()
    expect(report.phase).toBe('ABORTED')
    expect(report.abortReason).toBe('RUNTIME_NOT_QUIESCENT')
    expect(report.failedSteps).toEqual(['awaitRuntimeQuiescent'])
    expect(report.runtimeQuiescent).toBe(false)
    expect(report.databaseClosed).toBe(false)
    expect(recording.log).not.toContain('database:close')
  })

  it('BLOQUEIO 2 segunda correção: provider close PENDENTE pode gravar history — database.close NÃO acontece até o provider fechar; zero history write-after-close', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'pergunta estável', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })

    const releaseProviderClose = deferred()
    const plan = productionPlan(persistence, recording, undefined, {
      // Provider close pendente: o provider ainda está vivo.
      closeProviders: async () => {
        recording.log.push('providers:closing')
        await releaseProviderClose.gate
        recording.log.push('providers:closed')
      }
    })
    const coordinator = new AwaitedShutdownCoordinator(plan, { criticalDeadlineMs: 60_000 })
    const finished = coordinator.begin()

    // Espera o shutdown chegar ao passo de providers (capture + drains já
    // concluídos com quiescência provada).
    while (!recording.log.includes('providers:closing')) await sleep(5)

    // Provider vivo durante o close pendente: grava history DIRETO no SQLite
    // (putAIThread/putAITurn/appendAIEvent — fora do snapshot coordinator).
    recording.log.push('history:turn-late')

    // Enquanto o provider close está pendente, o database NÃO fecha.
    expect(recording.log).not.toContain('database:close')
    expect(coordinator.state()).toBe('SHUTTING_DOWN')

    // O provider fecha: somente então o shutdown prossegue para o database.
    releaseProviderClose.release()
    const report = await finished
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.providersClosed).toBe(true)
    expect(report.databaseClosed).toBe(true)

    // PROVA de zero history write-after-database-close: TODA escrita de
    // history (e o próprio close dos providers) precede o database:close.
    expect(recording.log.indexOf('history:turn-late')).toBeLessThan(recording.log.indexOf('database:close'))
    expect(recording.log.indexOf('providers:closed')).toBeLessThan(recording.log.indexOf('database:close'))
    expect(recording.log.at(-1)).toBe('database:close')
  })

  it('BLOQUEIO 2 segunda correção (deadline): provider close que nunca resolve → ABORTED, database NÃO fecha, zero write-after-close', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)

    const plan = productionPlan(persistence, recording, undefined, {
      closeProviders: () => new Promise<void>(() => undefined) // nunca resolve
    })
    const aborts: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(plan, {
      criticalDeadlineMs: 60,
      onAbort: (report) => { aborts.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })
    const report = await coordinator.begin()

    expect(report.phase).toBe('ABORTED')
    expect(report.abortReason).toBe('CRITICAL_DEADLINE')
    // Progresso honesto: quiescências já provadas, mas providers/database NÃO.
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    expect(report.providersClosed).toBe(false)
    expect(report.databaseClosed).toBe(false)
    expect(recording.log).not.toContain('database:close')
    expect(aborts).toHaveLength(1)
    expect(exits).toHaveLength(0)
  })

  it('BLOQUEIO 2 segunda correção: close do provider que REJEITA → ABORTED com PROVIDERS_CLOSE_FAILED; database NÃO fecha', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const plan = productionPlan(persistence, recording, undefined, {
      closeProviders: () => Promise.reject(new Error('provider close explodiu'))
    })
    const aborts: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(plan, {
      onAbort: (report) => { aborts.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })

    const report = await coordinator.begin()
    expect(report.phase).toBe('ABORTED')
    expect(report.aborted).toBe(true)
    expect(report.abortReason).toBe('PROVIDERS_CLOSE_FAILED')
    expect(report.failedSteps).toEqual(['closeProviders'])
    expect(report.providersClosed).toBe(false)
    // Progresso honesto: runtime e persistência já estavam provados.
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    // O database NÃO fecha no caminho normal sem providers encerrados.
    expect(report.databaseClosed).toBe(false)
    expect(recording.log).not.toContain('database:close')
    expect(coordinator.state()).toBe('ABORTED')
    expect(aborts).toHaveLength(1)
    expect(exits).toHaveLength(0)
  })

  it('providers CRÍTICOS: close lento é aguardado integralmente; database fecha SOMENTE depois dos providers', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const plan = productionPlan(persistence, recording, undefined, {
      closeProviders: async () => {
        await sleep(30)
        recording.log.push('providers:closed')
      }
    })
    const coordinator = new AwaitedShutdownCoordinator(plan, { criticalDeadlineMs: 60_000 })

    const report = await coordinator.begin()
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.providersClosed).toBe(true)
    expect(report.databaseClosed).toBe(true)
    expect(report.degraded).toBe(false)
    // Ordem comprovada: providers encerrados ANTES do database.
    expect(recording.log.indexOf('providers:closed')).toBeLessThan(recording.log.indexOf('database:close'))
    expect(recording.log.at(-1)).toBe('database:close')
  })

  it('BLOQUEIO 3 segunda correção: close do database que REJEITA → ABORTED com DATABASE_CLOSE_FAILED; NUNCA READY_TO_EXIT/exit 0', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const plan: AwaitedShutdownPlan = {
      ...productionPlan(persistence, recording),
      closeDatabase: () => Promise.reject(new Error('worker já morto'))
    }
    const aborts: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const coordinator = new AwaitedShutdownCoordinator(plan, {
      onAbort: (report) => { aborts.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })

    const report = await coordinator.begin()
    // app.exit(0) JAMAIS acontece com o database não confirmado: a falha do
    // close é ABORTED com saída forçada (app.exit(1) no main).
    expect(report.phase).toBe('ABORTED')
    expect(report.aborted).toBe(true)
    expect(report.abortReason).toBe('DATABASE_CLOSE_FAILED')
    expect(report.failedSteps).toEqual(['closeDatabase'])
    expect(report.databaseClosed).toBe(false)
    // Progresso honesto: providers JÁ encerrados e quiescências provadas.
    expect(report.providersClosed).toBe(true)
    expect(report.runtimeQuiescent).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    expect(coordinator.state()).toBe('ABORTED')
    expect(aborts).toHaveLength(1)
    expect(exits).toHaveLength(0)
  })

  it('dirty root FAILED no capture final: retry final converge e o shutdown termina limpo', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    // Pré-condição: o primeiro commit do capture final falha UMA vez.
    let failures = 1
    const failingStore = {
      ...recording.store,
      putTupiniquimSessionSnapshotWithThreadModel: async (snapshot: TupiniquimDurableSnapshot) => {
        if (failures > 0) {
          failures -= 1
          throw new Error('Falha simulada da boundary durável.')
        }
        await recording.store.putTupiniquimSessionSnapshotWithThreadModel(snapshot)
      }
    }
    const sessions = sessionsOf(persistence)
    sessions.appendTurn({ role: 'user', text: 'pergunta', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, failingStore)
    const failedFlush = await coordinator.flush(workspaceA)
    expect(failedFlush.status).toBe('FAILED')
    expect(coordinator.isDirty(workspaceA)).toBe(true)

    const shutdown = new AwaitedShutdownCoordinator(productionPlan(coordinator, recording))
    const report = await shutdown.begin()
    // Capture final (flushFinal) é o retry final: convergiu e limpou o dirty.
    expect(report.stableStateFlush).toBe('COMMITTED')
    expect(report.dirtyRootsRetried).toBe(0)
    expect(report.dirtyRootsRemaining).toBe(0)
    expect(report.degraded).toBe(false)
    expect(report.databaseClosed).toBe(true)
  })

  it('dirty root FAILED que persiste: durabilidade NÃO declarada, relatório sanitizado, término determinístico', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    // O capture final e o retry final FALHAM (boundary quebrada).
    const alwaysFailing: TupiniquimSessionSnapshotStore = {
      putTupiniquimSessionSnapshot: () => Promise.reject(new Error('Falha simulada da boundary durável.')),
      putTupiniquimSessionSnapshotWithThreadModel: () => Promise.reject(new Error('Falha simulada da boundary durável.'))
    }
    const sessions = sessionsOf(persistence)
    const coordinator = new TupiniquimSessionSnapshotCoordinator(sessions, alwaysFailing)
    sessions.appendTurn({ role: 'user', text: 'pergunta', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1' })
    const failedFlush = await coordinator.flush(workspaceA)
    expect(failedFlush.status).toBe('FAILED')

    const reports: AwaitedShutdownReport[] = []
    const exits: AwaitedShutdownReport[] = []
    const shutdown = new AwaitedShutdownCoordinator(productionPlan(coordinator, recording), {
      onReport: (report) => { reports.push(report) },
      onReadyToExit: (report) => { exits.push(report) }
    })
    const report = await shutdown.begin()
    expect(report.phase).toBe('READY_TO_EXIT')
    expect(report.stableStateFlush).toBe('FAILED')
    expect(report.dirtyRootsRetried).toBe(1)
    expect(report.dirtyRootsRemaining).toBe(1)
    expect(report.degraded).toBe(true)
    expect(report.persistenceQuiescent).toBe(true)
    expect(report.databaseClosed).toBe(true)
    // Relatório sanitizado: nenhuma mensagem bruta da boundary.
    expect(JSON.stringify(report)).not.toContain('Falha simulada')
    expect(reports).toHaveLength(1)
    expect(exits).toHaveLength(1)
  })

  it('workspace sem sessão ativa: capture final NO_ACTIVE_WORKSPACE (SKIPPED) e shutdown normal', async () => {
    const recording = createRecordingStore()
    const persistence = new TupiniquimSessionSnapshotCoordinator(new TupiniquimSessionService(), recording.store)
    const plan: AwaitedShutdownPlan = {
      ...productionPlan(persistence, recording),
      flushStableState: () => Promise.resolve({ status: 'NO_ACTIVE_WORKSPACE' })
    }
    const coordinator = new AwaitedShutdownCoordinator(plan)
    const report = await coordinator.begin()
    expect(report.stableStateFlush).toBe('NO_ACTIVE_WORKSPACE')
    expect(report.degraded).toBe(false)
    expect(report.databaseClosed).toBe(true)
  })

  it('state machine RUNNING → SHUTTING_DOWN → READY_TO_EXIT observável', async () => {
    const recording = createRecordingStore()
    const persistence = createProductionCoordinator(recording)
    const coordinator = new AwaitedShutdownCoordinator(productionPlan(persistence, recording))
    expect(coordinator.state()).toBe('RUNNING')
    expect(coordinator.isReadyToExit()).toBe(false)
    const report = await coordinator.begin()
    expect(coordinator.state()).toBe('READY_TO_EXIT')
    expect(coordinator.isReadyToExit()).toBe(true)
    expect(report.phase).toBe('READY_TO_EXIT')
  })
})

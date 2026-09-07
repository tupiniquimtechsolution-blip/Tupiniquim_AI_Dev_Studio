import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { maxDurableTupiniquimTurns, tupiniquimDurableSnapshotSchema, validateTupiniquimSessionSnapshotIntegrity, type AIProviderKind, type AIEvent, type AIThread, type AITurn, type ApprovalDecision, type Execution, type FlightRecorderEvent, type Plan, type PromptTemplate, type TupiniquimDurableSnapshot, type TupiniquimSession, type UIProfile, type VisualAsset } from '@tupiniquim/contracts'

type DatabaseOperation =
  | { type: 'initialize' }
  | { type: 'putPlan'; plan: Plan }
  | { type: 'getPlan'; id: string }
  | { type: 'putExecution'; execution: Execution }
  | { type: 'getExecution'; id: string }
  | { type: 'putApproval'; decision: ApprovalDecision }
  | { type: 'getApproval'; id: string }
  | { type: 'appendEvent'; executionId: string; event: FlightRecorderEvent }
  | { type: 'listEvents'; executionId: string }
  | { type: 'putAIThread'; thread: AIThread }
  | { type: 'getAIThread'; id: string }
  | { type: 'putAITurn'; turn: AITurn }
  | { type: 'listAITurns'; threadId: string }
  | { type: 'appendAIEvent'; event: AIEvent }
  | { type: 'listAIEvents'; threadId: string }
  | { type: 'putPrompt'; template: PromptTemplate }
  | { type: 'getPrompt'; id: string }
  | { type: 'listPrompts' }
  | { type: 'recordPromptUsage'; executionId: string; templateId: string; promptHash: string; usedAt: string }
  | { type: 'putVisualAsset'; asset: VisualAsset }
  | { type: 'getVisualAsset'; id: string }
  | { type: 'listVisualAssets' }
  | { type: 'putPreference'; key: string; profile: UIProfile }
  | { type: 'getPreference'; key: string }
  | { type: 'putTupiniquimSessionSnapshot'; snapshot: TupiniquimDurableSnapshot }
  | { type: 'getTupiniquimSessionSnapshot'; workspaceRoot: string }
  | { type: 'close' }

interface WorkerRequest { id: string; operation: DatabaseOperation }
interface WorkerResponse { id: string; ok: boolean; value?: unknown; error?: string }
interface Pending { resolve: (value: unknown) => void; reject: (cause: Error) => void }

const workerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads')
const { copyFileSync, existsSync, mkdirSync } = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
let db
// Injeção de falha EXCLUSIVAMENTE test-only/interna: quando workerData.failAfter
// é definido (somente pela opção interna de LocalDatabase), a transação de
// snapshot que atingir o N-ésimo statement executado falha antes do COMMIT e o
// ROLLBACK real é exercitado. Nunca exposto via IPC, renderer ou API geral.
let snapshotWriteStatements = 0
const snapshotWriteFaultLimit = typeof workerData.failAfter === 'number' ? workerData.failAfter : 0

const backupBeforeMigration = () => {
  if (!existsSync(workerData.databasePath)) return
  mkdirSync(workerData.backupRoot, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const suffix of ['', '-wal', '-shm']) {
    const source = workerData.databasePath + suffix
    if (existsSync(source)) copyFileSync(source, path.join(workerData.backupRoot, 'studio-' + stamp + '.sqlite' + suffix))
  }
}

const initialize = () => {
  backupBeforeMigration()
  mkdirSync(path.dirname(workerData.databasePath), { recursive: true })
  db = new DatabaseSync(workerData.databasePath)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
  const version = db.prepare('PRAGMA user_version').get().user_version
  if (version < 1) {
    db.exec([
      'BEGIN IMMEDIATE;',
      'CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, plan_id TEXT, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, payload TEXT NOT NULL, decided_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS flight_events (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS flight_events_execution_at ON flight_events(execution_id, at);',
      'CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS prompt_templates (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS knowledge_packs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS visual_assets (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'PRAGMA user_version=1;',
      'COMMIT;'
    ].join('\n'))
  }
  if (version < 2) {
    db.exec([
      'BEGIN IMMEDIATE;',
      'CREATE TABLE IF NOT EXISTS prompt_usages (id INTEGER PRIMARY KEY AUTOINCREMENT, execution_id TEXT NOT NULL, template_id TEXT NOT NULL, prompt_hash TEXT NOT NULL, used_at TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS prompt_usages_execution ON prompt_usages(execution_id, used_at);',
      'PRAGMA user_version=2;',
      'COMMIT;'
    ].join('\n'))
  }
  if (version < 3) {
    db.exec([
      'BEGIN IMMEDIATE;',
      'CREATE TABLE IF NOT EXISTS ai_threads (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS ai_turns (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS ai_turns_thread_created ON ai_turns(thread_id, created_at);',
      'CREATE TABLE IF NOT EXISTS ai_events (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, turn_id TEXT, at TEXT NOT NULL, payload TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS ai_events_thread_at ON ai_events(thread_id, at);',
      'PRAGMA user_version=3;',
      'COMMIT;'
    ].join('\n'))
  }
  if (version < 4) {
    db.exec([
      'BEGIN IMMEDIATE;',
      'CREATE TABLE IF NOT EXISTS ai_threads (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS ai_turns (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS ai_turns_thread_created ON ai_turns(thread_id, created_at);',
      'CREATE TABLE IF NOT EXISTS ai_events (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, turn_id TEXT, at TEXT NOT NULL, payload TEXT NOT NULL);',
      'CREATE INDEX IF NOT EXISTS ai_events_thread_at ON ai_events(thread_id, at);',
      'PRAGMA user_version=4;',
      'COMMIT;'
    ].join('\n'))
  }
  if (version < 5) {
    db.exec([
      'BEGIN IMMEDIATE;',
      'CREATE TABLE IF NOT EXISTS tupiniquim_sessions (id TEXT PRIMARY KEY, workspace_root TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);',
      'CREATE TABLE IF NOT EXISTS tupiniquim_turns (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES tupiniquim_sessions(id) ON DELETE CASCADE, position INTEGER NOT NULL, payload TEXT NOT NULL, CONSTRAINT tupiniquim_turns_session_turn_unique UNIQUE (session_id, id));',
      'CREATE INDEX IF NOT EXISTS tupiniquim_turns_session_position ON tupiniquim_turns(session_id, position);',
      'CREATE TABLE IF NOT EXISTS tupiniquim_bindings (session_id TEXT NOT NULL REFERENCES tupiniquim_sessions(id) ON DELETE CASCADE, provider TEXT NOT NULL, thread_id TEXT NOT NULL, model TEXT, PRIMARY KEY (session_id, provider), CONSTRAINT tupiniquim_bindings_session_thread_unique UNIQUE (session_id, thread_id));',
      'CREATE TABLE IF NOT EXISTS tupiniquim_seen (session_id TEXT NOT NULL, provider TEXT NOT NULL, turn_id TEXT NOT NULL, PRIMARY KEY (session_id, provider, turn_id), FOREIGN KEY (session_id) REFERENCES tupiniquim_sessions(id) ON DELETE CASCADE, FOREIGN KEY (session_id, turn_id) REFERENCES tupiniquim_turns(session_id, id) ON DELETE CASCADE);',
      'PRAGMA user_version=5;',
      'COMMIT;'
    ].join('\n'))
  }
  return { version: 5 }
}

const execute = (operation) => {
  if (operation.type === 'initialize') return initialize()
  if (!db) throw new Error('Banco não inicializado.')
  if (operation.type === 'putPlan') {
    db.prepare('INSERT INTO plans(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(operation.plan.id, JSON.stringify(operation.plan), operation.plan.updatedAt)
    return undefined
  }
  if (operation.type === 'getPlan') {
    const row = db.prepare('SELECT payload FROM plans WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'putExecution') {
    db.prepare('INSERT INTO executions(id,plan_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET plan_id=excluded.plan_id,payload=excluded.payload,updated_at=excluded.updated_at').run(operation.execution.id, operation.execution.planId, JSON.stringify(operation.execution), operation.execution.updatedAt)
    return undefined
  }
  if (operation.type === 'getExecution') {
    const row = db.prepare('SELECT payload FROM executions WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'putApproval') {
    db.prepare('INSERT INTO approvals(id,execution_id,payload,decided_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,decided_at=excluded.decided_at').run(operation.decision.id, operation.decision.executionId, JSON.stringify(operation.decision), operation.decision.decidedAt)
    return undefined
  }
  if (operation.type === 'getApproval') {
    const row = db.prepare('SELECT payload FROM approvals WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'appendEvent') {
    db.prepare('INSERT INTO flight_events(id,execution_id,at,payload) VALUES(?,?,?,?)').run(operation.event.id, operation.executionId, operation.event.at, JSON.stringify(operation.event))
    return undefined
  }
  if (operation.type === 'listEvents') return db.prepare('SELECT payload FROM flight_events WHERE execution_id=? ORDER BY at,id').all(operation.executionId).map((row) => JSON.parse(row.payload))
  if (operation.type === 'putAIThread') {
    db.prepare('INSERT INTO ai_threads(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(operation.thread.id, JSON.stringify(operation.thread), operation.thread.updatedAt)
    return undefined
  }
  if (operation.type === 'getAIThread') {
    const row = db.prepare('SELECT payload FROM ai_threads WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'putAITurn') {
    db.prepare('INSERT INTO ai_turns(id,thread_id,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(operation.turn.id, operation.turn.threadId, JSON.stringify(operation.turn), operation.turn.createdAt)
    return undefined
  }
  if (operation.type === 'listAITurns') return db.prepare('SELECT payload FROM ai_turns WHERE thread_id=? ORDER BY created_at,id').all(operation.threadId).map((row) => JSON.parse(row.payload))
  if (operation.type === 'appendAIEvent') {
    db.prepare('INSERT INTO ai_events(id,thread_id,turn_id,at,payload) VALUES(?,?,?,?,?)').run(operation.event.id, operation.event.threadId, operation.event.turnId ?? null, operation.event.at, JSON.stringify(operation.event))
    return undefined
  }
  if (operation.type === 'listAIEvents') return db.prepare('SELECT payload FROM ai_events WHERE thread_id=? ORDER BY at,id').all(operation.threadId).map((row) => JSON.parse(row.payload))
  if (operation.type === 'putPrompt') {
    db.prepare('INSERT INTO prompt_templates(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(operation.template.id, JSON.stringify(operation.template), operation.template.updatedAt)
    return undefined
  }
  if (operation.type === 'getPrompt') {
    const row = db.prepare('SELECT payload FROM prompt_templates WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'listPrompts') return db.prepare('SELECT payload FROM prompt_templates ORDER BY updated_at DESC').all().map((row) => JSON.parse(row.payload))
  if (operation.type === 'recordPromptUsage') {
    db.prepare('INSERT INTO prompt_usages(execution_id,template_id,prompt_hash,used_at) VALUES(?,?,?,?)').run(operation.executionId, operation.templateId, operation.promptHash, operation.usedAt)
    return undefined
  }
  if (operation.type === 'putVisualAsset') {
    db.prepare('INSERT INTO visual_assets(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(operation.asset.id, JSON.stringify(operation.asset), operation.asset.createdAt)
    return undefined
  }
  if (operation.type === 'getVisualAsset') {
    const row = db.prepare('SELECT payload FROM visual_assets WHERE id=?').get(operation.id)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'listVisualAssets') return db.prepare('SELECT payload FROM visual_assets ORDER BY updated_at DESC').all().map((row) => JSON.parse(row.payload))
  if (operation.type === 'putPreference') {
    db.prepare('INSERT INTO preferences(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run(operation.key, JSON.stringify(operation.profile), operation.profile.updatedAt)
    return undefined
  }
  if (operation.type === 'getPreference') {
    const row = db.prepare('SELECT payload FROM preferences WHERE key=?').get(operation.key)
    return row ? JSON.parse(row.payload) : null
  }
  if (operation.type === 'putTupiniquimSessionSnapshot') {
    // Snapshot único por workspace em UMA transação real (BEGIN IMMEDIATE /
    // COMMIT). DELETE + INSERTs cobrem session + turns + bindings + seen;
    // qualquer erro (incluindo FK de seen cross-workspace) faz ROLLBACK real e
    // nunca deixa snapshot parcial. A substituição S1 -> S2 no mesmo workspace
    // remove as linhas de S1 na mesma transação (sem órfãos).
    const snapshot = operation.snapshot
    db.exec('BEGIN IMMEDIATE')
    try {
      const workspaceRoot = snapshot.session.workspaceRoot
      const run = (sql, ...params) => {
        db.prepare(sql).run(...params)
        snapshotWriteStatements += 1
        // Igualdade exata: o contador é monotônico e só cruza o limite uma vez
        // na vida do worker (one-shot), mantendo as transações seguintes reais.
        if (snapshotWriteFaultLimit > 0 && snapshotWriteStatements === snapshotWriteFaultLimit) {
          throw new Error('Falha injetada (failAfter test-only) após ' + snapshotWriteStatements + ' statements do snapshot transacional.')
        }
      }
      run('DELETE FROM tupiniquim_seen WHERE session_id IN (SELECT id FROM tupiniquim_sessions WHERE workspace_root = ?)', workspaceRoot)
      run('DELETE FROM tupiniquim_bindings WHERE session_id IN (SELECT id FROM tupiniquim_sessions WHERE workspace_root = ?)', workspaceRoot)
      run('DELETE FROM tupiniquim_turns WHERE session_id IN (SELECT id FROM tupiniquim_sessions WHERE workspace_root = ?)', workspaceRoot)
      run('DELETE FROM tupiniquim_sessions WHERE workspace_root = ?', workspaceRoot)
      run('INSERT INTO tupiniquim_sessions(id,workspace_root,created_at,updated_at) VALUES(?,?,?,?)', snapshot.session.id, workspaceRoot, snapshot.session.createdAt, snapshot.session.updatedAt)
      snapshot.turns.forEach((turn, position) => {
        run('INSERT INTO tupiniquim_turns(id,session_id,position,payload) VALUES(?,?,?,?)', turn.id, snapshot.session.id, position, JSON.stringify(turn))
      })
      snapshot.providerBindings.forEach((binding) => {
        run('INSERT INTO tupiniquim_bindings(session_id,provider,thread_id,model) VALUES(?,?,?,?)', snapshot.session.id, binding.provider, binding.threadId, binding.model)
      })
      for (const provider of Object.keys(snapshot.seenByProvider)) {
        for (const turnId of snapshot.seenByProvider[provider]) {
          run('INSERT INTO tupiniquim_seen(session_id,provider,turn_id) VALUES(?,?,?)', snapshot.session.id, provider, turnId)
        }
      }
      db.exec('COMMIT')
      return undefined
    } catch (cause) {
      try { db.exec('ROLLBACK') } catch {}
      throw cause
    }
  }
  if (operation.type === 'getTupiniquimSessionSnapshot') {
    // Leitura do snapshot inteiro numa única transação lógica (BEGIN/COMMIT),
    // devolvendo linhas cruas; consistência relacional e parse ficam no host.
    db.exec('BEGIN')
    try {
      const sessionRow = db.prepare('SELECT id, workspace_root, created_at, updated_at FROM tupiniquim_sessions WHERE workspace_root = ?').get(operation.workspaceRoot)
      if (sessionRow === undefined) {
        db.exec('COMMIT')
        return null
      }
      const turns = db.prepare('SELECT position, payload FROM tupiniquim_turns WHERE session_id = ? ORDER BY position ASC').all(sessionRow.id)
      const bindings = db.prepare('SELECT provider, thread_id, model FROM tupiniquim_bindings WHERE session_id = ? ORDER BY provider ASC').all(sessionRow.id)
      const seen = db.prepare('SELECT provider, turn_id FROM tupiniquim_seen WHERE session_id = ? ORDER BY provider ASC, turn_id ASC').all(sessionRow.id)
      db.exec('COMMIT')
      return {
        session: { id: sessionRow.id, workspaceRoot: sessionRow.workspace_root, createdAt: sessionRow.created_at, updatedAt: sessionRow.updated_at },
        turns,
        bindings: bindings.map((row) => ({ provider: row.provider, threadId: row.thread_id, model: row.model })),
        seen: seen.map((row) => ({ provider: row.provider, turnId: row.turn_id }))
      }
    } catch (cause) {
      try { db.exec('ROLLBACK') } catch {}
      throw cause
    }
  }
  if (operation.type === 'close') { db.close(); db = undefined; return undefined }
  throw new Error('Operação de banco desconhecida.')
}

parentPort.on('message', (request) => {
  try { parentPort.postMessage({ id: request.id, ok: true, value: execute(request.operation) }) }
  catch (cause) {
    try { if (db) db.exec('ROLLBACK') } catch {}
    parentPort.postMessage({ id: request.id, ok: false, error: cause instanceof Error ? cause.message : 'Falha no worker SQLite.' })
  }
})
`

export class LocalDatabase {
  private readonly worker: Worker
  private readonly pending = new Map<string, Pending>()
  private readonly ready: Promise<void>

  /**
   * @param options Opção interna EXCLUSIVAMENTE test-only: `failAfter` injeta
   * falha na transação real de snapshot no worker SQLite após N statements
   * executados (uma única vez), provando ROLLBACK/atomicidade no caminho real.
   * Não é exposta via IPC, renderer ou API geral; produção nunca a utiliza.
   */
  public constructor(dataRoot: string, options: { failAfter?: { snapshotWriteStatements?: number } } = {}) {
    const databaseRoot = path.join(dataRoot, 'database')
    const backupRoot = path.join(dataRoot, 'backups', 'database')
    this.worker = new Worker(workerSource, { eval: true, workerData: { databasePath: path.join(databaseRoot, 'studio.sqlite'), backupRoot, failAfter: options.failAfter?.snapshotWriteStatements ?? 0 } })
    this.worker.on('message', (message: WorkerResponse) => this.handleMessage(message))
    this.worker.on('error', (cause) => this.rejectAll(cause instanceof Error ? cause : new Error(String(cause))))
    this.worker.on('exit', (code) => { if (code !== 0) this.rejectAll(new Error(`Worker SQLite encerrou com código ${code}.`)) })
    this.ready = mkdir(databaseRoot, { recursive: true }).then(async () => { await this.requestRaw({ type: 'initialize' }) })
  }

  public async putPlan(plan: Plan): Promise<void> { await this.ready; await this.requestRaw({ type: 'putPlan', plan }) }
  public async getPlan(id: string): Promise<Plan | null> { await this.ready; return await this.requestRaw({ type: 'getPlan', id }) as Plan | null }
  public async putExecution(execution: Execution): Promise<void> { await this.ready; await this.requestRaw({ type: 'putExecution', execution }) }
  public async getExecution(id: string): Promise<Execution | null> { await this.ready; return await this.requestRaw({ type: 'getExecution', id }) as Execution | null }
  public async putApproval(decision: ApprovalDecision): Promise<void> { await this.ready; await this.requestRaw({ type: 'putApproval', decision }) }
  public async getApproval(id: string): Promise<ApprovalDecision | null> { await this.ready; return await this.requestRaw({ type: 'getApproval', id }) as ApprovalDecision | null }
  public async appendEvent(executionId: string, event: FlightRecorderEvent): Promise<void> { await this.ready; await this.requestRaw({ type: 'appendEvent', executionId, event }) }
  public async listEvents(executionId: string): Promise<FlightRecorderEvent[]> { await this.ready; return await this.requestRaw({ type: 'listEvents', executionId }) as FlightRecorderEvent[] }
  public async putAIThread(thread: AIThread): Promise<void> { await this.ready; await this.requestRaw({ type: 'putAIThread', thread }) }
  public async getAIThread(id: string): Promise<AIThread | null> { await this.ready; return await this.requestRaw({ type: 'getAIThread', id }) as AIThread | null }
  public async putAITurn(turn: AITurn): Promise<void> { await this.ready; await this.requestRaw({ type: 'putAITurn', turn }) }
  public async listAITurns(threadId: string): Promise<AITurn[]> { await this.ready; return await this.requestRaw({ type: 'listAITurns', threadId }) as AITurn[] }
  public async appendAIEvent(event: AIEvent): Promise<void> { await this.ready; await this.requestRaw({ type: 'appendAIEvent', event }) }
  public async listAIEvents(threadId: string): Promise<AIEvent[]> { await this.ready; return await this.requestRaw({ type: 'listAIEvents', threadId }) as AIEvent[] }
  public async putPrompt(template: PromptTemplate): Promise<void> { await this.ready; await this.requestRaw({ type: 'putPrompt', template }) }
  public async getPrompt(id: string): Promise<PromptTemplate | null> { await this.ready; return await this.requestRaw({ type: 'getPrompt', id }) as PromptTemplate | null }
  public async listPrompts(): Promise<PromptTemplate[]> { await this.ready; return await this.requestRaw({ type: 'listPrompts' }) as PromptTemplate[] }
  public async recordPromptUsage(executionId: string, templateId: string, promptHash: string): Promise<void> { await this.ready; await this.requestRaw({ type: 'recordPromptUsage', executionId, templateId, promptHash, usedAt: new Date().toISOString() }) }
  public async putVisualAsset(asset: VisualAsset): Promise<void> { await this.ready; await this.requestRaw({ type: 'putVisualAsset', asset }) }
  public async getVisualAsset(id: string): Promise<VisualAsset | null> { await this.ready; return await this.requestRaw({ type: 'getVisualAsset', id }) as VisualAsset | null }
  public async listVisualAssets(): Promise<VisualAsset[]> { await this.ready; return await this.requestRaw({ type: 'listVisualAssets' }) as VisualAsset[] }
  public async putPreference(key: string, profile: UIProfile): Promise<void> { await this.ready; await this.requestRaw({ type: 'putPreference', key, profile }) }
  public async getPreference(key: string): Promise<UIProfile | null> { await this.ready; return await this.requestRaw({ type: 'getPreference', key }) as UIProfile | null }

  /**
   * Persiste o snapshot durável da sessão Tupiniquim do workspace em uma única
   * transação atômica do worker SQLite (BEGIN IMMEDIATE/COMMIT, ROLLBACK em
   * erro). Antes da transação aplica a retenção canônica: últimos 200 turns
   * públicos, podando `seenByProvider` para ids ainda retidos no mesmo commit.
   */
  public async putTupiniquimSessionSnapshot(snapshot: TupiniquimDurableSnapshot): Promise<void> {
    await this.ready
    // seen só pode referenciar turns presentes no snapshot recebido; referência
    // a turn de outro workspace/sessão é erro de produtor (fail-loud antes de
    // qualquer transação). A constraint FK do SQLite permanece como backstop.
    assertSeenIdsWithinSnapshot(snapshot)
    const durable = applyDurableSnapshotRetention(snapshot)
    await this.requestRaw({ type: 'putTupiniquimSessionSnapshot', snapshot: durable })
  }

  /**
   * Lê e monta o snapshot durável do workspace numa única operação lógica,
   * validando a consistência relacional antes de devolver (fail-closed):
   * snapshot inexistente ou inconsistente retorna null — nunca estado parcial.
   */
  public async getTupiniquimSessionSnapshot(workspaceRoot: string): Promise<TupiniquimDurableSnapshot | null> {
    await this.ready
    const stored = await this.requestRaw({ type: 'getTupiniquimSessionSnapshot', workspaceRoot }) as StoredTupiniquimSessionSnapshot | null
    if (stored === null) return null
    return assembleTupiniquimSessionSnapshot(stored, workspaceRoot)
  }

  public async close(): Promise<void> {
    await this.ready
    await this.requestRaw({ type: 'close' })
    await this.worker.terminate()
  }

  private requestRaw(operation: DatabaseOperation): Promise<unknown> {
    const id = randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, operation } satisfies WorkerRequest)
    })
  }

  private handleMessage(message: WorkerResponse): void {
    const pending = this.pending.get(message.id)
    if (pending === undefined) return
    this.pending.delete(message.id)
    if (message.ok) pending.resolve(message.value)
    else pending.reject(new Error(message.error ?? 'Falha desconhecida no worker SQLite.'))
  }

  private rejectAll(cause: Error): void {
    for (const pending of this.pending.values()) pending.reject(cause)
    this.pending.clear()
  }
}

interface StoredTupiniquimSessionSnapshot {
  session: TupiniquimSession
  turns: Array<{ position: number; payload: string }>
  bindings: Array<{ provider: AIProviderKind; threadId: string; model: string | null }>
  seen: Array<{ provider: AIProviderKind; turnId: string }>
}

/**
 * Validação relacional pré-transação: cada id em `seenByProvider` precisa
 * referenciar um turn presente no snapshot recebido. Seen apontando para turn
 * de outro workspace/sessão (cross-workspace) nunca pode ser aceito nem
 * silenciosamente descartado — é erro de produtor, fail-loud.
 */
const assertSeenIdsWithinSnapshot = (snapshot: TupiniquimDurableSnapshot): void => {
  const turnIds = new Set<string>(snapshot.turns.map((turn) => turn.id))
  for (const [provider, turnIdsSeen] of Object.entries(snapshot.seenByProvider)) {
    for (const turnId of turnIdsSeen) {
      if (!turnIds.has(turnId)) {
        throw new Error(`seen do provider ${provider} referencia turn fora do snapshot: ${turnId}.`)
      }
    }
  }
}

/**
 * Retenção durável canônica aplicada antes do commit: últimos 200 turns
 * públicos por workspace (ordem original preservada, ids originais mantidos)
 * e seen podado no mesmo snapshot para ids ainda retidos. Parse do contrato
 * durável é ruidoso: snapshot fora do contrato rejeita o put sem escrita.
 */
const applyDurableSnapshotRetention = (snapshot: TupiniquimDurableSnapshot): TupiniquimDurableSnapshot => {
  const turns = snapshot.turns.slice(-maxDurableTupiniquimTurns)
  const retainedIds = new Set<string>(turns.map((turn) => turn.id))
  const seenByProvider: Record<string, string[]> = {}
  for (const [provider, turnIds] of Object.entries(snapshot.seenByProvider)) {
    const kept = turnIds.filter((turnId) => retainedIds.has(turnId))
    if (kept.length > 0) seenByProvider[provider] = kept
  }
  return tupiniquimDurableSnapshotSchema.parse({ ...snapshot, turns, seenByProvider })
}

/**
 * Montagem fail-closed do snapshot lido do SQLite: posições exatas 0..n-1
 * (ordem consistente), payloads JSON íntegros, schema durável válido e
 * consistência relacional (workspaceRoot, sessionId dos turns, ids únicos,
 * providers únicos nos bindings, seen somente de turns retidos, referências
 * órfãs ausentes). Qualquer desvio descarta o snapshot para esta leitura.
 */
const assembleTupiniquimSessionSnapshot = (
  stored: StoredTupiniquimSessionSnapshot,
  expectedWorkspaceRoot: string
): TupiniquimDurableSnapshot | null => {
  try {
    const turns: unknown[] = []
    for (let index = 0; index < stored.turns.length; index += 1) {
      const row = stored.turns[index]
      if (row === undefined || row.position !== index) return null
      turns.push(JSON.parse(row.payload) as unknown)
    }
    const seenByProvider: Record<string, string[]> = {}
    for (const row of stored.seen) {
      const current = seenByProvider[row.provider]
      if (current === undefined) seenByProvider[row.provider] = [row.turnId]
      else current.push(row.turnId)
    }
    const parsed = tupiniquimDurableSnapshotSchema.safeParse({
      session: stored.session,
      turns,
      providerBindings: stored.bindings,
      seenByProvider
    })
    if (!parsed.success) return null
    if (validateTupiniquimSessionSnapshotIntegrity(parsed.data, expectedWorkspaceRoot).length > 0) return null
    return parsed.data
  } catch {
    return null
  }
}

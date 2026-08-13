import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { ApprovalDecision, Execution, FlightRecorderEvent, Plan, PromptTemplate, UIProfile, VisualAsset } from '@tupiniquim/contracts'

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
  | { type: 'putPrompt'; template: PromptTemplate }
  | { type: 'getPrompt'; id: string }
  | { type: 'listPrompts' }
  | { type: 'recordPromptUsage'; executionId: string; templateId: string; promptHash: string; usedAt: string }
  | { type: 'putVisualAsset'; asset: VisualAsset }
  | { type: 'getVisualAsset'; id: string }
  | { type: 'listVisualAssets' }
  | { type: 'putPreference'; key: string; profile: UIProfile }
  | { type: 'getPreference'; key: string }
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
  return { version: 2 }
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

  public constructor(dataRoot: string) {
    const databaseRoot = path.join(dataRoot, 'database')
    const backupRoot = path.join(dataRoot, 'backups', 'database')
    this.worker = new Worker(workerSource, { eval: true, workerData: { databasePath: path.join(databaseRoot, 'studio.sqlite'), backupRoot } })
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
  public async putPrompt(template: PromptTemplate): Promise<void> { await this.ready; await this.requestRaw({ type: 'putPrompt', template }) }
  public async getPrompt(id: string): Promise<PromptTemplate | null> { await this.ready; return await this.requestRaw({ type: 'getPrompt', id }) as PromptTemplate | null }
  public async listPrompts(): Promise<PromptTemplate[]> { await this.ready; return await this.requestRaw({ type: 'listPrompts' }) as PromptTemplate[] }
  public async recordPromptUsage(executionId: string, templateId: string, promptHash: string): Promise<void> { await this.ready; await this.requestRaw({ type: 'recordPromptUsage', executionId, templateId, promptHash, usedAt: new Date().toISOString() }) }
  public async putVisualAsset(asset: VisualAsset): Promise<void> { await this.ready; await this.requestRaw({ type: 'putVisualAsset', asset }) }
  public async getVisualAsset(id: string): Promise<VisualAsset | null> { await this.ready; return await this.requestRaw({ type: 'getVisualAsset', id }) as VisualAsset | null }
  public async listVisualAssets(): Promise<VisualAsset[]> { await this.ready; return await this.requestRaw({ type: 'listVisualAssets' }) as VisualAsset[] }
  public async putPreference(key: string, profile: UIProfile): Promise<void> { await this.ready; await this.requestRaw({ type: 'putPreference', key, profile }) }
  public async getPreference(key: string): Promise<UIProfile | null> { await this.ready; return await this.requestRaw({ type: 'getPreference', key }) as UIProfile | null }

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

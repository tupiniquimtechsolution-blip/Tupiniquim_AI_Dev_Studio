import { WEB_PROVIDER, resolveWebModel } from './model-catalog'
import { getRemoteSandbox, remoteRuntimeStatus, type RemoteRuntimeConfig } from './remote-runtime'
import {
  WORKSPACE_BACKUP_STATE_KEY,
  WORKSPACE_BACKUP_TTL_SECONDS,
  WORKSPACE_RESTORE_MARKER,
  workspaceBackupName,
  workspaceBackupReadiness
} from './workspace-backup'
import legacyWorker from './worker'

export class Sandbox {
  fetch(): Response {
    return Response.json({ ok: false, error: { code: 'SANDBOX_RETIRED', message: 'Cloudflare Sandbox foi substituído pelo Tupiniquim Remote Runtime.', retryable: false } }, { status: 410 })
  }
}
export { WebState } from './web-state'
type WorkersAi = { run(model: string, input: Record<string, unknown>): Promise<unknown> }
type AssetBinding = { fetch(request: Request): Promise<Response> }
type DurableObjectStub = { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
type DurableObjectNamespace = { idFromName(name: string): unknown; get(id: unknown): DurableObjectStub }

type Env = RemoteRuntimeConfig & {
  AI: WorkersAi
  ASSETS: AssetBinding
  STATE: DurableObjectNamespace
  WEB_ALLOW_ANONYMOUS?: string
  WEB_BOOTSTRAP_REPO?: string
  WEB_BOOTSTRAP_REF?: string
  GOOGLE_TASKS_CLIENT_ID?: string
  GOOGLE_TASKS_CLIENT_SECRET?: string
  WEB_WORKSPACE_BACKUP_ENABLED?: string
}

type JsonRecord = Record<string, unknown>
type RpcRequest = { action?: string; input?: unknown }
type StoredToken = { accessToken: string; refreshToken?: string; expiresAt: string; scope: string[] }

const ok = <T>(value: T, extra?: JsonRecord): Response => Response.json({ ok: true, value, ...(extra ?? {}) })
const fail = (code: string, message: string, status = 400, retryable = false): Response => Response.json({ ok: false, error: { code, message, retryable } }, { status })
const safeId = (value: string | null): string | null => value !== null && /^[a-zA-Z0-9_-]{8,96}$/.test(value.trim()) ? value.trim() : null
const workspaceIdFrom = (request: Request, url = new URL(request.url)): string | null => safeId(request.headers.get('x-tupiniquim-workspace')) ?? safeId(url.searchParams.get('workspace'))
const modelFrom = (request: Request): string => resolveWebModel(request.headers.get('x-tupiniquim-model'))
const safePath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized === '' || normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) return null
  return normalized
}
const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
const aiText = (response: unknown): string => {
  if (typeof response === 'string') return response
  if (response !== null && typeof response === 'object') {
    const record = response as JsonRecord
    if (typeof record.response === 'string') return record.response
    if (typeof record.result === 'string') return record.result
    if (record.result !== null && typeof record.result === 'object' && typeof (record.result as JsonRecord).response === 'string') return (record.result as JsonRecord).response as string
  }
  return JSON.stringify(response)
}

const stateStub = (env: Env, workspaceId: string): DurableObjectStub => env.STATE.get(env.STATE.idFromName(`workspace:${workspaceId}`))
const stateGet = async <T>(env: Env, workspaceId: string, key: string): Promise<T | null> => {
  const response = await stateStub(env, workspaceId).fetch(`https://state.local/value?key=${encodeURIComponent(key)}`)
  const body = await response.json() as { ok?: boolean; found?: boolean; value?: T }
  return body.ok === true && body.found === true ? body.value ?? null : null
}
const statePut = async (env: Env, workspaceId: string, key: string, value: unknown): Promise<void> => {
  await stateStub(env, workspaceId).fetch(`https://state.local/value?key=${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value }) })
}
const stateDelete = async (env: Env, workspaceId: string, key: string): Promise<void> => {
  await stateStub(env, workspaceId).fetch(`https://state.local/value?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
}

const sandboxFor = (env: Env, workspaceId: string) => getRemoteSandbox(env, workspaceId)
const ensureWorkspace = async (env: Env, workspaceId: string): Promise<ReturnType<typeof sandboxFor>> => {
  const sandbox = sandboxFor(env, workspaceId)
  const exists = await sandbox.exists('/workspace')
  if (!exists.exists) await sandbox.mkdir('/workspace', { recursive: true })
  return sandbox
}

type WorkspaceBackupHandle = Awaited<ReturnType<ReturnType<typeof sandboxFor>['createBackup']>>

const workspacePersistenceStatus = (env: Env): JsonRecord => {
  const readiness = workspaceBackupReadiness(env)
  return readiness.state === 'READY'
    ? { state: 'READY', configured: true }
    : { state: readiness.state, configured: false, missing: readiness.missing }
}

const restoreWorkspaceCheckpoint = async (env: Env, workspaceId: string, sandbox: ReturnType<typeof sandboxFor>): Promise<JsonRecord> => {
  const readiness = workspaceBackupReadiness(env)
  if (readiness.state === 'DISABLED') return { state: 'DISABLED', configured: false }

  const marker = await sandbox.exists(WORKSPACE_RESTORE_MARKER)
  if (marker.exists) return { state: 'ALREADY_INITIALIZED', configured: true }

  const backup = await stateGet<WorkspaceBackupHandle>(env, workspaceId, WORKSPACE_BACKUP_STATE_KEY)
  if (backup === null) return { state: 'EMPTY', configured: true }

  await sandbox.restoreBackup(backup)
  await sandbox.writeFile(WORKSPACE_RESTORE_MARKER, new Date().toISOString())
  return { state: 'RESTORED', configured: true, backupId: String((backup as unknown as JsonRecord).id ?? '') }
}

const createWorkspaceCheckpoint = async (env: Env, workspaceId: string, sandbox: ReturnType<typeof sandboxFor>): Promise<JsonRecord> => {
  const readiness = workspaceBackupReadiness(env)
  if (readiness.state === 'DISABLED') return { state: 'DISABLED', configured: false }

  const backup = await sandbox.createBackup({
    dir: '/workspace',
    name: workspaceBackupName(workspaceId),
    ttl: WORKSPACE_BACKUP_TTL_SECONDS,
    gitignore: true
  })
  await statePut(env, workspaceId, WORKSPACE_BACKUP_STATE_KEY, backup)
  await sandbox.writeFile(WORKSPACE_RESTORE_MARKER, new Date().toISOString())
  return { state: 'SNAPSHOT', configured: true, backupId: String((backup as unknown as JsonRecord).id ?? '') }
}

const defaultProfile = () => ({
  id: crypto.randomUUID(), name: 'Tupiniquim Web', density: 'COMFORTABLE',
  theme: { background: '#07090f', surface: '#0d1018', raised: '#111622', text: '#f7f7fb', muted: '#9da6b7', accent: '#8fa8ff', info: '#76b7ff', warning: '#e3b879', danger: '#ef7f7f' },
  layout: { explorerWidth: 280, agentWidth: 390, deckHeight: 260 }, updatedAt: new Date().toISOString()
})

const appendExecutionEvent = async (env: Env, workspaceId: string, executionId: string, event: JsonRecord): Promise<void> => {
  const events = await stateGet<JsonRecord[]>(env, workspaceId, `execution-events:${executionId}`) ?? []
  events.push(event)
  await statePut(env, workspaceId, `execution-events:${executionId}`, events)
}

const persistAgentTurn = async (env: Env, workspaceId: string, input: JsonRecord, envelope: JsonRecord): Promise<void> => {
  const value = envelope.value as JsonRecord | undefined
  if (value === undefined || typeof value.threadId !== 'string' || typeof value.turnId !== 'string') return
  const threadId = value.threadId
  const turnId = value.turnId
  const model = typeof value.model === 'string' ? value.model : null
  const events = Array.isArray(envelope.events) ? envelope.events as JsonRecord[] : []
  const assistantText = events.filter((event) => event.kind === 'MESSAGE_DELTA' && typeof event.text === 'string').map((event) => event.text as string).join('')
  const now = new Date().toISOString()
  let session = await stateGet<JsonRecord>(env, workspaceId, 'agent-session')
  if (session === null) {
    session = { session: { id: crypto.randomUUID(), workspaceRoot: '/workspace', createdAt: now, updatedAt: now }, turns: [], providerThreads: [], proposalAuthority: null }
  }
  const sessionMeta = session.session as JsonRecord
  sessionMeta.updatedAt = now
  const turns = Array.isArray(session.turns) ? session.turns as JsonRecord[] : []
  const sessionId = String(sessionMeta.id)
  turns.push({ id: crypto.randomUUID(), sessionId, role: 'user', text: typeof input.message === 'string' ? input.message : '', provider: WEB_PROVIDER, model, threadId, turnId, createdAt: now })
  if (assistantText !== '') turns.push({ id: crypto.randomUUID(), sessionId, role: 'assistant', text: assistantText, provider: WEB_PROVIDER, model, threadId, turnId, createdAt: new Date().toISOString() })
  session.turns = turns.slice(-400)
  const bindings = Array.isArray(session.providerThreads) ? session.providerThreads as JsonRecord[] : []
  session.providerThreads = [...bindings.filter((item) => item.provider !== WEB_PROVIDER), { provider: WEB_PROVIDER, threadId, model }]
  await statePut(env, workspaceId, 'agent-session', session)
  const priorHistory = await stateGet<JsonRecord>(env, workspaceId, `agent-history:${threadId}`)
  const history = priorHistory ?? { thread: { id: threadId, provider: WEB_PROVIDER, workspaceRoot: '/workspace', model, createdAt: now, updatedAt: now }, turns: [], events: [] }
  ;(history.thread as JsonRecord).updatedAt = now
  const historyTurns = Array.isArray(history.turns) ? history.turns as JsonRecord[] : []
  historyTurns.push({ id: crypto.randomUUID(), threadId, mode: typeof input.mode === 'string' ? input.mode : 'CHAT', inputHash: await sha256(typeof input.message === 'string' ? input.message : ''), createdAt: now })
  history.turns = historyTurns.slice(-200)
  history.events = [...(Array.isArray(history.events) ? history.events as JsonRecord[] : []), ...events].slice(-1000)
  await statePut(env, workspaceId, `agent-history:${threadId}`, history)
}

const extractJson = (text: string): JsonRecord | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  if (!candidate.includes('{')) return null
  try { return JSON.parse(candidate) as JsonRecord } catch { return null }
}

const createProposal = async (request: Request, env: Env, workspaceId: string, input: JsonRecord, turn: JsonRecord): Promise<JsonRecord | null> => {
  const context = input.proposalContext
  if (context === null || typeof context !== 'object') return null
  const proposalContext = context as JsonRecord
  if (typeof proposalContext.executionId !== 'string' || typeof proposalContext.stepId !== 'string') return null
  const objective = typeof input.message === 'string' ? input.message : 'Atualizar o projeto conforme o plano.'
  const inference = await env.AI.run(modelFrom(request), { messages: [
    { role: 'system', content: 'Gere UMA alteração segura de arquivo para um workspace de software. Responda SOMENTE JSON no formato {"relativePath":"...","content":"..."}. Não use caminhos absolutos, .., secrets nem arquivos de credenciais. Prefira documentação ou código diretamente relacionado ao objetivo.' },
    { role: 'user', content: objective }
  ] })
  const parsed = extractJson(aiText(inference))
  const relativePath = safePath(parsed?.relativePath) ?? 'TUPINIQUIM_WEB_CHANGE.md'
  const content = typeof parsed?.content === 'string' && parsed.content.length <= 10_000_000 ? parsed.content : `# Mudança proposta\n\n${objective}\n`
  const sandbox = await ensureWorkspace(env, workspaceId)
  const target = `/workspace/${relativePath}`
  const exists = await sandbox.exists(target)
  let expectedTargetHash: string | null = null
  if (exists.exists) {
    const current = await sandbox.readFile(target, { encoding: 'utf-8' })
    expectedTargetHash = await sha256(typeof current.content === 'string' ? current.content : '')
  }
  const proposalId = crypto.randomUUID()
  const toolCallId = crypto.randomUUID()
  const effectId = crypto.randomUUID()
  const effect = {
    id: effectId, capability: 'workspace.write', operation: exists.exists ? 'REPLACE' : 'CREATE', target: relativePath,
    payloadHash: await sha256(content), risk: 'LOW', expectedTargetHash,
    source: { kind: 'AGENT_PROPOSAL', provider: WEB_PROVIDER, threadId: String(turn.threadId), turnId: String(turn.turnId), toolCallId, proposalId, tool: 'workspace.write' }
  }
  const proposal = { id: proposalId, executionId: proposalContext.executionId, stepId: proposalContext.stepId, provider: WEB_PROVIDER, threadId: String(turn.threadId), turnId: String(turn.turnId), toolCallId, tool: 'workspace.write', effect, createdAt: new Date().toISOString() }
  await statePut(env, workspaceId, `proposal:${proposalId}`, { proposal, content, status: 'PENDING_REVIEW' })
  const planned = await stateGet<JsonRecord>(env, workspaceId, `plan:${proposalContext.executionId}`)
  if (planned !== null && planned.plan !== null && typeof planned.plan === 'object') {
    const plan = planned.plan as JsonRecord
    const steps = Array.isArray(plan.steps) ? plan.steps as JsonRecord[] : []
    plan.steps = steps.map((step) => step.id === proposalContext.stepId ? { ...step, effects: [effect] } : step)
    plan.updatedAt = new Date().toISOString()
    const execution = planned.execution as JsonRecord
    execution.state = 'WAITING_APPROVAL'; execution.threadId = String(turn.threadId); execution.updatedAt = new Date().toISOString()
    await statePut(env, workspaceId, `plan:${proposalContext.executionId}`, planned)
    await appendExecutionEvent(env, workspaceId, proposalContext.executionId, { id: crypto.randomUUID(), at: new Date().toISOString(), state: 'WAITING_APPROVAL', category: 'APPROVAL', title: 'Proposta de workspace aguardando aprovação.', detail: relativePath, severity: 'INFO' })
  }
  return proposal
}

const handleAgentSend = async (request: Request, env: Env, workspaceId: string, input: JsonRecord): Promise<Response> => {
  const response = await legacyWorker.fetch(request.clone(), env)
  const envelope = await response.clone().json() as JsonRecord
  if (envelope.ok !== true) return response
  await persistAgentTurn(env, workspaceId, input, envelope)
  const value = envelope.value as JsonRecord
  const proposal = await createProposal(request, env, workspaceId, input, value)
  return Response.json({ ...envelope, proposals: proposal === null ? [] : [proposal] }, { status: response.status })
}

const googleConfigured = (env: Env): boolean => Boolean(env.GOOGLE_TASKS_CLIENT_ID && env.GOOGLE_TASKS_CLIENT_SECRET)
const googleStatus = async (env: Env, workspaceId: string): Promise<JsonRecord> => ({ state: !googleConfigured(env) ? 'NOT_CONFIGURED' : (await stateGet<StoredToken>(env, workspaceId, 'google-tasks-token')) === null ? 'AUTH_REQUIRED' : 'READY', configured: googleConfigured(env), authenticated: googleConfigured(env) && (await stateGet<StoredToken>(env, workspaceId, 'google-tasks-token')) !== null, secureStorageAvailable: true, scope: 'https://www.googleapis.com/auth/tasks' })
const refreshGoogleToken = async (env: Env, workspaceId: string, token: StoredToken): Promise<StoredToken> => {
  if (new Date(token.expiresAt).getTime() > Date.now() + 60_000) return token
  if (!token.refreshToken || !env.GOOGLE_TASKS_CLIENT_ID || !env.GOOGLE_TASKS_CLIENT_SECRET) throw new Error('Google Tasks requer nova autenticação.')
  const body = new URLSearchParams({ client_id: env.GOOGLE_TASKS_CLIENT_ID, client_secret: env.GOOGLE_TASKS_CLIENT_SECRET, refresh_token: token.refreshToken, grant_type: 'refresh_token' })
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error('Falha ao renovar autenticação do Google Tasks.')
  const json = await response.json() as JsonRecord
  const next: StoredToken = { accessToken: String(json.access_token), refreshToken: token.refreshToken, expiresAt: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000).toISOString(), scope: token.scope }
  await statePut(env, workspaceId, 'google-tasks-token', next)
  return next
}
const googleFetch = async (env: Env, workspaceId: string, path: string, init: RequestInit = {}): Promise<Response> => {
  const stored = await stateGet<StoredToken>(env, workspaceId, 'google-tasks-token')
  if (stored === null) throw new Error('Conecte o Google Tasks primeiro.')
  const token = await refreshGoogleToken(env, workspaceId, stored)
  const headers = new Headers(init.headers); headers.set('authorization', `Bearer ${token.accessToken}`); if (init.body !== undefined) headers.set('content-type', 'application/json')
  return fetch(`https://tasks.googleapis.com/tasks/v1${path}`, { ...init, headers })
}

const handleStateRpc = async (request: Request, env: Env, workspaceId: string, action: string, input: JsonRecord): Promise<Response | null> => {
  const now = new Date().toISOString()
  switch (action) {
    case 'full.workspace.bootstrap': {
      const runtime = await remoteRuntimeStatus(env)
      if (runtime.state !== 'READY') {
        return ok('/workspace', { runtime, persistence: { state: 'REMOTE_RUNTIME_OFFLINE', configured: false } })
      }
      const sandbox = await ensureWorkspace(env, workspaceId)
      const persistence = await restoreWorkspaceCheckpoint(env, workspaceId, sandbox)
      if (persistence.state === 'MISCONFIGURED') {
        return fail('WORKSPACE_PERSISTENCE_MISCONFIGURED', `Persistência Web incompleta: ${String((persistence.missing as string[] | undefined)?.join(', ') ?? '')}`, 503, false)
      }
      const git = await sandbox.exists('/workspace/.git')
      if (!git.exists && env.WEB_BOOTSTRAP_REPO) {
        const ref = env.WEB_BOOTSTRAP_REF?.trim() || 'main'
        try {
          await sandbox.bootstrapRepo(env.WEB_BOOTSTRAP_REPO, ref)
        } catch (cause) {
          return fail('WORKSPACE_BOOTSTRAP_FAILED', cause instanceof Error ? cause.message : 'Falha ao preparar repositório Web.', 500, true)
        }
      }
      await sandbox.writeFile(WORKSPACE_RESTORE_MARKER, new Date().toISOString())
      return ok('/workspace', { persistence })
    }
    case 'full.workspace.persistence-status': return ok(workspacePersistenceStatus(env))
    case 'full.workspace.checkpoint': {
      const sandbox = await ensureWorkspace(env, workspaceId)
      try {
        return ok(await createWorkspaceCheckpoint(env, workspaceId, sandbox))
      } catch (cause) {
        return fail('WORKSPACE_BACKUP_FAILED', cause instanceof Error ? cause.message : 'Falha ao persistir workspace Web.', 503, true)
      }
    }
    case 'workspace.write': {
      const response = await legacyWorker.fetch(request.clone(), env)
      const envelope = await response.clone().json() as JsonRecord
      if (envelope.ok !== true) return response
      try {
        const sandbox = await ensureWorkspace(env, workspaceId)
        const persistence = await createWorkspaceCheckpoint(env, workspaceId, sandbox)
        return Response.json({ ...envelope, persistence }, { status: response.status })
      } catch (cause) {
        return fail('WORKSPACE_BACKUP_FAILED', cause instanceof Error ? cause.message : 'Arquivo escrito, mas o checkpoint R2 falhou.', 503, true)
      }
    }
    case 'agent.send': return handleAgentSend(request, env, workspaceId, input)
    case 'full.agent.session': return ok(await stateGet<JsonRecord>(env, workspaceId, 'agent-session'))
    case 'full.agent.history': return ok(await stateGet<JsonRecord>(env, workspaceId, `agent-history:${String(input.threadId ?? '')}`) ?? { thread: null, turns: [], events: [] })
    case 'full.agent.proposal-status': {
      const stored = await stateGet<JsonRecord>(env, workspaceId, `proposal:${String(input.proposalId ?? '')}`)
      return ok(stored?.status ?? 'EXPIRED')
    }
    case 'full.planning.create': {
      const objective = typeof input.objective === 'string' ? input.objective.trim() : ''
      if (objective.length < 3) return fail('INVALID_OBJECTIVE', 'Objetivo do plano inválido.')
      const stepId = crypto.randomUUID(); const planId = crypto.randomUUID(); const executionId = crypto.randomUUID()
      const value = { plan: { id: planId, title: objective.slice(0, 100), objective, steps: [{ id: stepId, title: 'Implementar objetivo', description: objective, status: 'PENDING', risk: 'LOW', requiresApproval: true, effects: [] }], createdAt: now, updatedAt: now }, execution: { id: executionId, planId, mode: typeof input.mode === 'string' ? input.mode : 'PLAN', state: 'PLAN', permissionProfile: 'ASSISTED', workspaceRoot: '/workspace', activeStepId: stepId, threadId: null, approvalIds: [], completedEffectIds: [], createdAt: now, updatedAt: now } }
      await statePut(env, workspaceId, `plan:${executionId}`, value)
      await statePut(env, workspaceId, `execution-events:${executionId}`, [{ id: crypto.randomUUID(), at: now, state: 'PLAN', category: 'STATE', title: 'Plano persistido no runtime Web.', severity: 'INFO' }])
      return ok(value)
    }
    case 'full.planning.read': {
      const value = await stateGet<JsonRecord>(env, workspaceId, `plan:${String(input.executionId ?? '')}`)
      return value === null ? fail('PLAN_NOT_FOUND', 'Plano não encontrado.', 404) : ok(value)
    }
    case 'full.planning.update': {
      const key = `plan:${String(input.executionId ?? '')}`; const current = await stateGet<JsonRecord>(env, workspaceId, key)
      if (current === null || input.plan === null || typeof input.plan !== 'object') return fail('PLAN_NOT_FOUND', 'Plano não encontrado.', 404)
      current.plan = { ...(input.plan as JsonRecord), updatedAt: now }; await statePut(env, workspaceId, key, current); return ok(current.plan)
    }
    case 'full.planning.decide': {
      const executionId = String(input.executionId ?? ''); const stepId = String(input.stepId ?? ''); const current = await stateGet<JsonRecord>(env, workspaceId, `plan:${executionId}`)
      if (current === null) return fail('PLAN_NOT_FOUND', 'Plano não encontrado.', 404)
      const plan = current.plan as JsonRecord; const steps = Array.isArray(plan.steps) ? plan.steps as JsonRecord[] : []; const step = steps.find((item) => item.id === stepId)
      if (step === undefined) return fail('STEP_NOT_FOUND', 'Passo não encontrado.', 404)
      const effect = Array.isArray(step.effects) ? (step.effects as JsonRecord[])[0] : undefined; const proposalId = effect !== undefined && effect.source && typeof effect.source === 'object' ? String((effect.source as JsonRecord).proposalId ?? '') : ''
      if (proposalId === '') return fail('PROPOSAL_NOT_FOUND', 'Proposta vinculada não encontrada.', 404)
      const stored = await stateGet<JsonRecord>(env, workspaceId, `proposal:${proposalId}`); if (stored === null) return fail('PROPOSAL_NOT_FOUND', 'Proposta não encontrada.', 404)
      stored.status = input.decision === 'APPROVED' ? 'APPROVED' : 'DENIED'; await statePut(env, workspaceId, `proposal:${proposalId}`, stored)
      const decision = { id: crypto.randomUUID(), executionId, stepId, action: 'workspace.write', target: String(effect?.target ?? '/workspace'), risk: String(effect?.risk ?? 'LOW'), effectsHash: await sha256(JSON.stringify(step.effects ?? [])), scope: input.scope ?? 'ONCE', decision: input.decision, decidedAt: now }
      const execution = current.execution as JsonRecord; const approvals = Array.isArray(execution.approvalIds) ? execution.approvalIds as string[] : []; execution.approvalIds = [...approvals, decision.id]; execution.state = input.decision === 'APPROVED' ? 'WAITING_APPROVAL' : 'BLOCKED'; execution.updatedAt = now; await statePut(env, workspaceId, `plan:${executionId}`, current)
      await appendExecutionEvent(env, workspaceId, executionId, { id: crypto.randomUUID(), at: now, state: execution.state, category: 'APPROVAL', title: input.decision === 'APPROVED' ? 'Proposta aprovada.' : 'Proposta negada.', severity: input.decision === 'APPROVED' ? 'SUCCESS' : 'WARNING' })
      return ok(decision)
    }
    case 'full.planning.start': {
      const executionId = String(input.executionId ?? ''); const current = await stateGet<JsonRecord>(env, workspaceId, `plan:${executionId}`); if (current === null) return fail('PLAN_NOT_FOUND', 'Plano não encontrado.', 404)
      const execution = current.execution as JsonRecord; execution.state = 'EXECUTION'; execution.updatedAt = now; await statePut(env, workspaceId, `plan:${executionId}`, current)
      await appendExecutionEvent(env, workspaceId, executionId, { id: crypto.randomUUID(), at: now, state: 'EXECUTION', category: 'STATE', title: 'Execução autorizada.', severity: 'SUCCESS' }); return ok(execution)
    }
    case 'full.planning.events': return ok(await stateGet<JsonRecord[]>(env, workspaceId, `execution-events:${String(input.executionId ?? '')}`) ?? [])
    case 'full.planning.apply-proposal': {
      const proposalId = String(input.proposalId ?? ''); const stored = await stateGet<JsonRecord>(env, workspaceId, `proposal:${proposalId}`); if (stored === null || stored.status !== 'APPROVED') return fail('PROPOSAL_NOT_APPROVED', 'Proposta não aprovada.', 409)
      const proposal = stored.proposal as JsonRecord; const effect = proposal.effect as JsonRecord; const relativePath = safePath(effect.target); const content = typeof stored.content === 'string' ? stored.content : null; if (relativePath === null || content === null) return fail('INVALID_PROPOSAL', 'Proposta inválida.')
      const sandbox = await ensureWorkspace(env, workspaceId); const target = `/workspace/${relativePath}`; const exists = await sandbox.exists(target); const expected = typeof effect.expectedTargetHash === 'string' ? effect.expectedTargetHash : null
      if (expected !== null && exists.exists) { const currentFile = await sandbox.readFile(target, { encoding: 'utf-8' }); if (await sha256(typeof currentFile.content === 'string' ? currentFile.content : '') !== expected) return fail('STALE_WRITE', 'Arquivo mudou após a aprovação.', 409) }
      const parent = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : ''; if (parent !== '') await sandbox.mkdir(`/workspace/${parent}`, { recursive: true }); await sandbox.writeFile(target, content)
      let persistence: JsonRecord
      try {
        persistence = await createWorkspaceCheckpoint(env, workspaceId, sandbox)
      } catch (cause) {
        return fail('WORKSPACE_BACKUP_FAILED', cause instanceof Error ? cause.message : 'Proposta aplicada, mas o checkpoint R2 falhou.', 503, true)
      }
      stored.status = 'MATERIALIZED'; await statePut(env, workspaceId, `proposal:${proposalId}`, stored)
      const executionId = String(proposal.executionId); const current = await stateGet<JsonRecord>(env, workspaceId, `plan:${executionId}`); if (current !== null) { const execution = current.execution as JsonRecord; const completed = Array.isArray(execution.completedEffectIds) ? execution.completedEffectIds as string[] : []; execution.completedEffectIds = [...completed, String(effect.id)]; execution.state = 'COMPLETED'; execution.updatedAt = now; await statePut(env, workspaceId, `plan:${executionId}`, current) }
      await appendExecutionEvent(env, workspaceId, executionId, { id: crypto.randomUUID(), at: now, state: 'COMPLETED', category: 'TOOL', title: 'workspace.write materializado.', detail: relativePath, severity: 'SUCCESS' })
      return ok({ effectId: String(effect.id), relativePath, hash: await sha256(content), modifiedAt: now, persistence })
    }
    case 'full.prompt.list': return ok(await stateGet<JsonRecord[]>(env, workspaceId, 'prompts') ?? [])
    case 'full.prompt.save': {
      const items = await stateGet<JsonRecord[]>(env, workspaceId, 'prompts') ?? []; const name = String(input.name ?? '').trim(); const prior = items.find((item) => item.name === name); const template = { id: prior?.id ?? crypto.randomUUID(), name, version: Number(prior?.version ?? 0) + 1, content: String(input.content ?? ''), variables: Array.isArray(input.variables) ? input.variables : [], createdAt: prior?.createdAt ?? now, updatedAt: now }; await statePut(env, workspaceId, 'prompts', [...items.filter((item) => item.id !== template.id), template]); return ok(template)
    }
    case 'full.prompt.compile': {
      const items = await stateGet<JsonRecord[]>(env, workspaceId, 'prompts') ?? []; const template = items.find((item) => item.id === input.templateId); if (template === undefined) return fail('PROMPT_NOT_FOUND', 'Template não encontrado.', 404); let content = String(template.content ?? ''); const values = input.values !== null && typeof input.values === 'object' ? input.values as JsonRecord : {}; const variables = Array.isArray(template.variables) ? template.variables as JsonRecord[] : []; for (const variable of variables) { const name = String(variable.name ?? ''); content = content.replaceAll(`{{${name}}}`, typeof values[name] === 'string' ? values[name] as string : String(variable.defaultValue ?? '')) } return ok({ templateId: template.id, version: template.version, content, hash: await sha256(content), compiledAt: now, lint: [] })
    }
    case 'full.prompt.compare': {
      const items = await stateGet<JsonRecord[]>(env, workspaceId, 'prompts') ?? []; const left = items.find((item) => item.id === input.leftId); const right = items.find((item) => item.id === input.rightId); if (!left || !right) return fail('PROMPT_NOT_FOUND', 'Template não encontrado.', 404); const leftLines = new Set(String(left.content ?? '').split('\n')); const rightLines = new Set(String(right.content ?? '').split('\n')); return ok({ left, right, added: [...rightLines].filter((line) => !leftLines.has(line)), removed: [...leftLines].filter((line) => !rightLines.has(line)) })
    }
    case 'full.prompt.lint': { const content = String(input.content ?? ''); const issues: JsonRecord[] = []; if (content.length < 30) issues.push({ severity: 'WARNING', code: 'SHORT_PROMPT', message: 'Prompt muito curto; detalhe objetivo, contexto e critérios.' }); if (!/objetiv|goal|missão/i.test(content)) issues.push({ severity: 'INFO', code: 'NO_EXPLICIT_OBJECTIVE', message: 'Considere declarar um objetivo explícito.' }); return ok(issues) }
    case 'full.prompt.export': { const items = await stateGet<JsonRecord[]>(env, workspaceId, 'prompts') ?? []; const template = items.find((item) => item.id === input.templateId); return template === undefined ? fail('PROMPT_NOT_FOUND', 'Template não encontrado.', 404) : ok(JSON.stringify(template, null, 2)) }
    case 'full.settings.get': { let profile = await stateGet<JsonRecord>(env, workspaceId, 'ui-profile'); if (profile === null) { profile = defaultProfile(); await statePut(env, workspaceId, 'ui-profile', profile) } return ok(profile) }
    case 'full.settings.save': { if (input.profile === null || typeof input.profile !== 'object') return fail('INVALID_PROFILE', 'Perfil inválido.'); const profile = { ...(input.profile as JsonRecord), updatedAt: now }; await statePut(env, workspaceId, 'ui-profile', profile); return ok(profile) }
    case 'full.settings.export': return ok(JSON.stringify(await stateGet<JsonRecord>(env, workspaceId, 'ui-profile') ?? defaultProfile(), null, 2))
    case 'full.settings.import': { try { const profile = JSON.parse(String(input.serialized ?? '')) as JsonRecord; profile.updatedAt = now; await statePut(env, workspaceId, 'ui-profile', profile); return ok(profile) } catch { return fail('INVALID_PROFILE', 'Perfil importado não é JSON válido.') } }
    case 'full.visual.list': return ok(await stateGet<JsonRecord[]>(env, workspaceId, 'visual-assets') ?? [])
    case 'full.visual.add': { const items = await stateGet<JsonRecord[]>(env, workspaceId, 'visual-assets') ?? []; const asset = { ...input, id: crypto.randomUUID(), createdAt: now }; await statePut(env, workspaceId, 'visual-assets', [...items, asset]); return ok(asset) }
    case 'full.visual.use': { const items = await stateGet<JsonRecord[]>(env, workspaceId, 'visual-assets') ?? []; const asset = items.find((item) => item.id === input.assetId); return asset === undefined ? fail('VISUAL_ASSET_NOT_FOUND', 'Asset visual não encontrado.', 404) : ok(asset) }
    case 'full.control.skills': return ok([{ id: 'tupiniquim-toolbox', name: 'Tupiniquim Toolbox', status: 'APPROVED_INTERNAL', enabled: (await stateGet<boolean>(env, workspaceId, `skill:${String(input.projectId ?? 'default')}`)) ?? true, runtimeExecutionAuthorized: false }])
    case 'full.control.skill-set': { await statePut(env, workspaceId, `skill:${String(input.projectId ?? 'default')}`, input.enabled === true); return ok({ id: 'tupiniquim-toolbox', name: 'Tupiniquim Toolbox', status: 'APPROVED_INTERNAL', enabled: input.enabled === true, runtimeExecutionAuthorized: false }) }
    case 'full.control.loadouts': return ok(await stateGet<JsonRecord[]>(env, workspaceId, `loadouts:${String(input.projectId ?? 'default')}`) ?? [])
    case 'full.control.loadout-put': { const key = `loadouts:${String(input.projectId ?? 'default')}`; const items = await stateGet<JsonRecord[]>(env, workspaceId, key) ?? []; const view = { projectId: input.projectId, agentId: input.agentId, provider: input.provider, model: input.model ?? null, skillIds: Array.isArray(input.skillIds) ? input.skillIds : [], permissionProfile: input.permissionProfile, runtimeExecutionAuthorized: false }; await statePut(env, workspaceId, key, [...items.filter((item) => item.agentId !== view.agentId), view]); return ok(view) }
    case 'full.control.gate': {
      const gateId = String(input.gateId ?? '')
      const allowed = new Set(['quality-gates', 'dependency-audit', 'secret-scan', 'security-review', 'privacy-lgpd', 'accessibility-wcag', 'architecture-review', 'supply-chain', 'release-checklist'])
      if (!allowed.has(gateId)) return fail('UNKNOWN_GATE', 'Gate desconhecido.')
      const runtime = await remoteRuntimeStatus(env)
      if (runtime.state !== 'READY') return fail('REMOTE_RUNTIME_OFFLINE', 'O Tupiniquim Remote Runtime precisa estar conectado para executar gates.', 503, true)
      const sandbox = await ensureWorkspace(env, workspaceId)
      const result = await sandbox.runGate(gateId)
      return ok({ gateId, state: result.state, evidence: result.evidence })
    }
    case 'google-tasks.status': return ok(await googleStatus(env, workspaceId))
    case 'google-tasks.connect': {
      if (!googleConfigured(env)) return fail('GOOGLE_TASKS_WEB_CONFIG_REQUIRED', 'Configure GOOGLE_TASKS_CLIENT_ID e GOOGLE_TASKS_CLIENT_SECRET no Worker.')
      const nonce = crypto.randomUUID(); await statePut(env, workspaceId, 'google-oauth-state', nonce); const redirectUri = `${new URL(request.url).origin}/api/google-tasks/callback`; const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth'); auth.searchParams.set('client_id', env.GOOGLE_TASKS_CLIENT_ID as string); auth.searchParams.set('redirect_uri', redirectUri); auth.searchParams.set('response_type', 'code'); auth.searchParams.set('scope', 'https://www.googleapis.com/auth/tasks'); auth.searchParams.set('access_type', 'offline'); auth.searchParams.set('prompt', 'consent'); auth.searchParams.set('state', `${workspaceId}.${nonce}`); return ok({ status: await googleStatus(env, workspaceId), authUrl: auth.toString() })
    }
    case 'google-tasks.disconnect': await stateDelete(env, workspaceId, 'google-tasks-token'); return ok(await googleStatus(env, workspaceId))
    case 'google-tasks.task-lists': { const response = await googleFetch(env, workspaceId, `/users/@me/lists?maxResults=${Math.max(1, Math.min(100, Number(input.maxResults ?? 100)))}`); const body = await response.json() as JsonRecord; if (!response.ok) return fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status); return ok(Array.isArray(body.items) ? body.items : []) }
    case 'google-tasks.task-list.create': { const response = await googleFetch(env, workspaceId, '/users/@me/lists', { method: 'POST', body: JSON.stringify({ title: input.title }) }); const body = await response.json(); return response.ok ? ok(body) : fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status) }
    case 'google-tasks.tasks': { const params = new URLSearchParams({ showCompleted: String(input.showCompleted !== false), showHidden: String(input.showHidden === true), maxResults: String(Math.max(1, Math.min(100, Number(input.maxResults ?? 100)))) }); const response = await googleFetch(env, workspaceId, `/lists/${encodeURIComponent(String(input.taskListId))}/tasks?${params}`); const body = await response.json() as JsonRecord; return response.ok ? ok(Array.isArray(body.items) ? body.items : []) : fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status) }
    case 'google-tasks.task.create': { const response = await googleFetch(env, workspaceId, `/lists/${encodeURIComponent(String(input.taskListId))}/tasks`, { method: 'POST', body: JSON.stringify({ title: input.title, notes: input.notes, due: input.due }) }); const body = await response.json(); return response.ok ? ok(body) : fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status) }
    case 'google-tasks.task.update': { const taskListId = encodeURIComponent(String(input.taskListId)); const taskId = encodeURIComponent(String(input.taskId)); const response = await googleFetch(env, workspaceId, `/lists/${taskListId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ title: input.title, notes: input.notes, due: input.due }) }); const body = await response.json(); return response.ok ? ok(body) : fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status) }
    case 'google-tasks.task.complete': { const taskListId = encodeURIComponent(String(input.taskListId)); const taskId = encodeURIComponent(String(input.taskId)); const response = await googleFetch(env, workspaceId, `/lists/${taskListId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }); const body = await response.json(); return response.ok ? ok(body) : fail('GOOGLE_TASKS_ERROR', JSON.stringify(body), response.status) }
    case 'google-tasks.task.delete': { const response = await googleFetch(env, workspaceId, `/lists/${encodeURIComponent(String(input.taskListId))}/tasks/${encodeURIComponent(String(input.taskId))}`, { method: 'DELETE' }); return response.ok ? ok(null) : fail('GOOGLE_TASKS_ERROR', await response.text(), response.status) }
    default: return null
  }
}

const handleGoogleCallback = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url); const code = url.searchParams.get('code'); const state = url.searchParams.get('state') ?? ''; const dot = state.indexOf('.'); const workspaceId = safeId(dot > 0 ? state.slice(0, dot) : null); const nonce = dot > 0 ? state.slice(dot + 1) : ''
  if (workspaceId === null || code === null || !googleConfigured(env)) return new Response('OAuth inválido.', { status: 400 })
  const expected = await stateGet<string>(env, workspaceId, 'google-oauth-state'); if (expected === null || expected !== nonce) return new Response('Estado OAuth inválido.', { status: 403 })
  const redirectUri = `${url.origin}/api/google-tasks/callback`; const body = new URLSearchParams({ client_id: env.GOOGLE_TASKS_CLIENT_ID as string, client_secret: env.GOOGLE_TASKS_CLIENT_SECRET as string, code, grant_type: 'authorization_code', redirect_uri: redirectUri }); const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }); const tokenJson = await tokenResponse.json() as JsonRecord
  if (!tokenResponse.ok || typeof tokenJson.access_token !== 'string') return new Response('Falha ao autenticar Google Tasks.', { status: 502 })
  const token: StoredToken = { accessToken: tokenJson.access_token, ...(typeof tokenJson.refresh_token === 'string' ? { refreshToken: tokenJson.refresh_token } : {}), expiresAt: new Date(Date.now() + Number(tokenJson.expires_in ?? 3600) * 1000).toISOString(), scope: String(tokenJson.scope ?? 'https://www.googleapis.com/auth/tasks').split(' ') }
  await statePut(env, workspaceId, 'google-tasks-token', token); await stateDelete(env, workspaceId, 'google-oauth-state')
  return new Response('<!doctype html><html><body style="font-family:system-ui;background:#07090f;color:#fff;padding:32px"><h1>Google Tasks conectado</h1><p>Você pode fechar esta janela e voltar ao Tupiniquim Dev AI.</p><script>setTimeout(()=>window.close(),1200)</script></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      const response = await legacyWorker.fetch(request.clone(), env)
      const body = await response.clone().json() as JsonRecord
      return Response.json({
        ...body,
        executionRuntime: await remoteRuntimeStatus(env),
        workspacePersistence: workspacePersistenceStatus(env)
      }, { status: response.status })
    }
    if (url.pathname === '/api/google-tasks/callback') return handleGoogleCallback(request, env)
    if (url.pathname === '/api/studio' && request.method === 'POST') {
      const workspaceId = workspaceIdFrom(request, url)
      if (workspaceId === null) return fail('WORKSPACE_ID_REQUIRED', 'Workspace Web não identificado.')
      let body: RpcRequest
      try { body = await request.clone().json() as RpcRequest } catch { return fail('INVALID_JSON', 'Corpo JSON inválido.') }
      const input = body.input !== null && typeof body.input === 'object' ? body.input as JsonRecord : {}
      const handled = await handleStateRpc(request, env, workspaceId, body.action ?? '', input)
      if (handled !== null) return handled
    }
    return legacyWorker.fetch(request, env)
  }
}

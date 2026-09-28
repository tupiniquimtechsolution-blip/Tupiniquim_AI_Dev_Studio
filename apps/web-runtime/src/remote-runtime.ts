export interface RemoteRuntimeConfig {
  WEB_REMOTE_RUNTIME_ENABLED?: string
  REMOTE_RUNTIME_URL?: string
  REMOTE_RUNTIME_TOKEN?: string
}

export type RemoteRuntimeState = 'DISABLED' | 'MISCONFIGURED' | 'READY' | 'OFFLINE'

export interface RemoteRuntimeStatus {
  state: RemoteRuntimeState
  configured: boolean
  online: boolean
  transport: 'https-tunnel'
  detail?: string
  platform?: string
  capabilities?: string[]
}

type JsonRecord = Record<string, unknown>

type RuntimeEnvelope<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; retryable?: boolean } }

const readiness = (env: RemoteRuntimeConfig): { state: 'DISABLED' | 'MISCONFIGURED' | 'CONFIGURED'; missing: string[] } => {
  if (env.WEB_REMOTE_RUNTIME_ENABLED !== 'true') return { state: 'DISABLED', missing: [] }
  const missing = [
    typeof env.REMOTE_RUNTIME_URL === 'string' && env.REMOTE_RUNTIME_URL.trim() !== '' ? null : 'REMOTE_RUNTIME_URL',
    typeof env.REMOTE_RUNTIME_TOKEN === 'string' && env.REMOTE_RUNTIME_TOKEN.trim() !== '' ? null : 'REMOTE_RUNTIME_TOKEN'
  ].filter((value): value is string => value !== null)
  return missing.length === 0 ? { state: 'CONFIGURED', missing: [] } : { state: 'MISCONFIGURED', missing }
}

export const remoteRuntimeReadiness = (env: RemoteRuntimeConfig): RemoteRuntimeStatus => {
  const state = readiness(env)
  if (state.state === 'DISABLED') return { state: 'DISABLED', configured: false, online: false, transport: 'https-tunnel' }
  if (state.state === 'MISCONFIGURED') {
    return { state: 'MISCONFIGURED', configured: false, online: false, transport: 'https-tunnel', detail: `Ausente: ${state.missing.join(', ')}` }
  }
  return { state: 'OFFLINE', configured: true, online: false, transport: 'https-tunnel', detail: 'Gateway configurado; disponibilidade ainda não verificada.' }
}

const endpoint = (env: RemoteRuntimeConfig, pathname: string): URL => {
  const base = env.REMOTE_RUNTIME_URL?.trim()
  if (!base) throw new Error('REMOTE_RUNTIME_URL não configurado.')
  return new URL(pathname, base.endsWith('/') ? base : `${base}/`)
}

const authorizedHeaders = (env: RemoteRuntimeConfig, headers?: HeadersInit): Headers => {
  const token = env.REMOTE_RUNTIME_TOKEN?.trim()
  if (!token) throw new Error('REMOTE_RUNTIME_TOKEN não configurado.')
  const result = new Headers(headers)
  result.set('authorization', `Bearer ${token}`)
  return result
}

const runtimeRpc = async <T>(
  env: RemoteRuntimeConfig,
  workspaceId: string,
  method: string,
  args: JsonRecord = {}
): Promise<T> => {
  const config = readiness(env)
  if (config.state !== 'CONFIGURED') throw new Error(config.state === 'DISABLED' ? 'Remote Runtime desativado.' : `Remote Runtime incompleto: ${config.missing.join(', ')}`)
  const response = await fetch(endpoint(env, 'rpc'), {
    method: 'POST',
    headers: authorizedHeaders(env, { 'content-type': 'application/json' }),
    body: JSON.stringify({ workspaceId, method, args })
  })
  let envelope: RuntimeEnvelope<T>
  try {
    envelope = await response.json() as RuntimeEnvelope<T>
  } catch {
    throw new Error(`Remote Runtime retornou HTTP ${response.status} sem envelope JSON válido.`)
  }
  if (!response.ok || !envelope.ok) {
    const message = envelope.ok ? `Remote Runtime HTTP ${response.status}.` : envelope.error.message
    throw new Error(message)
  }
  return envelope.value
}

export const remoteRuntimeStatus = async (env: RemoteRuntimeConfig): Promise<RemoteRuntimeStatus> => {
  const base = remoteRuntimeReadiness(env)
  if (!base.configured) return base
  try {
    const response = await fetch(endpoint(env, 'health'), {
      headers: authorizedHeaders(env),
      signal: AbortSignal.timeout(3_000)
    })
    if (!response.ok) return { ...base, state: 'OFFLINE', online: false, detail: `Gateway respondeu HTTP ${response.status}.` }
    const body = await response.json() as JsonRecord
    const status: RemoteRuntimeStatus = {
      state: 'READY',
      configured: true,
      online: true,
      transport: 'https-tunnel'
    }
    if (typeof body.platform === 'string') status.platform = body.platform
    if (Array.isArray(body.capabilities)) {
      status.capabilities = body.capabilities.filter((value): value is string => typeof value === 'string')
    }
    return status
  } catch (cause) {
    return { ...base, state: 'OFFLINE', online: false, detail: cause instanceof Error ? cause.message : 'Gateway indisponível.' }
  }
}

export const getRemoteSandbox = (env: RemoteRuntimeConfig, workspaceId: string) => {
  const configured = (): boolean => readiness(env).state === 'CONFIGURED'

  return {
    exists: async (path: string): Promise<{ exists: boolean }> => {
      if (!configured()) return { exists: path === '/workspace' }
      try { return await runtimeRpc<{ exists: boolean }>(env, workspaceId, 'fs.exists', { path }) }
      catch { return { exists: path === '/workspace' } }
    },
    mkdir: async (path: string, options?: { recursive?: boolean }): Promise<void> => {
      if (!configured()) return
      await runtimeRpc<null>(env, workspaceId, 'fs.mkdir', { path, recursive: options?.recursive === true })
    },
    readFile: async (path: string, options?: { encoding?: string }): Promise<{ content: string }> => {
      void options
      return runtimeRpc(env, workspaceId, 'fs.read-file', { path })
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      await runtimeRpc<null>(env, workspaceId, 'fs.write-file', { path, content })
    },
    listTree: async (depth: number): Promise<Array<JsonRecord>> =>
      runtimeRpc(env, workspaceId, 'workspace.tree', { depth }),
    search: async (query: string, limit: number): Promise<Array<JsonRecord>> =>
      runtimeRpc(env, workspaceId, 'workspace.search', { query, limit }),
    gitStatus: async (): Promise<JsonRecord> => runtimeRpc(env, workspaceId, 'git.status'),
    gitDiff: async (relativePath: string | null): Promise<string> =>
      runtimeRpc(env, workspaceId, 'git.diff', { relativePath }),
    bootstrapRepo: async (repository: string, ref: string): Promise<{ cloned: boolean; detail: string }> =>
      runtimeRpc(env, workspaceId, 'workspace.bootstrap-repo', { repository, ref }),
    runGate: async (gateId: string): Promise<{ state: 'PASS' | 'FAIL'; evidence: string }> =>
      runtimeRpc(env, workspaceId, 'control.gate', { gateId }),
    createBackup: async (options: { dir: string; name: string; ttl: number; gitignore: boolean }): Promise<JsonRecord> =>
      runtimeRpc(env, workspaceId, 'workspace.backup-create', options),
    restoreBackup: async (handle: unknown): Promise<void> => {
      await runtimeRpc<null>(env, workspaceId, 'workspace.backup-restore', { handle })
    },
    terminal: async (request: Request, options?: { cols?: number; rows?: number }): Promise<Response> => {
      const config = readiness(env)
      if (config.state !== 'CONFIGURED') {
        return Response.json({ ok: false, error: { code: 'REMOTE_RUNTIME_OFFLINE', message: 'Runtime remoto não configurado.', retryable: true } }, { status: 503 })
      }
      const target = endpoint(env, 'terminal')
      target.searchParams.set('workspace', workspaceId)
      target.searchParams.set('cols', String(options?.cols ?? 100))
      target.searchParams.set('rows', String(options?.rows ?? 30))
      const headers = authorizedHeaders(env, request.headers)
      headers.set('x-tupiniquim-workspace', workspaceId)
      const upstream = new Request(target.toString(), { method: 'GET', headers })
      return fetch(upstream)
    }
  }
}

export type RemoteSandbox = ReturnType<typeof getRemoteSandbox>

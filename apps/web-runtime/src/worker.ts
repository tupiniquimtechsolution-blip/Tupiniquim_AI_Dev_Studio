import { getSandbox } from '@cloudflare/sandbox'
export { Sandbox } from '@cloudflare/sandbox'

type SandboxNamespace = Parameters<typeof getSandbox>[0]

type WorkersAi = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

type AssetBinding = { fetch(request: Request): Promise<Response> }

type Env = {
  Sandbox: SandboxNamespace
  AI: WorkersAi
  ASSETS: AssetBinding
  WEB_ALLOW_ANONYMOUS?: string
}

type RpcRequest = { action?: string; input?: unknown }

type JsonRecord = Record<string, unknown>

const WEB_MODELS = [
  '@cf/moonshotai/kimi-k2.6',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
] as const

const ok = <T>(value: T, extra?: JsonRecord): Response => Response.json({ ok: true, value, ...(extra ?? {}) })
const fail = (code: string, message: string, status = 400, retryable = false): Response =>
  Response.json({ ok: false, error: { code, message, retryable } }, { status })

const safeId = (value: string | null): string | null => {
  if (value === null) return null
  const normalized = value.trim()
  return /^[a-zA-Z0-9_-]{8,96}$/.test(normalized) ? normalized : null
}

const safeRelativePath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) return null
  return normalized
}

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const workspaceKey = (request: Request, url: URL): string | null =>
  safeId(request.headers.get('x-tupiniquim-workspace')) ?? safeId(url.searchParams.get('workspace'))

const identityAllowed = (request: Request, env: Env): boolean => {
  const accessIdentity = request.headers.get('cf-access-authenticated-user-email')
  if (accessIdentity !== null && accessIdentity.trim() !== '') return true
  return env.WEB_ALLOW_ANONYMOUS === 'true'
}

const sandboxFor = (env: Env, id: string) => getSandbox(env.Sandbox, `tupiniquim-${id}`, {
  transport: 'rpc',
  sleepAfter: '30m',
  labels: { product: 'tupiniquim-dev-ai', surface: 'web' }
})

const ensureWorkspace = async (sandbox: ReturnType<typeof sandboxFor>): Promise<void> => {
  const exists = await sandbox.exists('/workspace')
  if (!exists.exists) await sandbox.mkdir('/workspace', { recursive: true })
}

const parseFindTree = (stdout: string): Array<JsonRecord> => stdout
  .split('\n')
  .filter(Boolean)
  .flatMap((line) => {
    const [kind, path, size, epoch] = line.split('|')
    if (path === undefined || size === undefined || epoch === undefined) return []
    const relativePath = path.replace(/^\.\/?/, '')
    if (relativePath === '' || relativePath.startsWith('.tupiniquim-web')) return []
    return [{
      name: relativePath.split('/').at(-1) ?? relativePath,
      relativePath,
      kind: kind === 'd' ? 'directory' : 'file',
      size: Number(size) || 0,
      modifiedAt: new Date((Number(epoch) || 0) * 1000).toISOString()
    }]
  })

const listWorkspace = async (sandbox: ReturnType<typeof sandboxFor>, depth: number): Promise<Array<JsonRecord>> => {
  const boundedDepth = Math.max(1, Math.min(8, Math.floor(depth)))
  const result = await sandbox.exec(`find . -mindepth 1 -maxdepth ${boundedDepth} -printf '%y|%p|%s|%T@\\n'`, { cwd: '/workspace', timeout: 15_000 })
  if (!result.success) throw new Error(result.stderr || 'Falha ao listar workspace.')
  return parseFindTree(result.stdout)
}

const selectedModel = (request: Request): string => {
  const requested = request.headers.get('x-tupiniquim-model')
  return WEB_MODELS.includes(requested as typeof WEB_MODELS[number]) ? requested as typeof WEB_MODELS[number] : WEB_MODELS[0]
}

const aiText = (response: unknown): string => {
  if (typeof response === 'string') return response
  if (response !== null && typeof response === 'object') {
    const record = response as JsonRecord
    if (typeof record.response === 'string') return record.response
    if (typeof record.result === 'string') return record.result
    if (record.result !== null && typeof record.result === 'object') {
      const nested = record.result as JsonRecord
      if (typeof nested.response === 'string') return nested.response
    }
  }
  return JSON.stringify(response)
}

const handleAgentSend = async (request: Request, env: Env, input: JsonRecord): Promise<Response> => {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (message === '') return fail('INVALID_MESSAGE', 'Mensagem vazia.')
  const mode = typeof input.mode === 'string' ? input.mode : 'CHAT'
  const model = selectedModel(request)
  const threadId = typeof input.threadId === 'string' && input.threadId !== '' ? input.threadId : crypto.randomUUID()
  const turnId = crypto.randomUUID()
  const workspaceContext = typeof input.workspaceContext === 'string' ? input.workspaceContext.slice(0, 20_000) : ''
  const system = [
    'Você é o agente de engenharia do Tupiniquim Dev AI.',
    `Modo atual: ${mode}.`,
    'Responda em português do Brasil quando o usuário escrever em português.',
    'Não afirme ter alterado arquivos a menos que uma ferramenta de workspace tenha realmente sido executada.',
    workspaceContext === '' ? '' : `Contexto de metadados do workspace:\n${workspaceContext}`
  ].filter(Boolean).join('\n\n')

  const inference = await env.AI.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: message }
    ]
  })
  const text = aiText(inference)
  const now = new Date().toISOString()
  const events = [
    { id: crypto.randomUUID(), at: now, kind: 'THREAD_STARTED', threadId },
    { id: crypto.randomUUID(), at: now, kind: 'TURN_STARTED', threadId, turnId },
    { id: crypto.randomUUID(), at: now, kind: 'MESSAGE_DELTA', threadId, turnId, text },
    { id: crypto.randomUUID(), at: new Date().toISOString(), kind: 'TURN_COMPLETED', threadId, turnId, status: 'COMPLETED' }
  ]
  return ok({ threadId, turnId, model }, { events })
}

const handleResearchSearch = async (env: Env, input: JsonRecord): Promise<Response> => {
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  if (query.length < 2) return fail('INVALID_QUERY', 'Consulta de pesquisa inválida.')
  const endpoint = new URL('https://html.duckduckgo.com/html/')
  endpoint.searchParams.set('q', query)
  const response = await fetch(endpoint, { headers: { 'user-agent': 'TupiniquimDevAI/0.1 (+research)' } })
  const html = await response.text()
  const max = typeof input.maxResults === 'number' ? Math.max(1, Math.min(20, Math.floor(input.maxResults))) : 8
  const matches = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].slice(0, max)
  const strip = (value: string): string => value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
  const sources = matches.flatMap((match) => {
    try {
      const target = new URL(match[1] ?? '')
      const redirected = target.searchParams.get('uddg')
      const url = redirected === null ? target.toString() : decodeURIComponent(redirected)
      return [{ id: crypto.randomUUID(), url, title: strip(match[2] ?? url), snippet: strip(match[3] ?? ''), retrievedAt: new Date().toISOString(), origin: 'SEARCH', trust: 'EXTERNAL_UNTRUSTED', license: 'UNKNOWN', promptInjectionSignals: [] }]
    } catch { return [] }
  })
  return ok({ query, sources, cached: false })
}

const handleStudioRpc = async (request: Request, env: Env, workspaceId: string): Promise<Response> => {
  let body: RpcRequest
  try { body = await request.json() as RpcRequest } catch { return fail('INVALID_JSON', 'Corpo JSON inválido.') }
  const action = body.action ?? ''
  const input = body.input !== null && typeof body.input === 'object' ? body.input as JsonRecord : {}
  const sandbox = sandboxFor(env, workspaceId)
  await ensureWorkspace(sandbox)

  try {
    switch (action) {
      case 'system.info':
        return ok({ platform: 'cloudflare-sandbox', arch: 'linux', version: 'web-0.1.0', dataRoot: '/workspace', permissionProfile: 'ASSISTED' })
      case 'workspace.pick':
        return ok('/workspace')
      case 'workspace.configure':
        return ok('/workspace')
      case 'workspace.list': {
        const depth = typeof input.depth === 'number' ? input.depth : 4
        return ok(await listWorkspace(sandbox, depth))
      }
      case 'workspace.read': {
        const relativePath = safeRelativePath(input.relativePath)
        if (relativePath === null || relativePath === '') return fail('INVALID_PATH', 'Caminho inválido.')
        const file = await sandbox.readFile(`/workspace/${relativePath}`, { encoding: 'utf-8' })
        const content = typeof file.content === 'string' ? file.content : ''
        return ok({ relativePath, content, hash: await sha256(content), modifiedAt: new Date().toISOString() })
      }
      case 'workspace.write': {
        const relativePath = safeRelativePath(input.relativePath)
        const content = typeof input.content === 'string' ? input.content : null
        if (relativePath === null || relativePath === '' || content === null) return fail('INVALID_WRITE', 'Escrita de workspace inválida.')
        const expectedHash = typeof input.expectedHash === 'string' ? input.expectedHash : null
        if (expectedHash !== null) {
          const exists = await sandbox.exists(`/workspace/${relativePath}`)
          if (exists.exists) {
            const current = await sandbox.readFile(`/workspace/${relativePath}`, { encoding: 'utf-8' })
            const currentContent = typeof current.content === 'string' ? current.content : ''
            if (await sha256(currentContent) !== expectedHash) return fail('STALE_WRITE', 'O arquivo mudou desde a leitura; escrita recusada.', 409)
          }
        }
        const parent = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : ''
        if (parent !== '') await sandbox.mkdir(`/workspace/${parent}`, { recursive: true })
        await sandbox.writeFile(`/workspace/${relativePath}`, content)
        return ok({ relativePath, content, hash: await sha256(content), modifiedAt: new Date().toISOString() })
      }
      case 'workspace.search': {
        const query = typeof input.query === 'string' ? input.query : ''
        if (query === '') return fail('INVALID_QUERY', 'Consulta vazia.')
        const limit = typeof input.limit === 'number' ? Math.max(1, Math.min(500, Math.floor(input.limit))) : 100
        const result = await sandbox.exec(`rg -n --fixed-strings --color never -- ${shellQuote(query)} . | head -n ${limit}`, { cwd: '/workspace', timeout: 15_000 })
        const matches = result.stdout.split('\n').filter(Boolean).flatMap((line) => {
          const first = line.indexOf(':')
          const second = line.indexOf(':', first + 1)
          if (first < 0 || second < 0) return []
          return [{ relativePath: line.slice(0, first).replace(/^\.\//, ''), line: Number(line.slice(first + 1, second)) || 1, preview: line.slice(second + 1) }]
        })
        return ok(matches)
      }
      case 'workspace.context': {
        const entries = await listWorkspace(sandbox, 4)
        return ok({ generatedAt: new Date().toISOString(), entries: entries.slice(0, 1000).map(({ relativePath, kind, size }) => ({ relativePath, kind, size })), truncated: entries.length > 1000, contentPolicy: 'METADATA_ONLY' })
      }
      case 'git.status': {
        const result = await sandbox.exec("git status --porcelain=v1 -b", { cwd: '/workspace', timeout: 15_000 })
        if (!result.success) return ok({ branch: 'web-workspace', ahead: 0, behind: 0, entries: [] })
        const lines = result.stdout.split('\n').filter(Boolean)
        const branchLine = lines.shift() ?? '## web-workspace'
        const branch = branchLine.replace(/^##\s*/, '').split('...')[0]?.trim() || 'web-workspace'
        const entries = lines.map((line) => ({ path: line.slice(3).trim(), index: line[0] ?? ' ', worktree: line[1] ?? ' ' }))
        return ok({ branch, ahead: 0, behind: 0, entries })
      }
      case 'git.diff': {
        const relativePath = safeRelativePath(input.relativePath)
        const command = relativePath === null || relativePath === '' ? 'git diff --' : `git diff -- ${shellQuote(relativePath)}`
        const result = await sandbox.exec(command, { cwd: '/workspace', timeout: 15_000 })
        return result.success ? ok(result.stdout) : fail('GIT_DIFF_FAILED', result.stderr || 'Falha no git diff.')
      }
      case 'agent.status':
        return ok({ provider: 'ollama', selectedModel: selectedModel(request), state: 'READY', account: 'NONE', version: 'workers-ai', activeThreadId: null, activeTurnId: null, detail: 'WEB_WORKERS_AI' })
      case 'agent.provider.select':
        return ok({ provider: 'ollama', selectedModel: selectedModel(request), state: 'READY', account: 'NONE', version: 'workers-ai', activeThreadId: null, activeTurnId: null, detail: 'WEB_WORKERS_AI' })
      case 'agent.local-models':
        return ok(WEB_MODELS.map((model) => ({ name: model.replace('@cf/', ''), model, modifiedAt: null, size: null })))
      case 'agent.local-model.select':
        return ok({ provider: 'ollama', selectedModel: typeof input.model === 'string' ? input.model : selectedModel(request), state: 'READY', account: 'NONE', version: 'workers-ai', activeThreadId: null, activeTurnId: null, detail: 'WEB_WORKERS_AI' })
      case 'agent.session':
        return ok(null)
      case 'agent.history':
        return ok({ thread: null, turns: [], events: [] })
      case 'agent.send':
        return handleAgentSend(request, env, input)
      case 'agent.interrupt':
        return ok(null)
      case 'agent.proposal-status':
        return ok('EXPIRED')
      case 'research.search':
        return handleResearchSearch(env, input)
      case 'research.collect': {
        const target = typeof input.url === 'string' ? input.url : ''
        if (!/^https?:\/\//i.test(target)) return fail('INVALID_URL', 'URL inválida.')
        const response = await fetch(target, { redirect: 'follow', headers: { 'user-agent': 'TupiniquimDevAI/0.1 (+research)' } })
        const text = (await response.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12_000)
        return ok({ id: crypto.randomUUID(), url: response.url, title: new URL(response.url).hostname, snippet: text, retrievedAt: new Date().toISOString(), origin: 'DIRECT', trust: 'EXTERNAL_UNTRUSTED', license: 'UNKNOWN', promptInjectionSignals: [] })
      }
      case 'research.resolve': {
        const requirements = typeof input.requirements === 'string' ? input.requirements : ''
        const model = selectedModel(request)
        const inference = await env.AI.run(model, { messages: [{ role: 'system', content: 'Resuma opções tecnológicas de forma factual e concisa. Não invente fontes.' }, { role: 'user', content: requirements }] })
        const summary = aiText(inference)
        return ok({ id: crypto.randomUUID(), requirements, generatedAt: new Date().toISOString(), recommendations: [], knowledgePack: { title: 'Resolução Web', summary, citations: [] } })
      }
      default:
        return fail('WEB_ACTION_NOT_IMPLEMENTED', `A ação ${action || '(vazia)'} ainda não foi mapeada para o runtime Web.`, 501)
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha no runtime Web.'
    return fail('WEB_RUNTIME_ERROR', message, 500, true)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, product: 'Tupiniquim Dev AI Web', runtime: 'cloudflare-sandbox', ai: 'workers-ai' })
    }

    if (url.pathname.startsWith('/api/') || url.pathname === '/ws/terminal') {
      if (!identityAllowed(request, env)) return fail('AUTH_REQUIRED', 'A edição Web exige Cloudflare Access ou WEB_ALLOW_ANONYMOUS=true durante testes.', 401)
      const id = workspaceKey(request, url)
      if (id === null) return fail('WORKSPACE_ID_REQUIRED', 'Workspace Web não identificado.', 400)
      const sandbox = sandboxFor(env, id)
      await ensureWorkspace(sandbox)

      if (url.pathname === '/ws/terminal') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return fail('WEBSOCKET_REQUIRED', 'Upgrade WebSocket obrigatório.', 426)
        const cols = Math.max(20, Math.min(500, Number(url.searchParams.get('cols') ?? 100)))
        const rows = Math.max(5, Math.min(200, Number(url.searchParams.get('rows') ?? 30)))
        return await (sandbox as unknown as { terminal(request: Request, options?: { cols?: number; rows?: number }): Promise<Response> }).terminal(request, { cols, rows })
      }

      if (url.pathname === '/api/studio' && request.method === 'POST') return handleStudioRpc(request, env, id)
      return fail('NOT_FOUND', 'Endpoint Web não encontrado.', 404)
    }

    return env.ASSETS.fetch(request)
  }
}

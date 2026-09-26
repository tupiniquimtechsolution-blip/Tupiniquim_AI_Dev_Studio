import type {
  AIEvent,
  AgentLoadoutView,
  ControlCenterDesktopApi,
  FileDocument,
  FileEntry,
  GoogleTasksDesktopApi,
  PlannedExecution,
  PromptLintIssue,
  PromptTemplate,
  Result,
  StudioApi,
  TerminalDataEvent,
  UIProfile,
  VisualAsset,
  VisualProviderStatus,
  WorkspaceWriteProposal
} from '@tupiniquim/contracts'

const WORKSPACE_KEY = 'tupiniquim.web.workspace-id'
const MODEL_KEY = 'tupiniquim.web.model'
const PROFILE_KEY = 'tupiniquim.web.ui-profile'
const PROMPTS_KEY = 'tupiniquim.web.prompts'
const VISUAL_ASSETS_KEY = 'tupiniquim.web.visual-assets'
const DEFAULT_MODEL = '@cf/moonshotai/kimi-k2.6'

const workspaceId = (): string => {
  const existing = localStorage.getItem(WORKSPACE_KEY)
  if (existing !== null && /^[a-zA-Z0-9_-]{8,96}$/.test(existing)) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(WORKSPACE_KEY, created)
  return created
}

const selectedModel = (): string => localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL

const appError = (code: string, message: string, retryable = false): Result<never> => ({ ok: false, error: { code, message, retryable } })
const success = <T>(value: T): Result<T> => ({ ok: true, value })

interface RpcEnvelope<T> extends Record<string, unknown> {
  ok: boolean
  value?: T
  error?: { code: string; message: string; retryable: boolean }
  events?: AIEvent[]
}

const rpcEnvelope = async <T>(action: string, input?: unknown): Promise<RpcEnvelope<T>> => {
  try {
    const response = await fetch('/api/studio', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tupiniquim-workspace': workspaceId(),
        'x-tupiniquim-model': selectedModel()
      },
      body: JSON.stringify(input === undefined ? { action } : { action, input })
    })
    return await response.json() as RpcEnvelope<T>
  } catch (cause) {
    return { ok: false, error: { code: 'WEB_TRANSPORT_ERROR', message: cause instanceof Error ? cause.message : 'Falha de transporte Web.', retryable: true } }
  }
}

const rpc = async <T>(action: string, input?: unknown): Promise<Result<T>> => {
  const result = await rpcEnvelope<T>(action, input)
  if (result.ok && result.value !== undefined) return success(result.value)
  if (result.ok) return success(undefined as T)
  return { ok: false, error: result.error ?? { code: 'WEB_RUNTIME_ERROR', message: 'Falha no runtime Web.', retryable: true } }
}

const terminalSockets = new Map<string, WebSocket>()
const terminalPending = new Map<string, ArrayBuffer[]>()
const terminalListeners = new Set<(event: TerminalDataEvent) => void>()
const agentListeners = new Set<(event: AIEvent) => void>()
const proposalListeners = new Set<(proposal: WorkspaceWriteProposal) => void>()
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const emitTerminal = (event: TerminalDataEvent): void => {
  for (const listener of terminalListeners) listener(event)
}

const createTerminal = (cols: number, rows: number): string => {
  const terminalId = crypto.randomUUID()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = new URL(`${protocol}//${window.location.host}/ws/terminal`)
  url.searchParams.set('workspace', workspaceId())
  url.searchParams.set('cols', String(cols))
  url.searchParams.set('rows', String(rows))
  const socket = new WebSocket(url)
  socket.binaryType = 'arraybuffer'
  terminalSockets.set(terminalId, socket)
  terminalPending.set(terminalId, [])

  socket.addEventListener('open', () => {
    const pending = terminalPending.get(terminalId) ?? []
    for (const item of pending) socket.send(item)
    terminalPending.delete(terminalId)
  })
  socket.addEventListener('message', (event) => {
    if (event.data instanceof ArrayBuffer) {
      emitTerminal({ terminalId, data: decoder.decode(event.data) })
      return
    }
    if (typeof event.data !== 'string') return
    try {
      const control = JSON.parse(event.data) as { type?: string; code?: number; message?: string }
      if (control.type === 'exit') emitTerminal({ terminalId, data: '', exited: true, exitCode: control.code ?? 0 })
      if (control.type === 'error') emitTerminal({ terminalId, data: `\r\n[terminal] ${control.message ?? 'erro'}\r\n` })
    } catch {
      emitTerminal({ terminalId, data: event.data })
    }
  })
  socket.addEventListener('close', () => {
    emitTerminal({ terminalId, data: '', exited: true, exitCode: 0 })
    terminalSockets.delete(terminalId)
    terminalPending.delete(terminalId)
  })
  socket.addEventListener('error', () => emitTerminal({ terminalId, data: '\r\n[terminal] conexão WebSocket interrompida.\r\n' }))
  return terminalId
}

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const defaultProfile = (): UIProfile => ({
  id: crypto.randomUUID(),
  name: 'Tupiniquim Web',
  density: 'COMFORTABLE',
  theme: {
    background: '#07090f', surface: '#0d1018', raised: '#111622', text: '#f7f7fb', muted: '#9da6b7', accent: '#8fa8ff', info: '#76b7ff', warning: '#e3b879', danger: '#ef7f7f'
  },
  layout: { explorerWidth: 280, agentWidth: 390, deckHeight: 260 },
  updatedAt: new Date().toISOString()
})

const getProfile = (): UIProfile => {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (raw !== null) {
    try { return JSON.parse(raw) as UIProfile } catch { /* use default */ }
  }
  const profile = defaultProfile()
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}

const getPrompts = (): PromptTemplate[] => {
  try { return JSON.parse(localStorage.getItem(PROMPTS_KEY) ?? '[]') as PromptTemplate[] } catch { return [] }
}
const putPrompts = (items: PromptTemplate[]): void => localStorage.setItem(PROMPTS_KEY, JSON.stringify(items))
const getVisualAssets = (): VisualAsset[] => {
  try { return JSON.parse(localStorage.getItem(VISUAL_ASSETS_KEY) ?? '[]') as VisualAsset[] } catch { return [] }
}
const putVisualAssets = (items: VisualAsset[]): void => localStorage.setItem(VISUAL_ASSETS_KEY, JSON.stringify(items))

const plans = new Map<string, PlannedExecution>()
const executionEvents = new Map<string, Array<{ id: string; at: string; state: 'PLAN' | 'WAITING_APPROVAL' | 'EXECUTION' | 'COMPLETED'; category: 'STATE'; title: string; severity: 'INFO' | 'SUCCESS' }>>()

const visualStatuses: VisualProviderStatus[] = [
  { id: 'YANDEX_IMAGES', label: 'Yandex Images', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://yandex.com/images/', detail: 'Pesquisa visual assistida.' },
  { id: 'MAGNIFIC', label: 'Magnific', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://magnific.ai/', detail: 'Upscale e tratamento assistido.' },
  { id: 'EVERYPIXEL', label: 'Everypixel', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://www.everypixel.com/', detail: 'Busca de mídia assistida.' },
  { id: 'KREA', label: 'Krea', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://www.krea.ai/', detail: 'Geração visual assistida.' },
  { id: 'FONTJOY', label: 'Fontjoy', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://fontjoy.com/', detail: 'Combinação tipográfica.' },
  { id: 'HAIKEI', label: 'Haikei', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://haikei.app/', detail: 'Gerador de assets SVG.' },
  { id: 'STILLS', label: 'Stills', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://www.stills.com/', detail: 'Referências visuais.' },
  { id: 'SPOT_DSGN', label: 'Spot Design', state: 'ASSISTED_DEEP_LINK', kind: 'ASSISTED', url: 'https://spot.design/', detail: 'Referências de design.' }
]

export const installWebBridge = (): void => {
  ;(window as Window & { __TUPINIQUIM_WEB__?: boolean }).__TUPINIQUIM_WEB__ = true

  const studio: StudioApi = {
    system: { info: () => rpc('system.info') },
    workspace: {
      pick: () => rpc('workspace.pick'),
      configure: (input) => rpc('workspace.configure', input),
      list: (input) => rpc<FileEntry[]>('workspace.list', input),
      read: (input) => rpc<FileDocument>('workspace.read', input),
      write: (input) => rpc<FileDocument>('workspace.write', input),
      search: (input) => rpc('workspace.search', input),
      context: () => rpc('workspace.context')
    },
    git: {
      status: () => rpc('git.status'),
      diff: (relativePath) => rpc('git.diff', { relativePath })
    },
    terminal: {
      create: async (input) => success({ terminalId: createTerminal(input.cols ?? 100, input.rows ?? 30) }),
      write: async (input) => {
        const socket = terminalSockets.get(input.terminalId)
        if (socket === undefined) return appError('TERMINAL_NOT_FOUND', 'Terminal Web não encontrado.')
        const bytes = encoder.encode(input.data).buffer
        if (socket.readyState === WebSocket.OPEN) socket.send(bytes)
        else if (socket.readyState === WebSocket.CONNECTING) terminalPending.get(input.terminalId)?.push(bytes)
        else return appError('TERMINAL_CLOSED', 'Terminal Web encerrado.')
        return success(undefined)
      },
      resize: async (input) => {
        const socket = terminalSockets.get(input.terminalId)
        if (socket === undefined || socket.readyState !== WebSocket.OPEN) return appError('TERMINAL_NOT_READY', 'Terminal Web ainda não está conectado.', true)
        socket.send(JSON.stringify({ type: 'resize', cols: input.cols, rows: input.rows }))
        return success(undefined)
      },
      kill: async (input) => {
        const socket = terminalSockets.get(input.terminalId)
        if (socket !== undefined) {
          if (socket.readyState === WebSocket.OPEN) socket.send(encoder.encode('\u0004').buffer)
          socket.close(1000, 'Tupiniquim terminal closed')
        }
        return success(undefined)
      },
      onData: (listener) => { terminalListeners.add(listener); return () => terminalListeners.delete(listener) }
    },
    agent: {
      status: () => rpc('agent.status'),
      selectProvider: (input) => rpc('agent.provider.select', input),
      listLocalModels: () => rpc('agent.local-models'),
      selectLocalModel: async (input) => {
        localStorage.setItem(MODEL_KEY, input.model)
        return rpc('agent.local-model.select', input)
      },
      history: (input) => rpc('agent.history', input),
      session: () => rpc('agent.session'),
      send: async (input) => {
        const result = await rpcEnvelope<{ threadId: string; turnId: string; model?: string | null }>('agent.send', input)
        if (!result.ok || result.value === undefined) return { ok: false, error: result.error ?? { code: 'AGENT_SEND_FAILED', message: 'Falha ao enviar mensagem.', retryable: true } }
        queueMicrotask(() => { for (const event of result.events ?? []) for (const listener of agentListeners) listener(event) })
        return success(result.value)
      },
      interrupt: (input) => rpc('agent.interrupt', input),
      onEvent: (listener) => { agentListeners.add(listener); return () => agentListeners.delete(listener) },
      onWorkspaceWriteProposal: (listener) => { proposalListeners.add(listener); return () => proposalListeners.delete(listener) },
      lookupProposalStatus: (proposalId) => rpc('agent.proposal-status', { proposalId })
    },
    planning: {
      create: async (input) => {
        const now = new Date().toISOString()
        const stepId = crypto.randomUUID()
        const planId = crypto.randomUUID()
        const executionId = crypto.randomUUID()
        const value: PlannedExecution = {
          plan: { id: planId, title: input.objective.slice(0, 100), objective: input.objective, steps: [{ id: stepId, title: 'Executar objetivo', description: input.objective, status: 'PENDING', risk: 'LOW', requiresApproval: false, effects: [] }], createdAt: now, updatedAt: now },
          execution: { id: executionId, planId, mode: input.mode, state: 'PLAN', permissionProfile: 'ASSISTED', workspaceRoot: '/workspace', activeStepId: stepId, threadId: null, approvalIds: [], completedEffectIds: [], createdAt: now, updatedAt: now }
        }
        plans.set(executionId, value)
        executionEvents.set(executionId, [{ id: crypto.randomUUID(), at: now, state: 'PLAN', category: 'STATE', title: 'Plano criado na edição Web.', severity: 'INFO' }])
        return success(value)
      },
      update: async (input) => {
        const current = plans.get(input.executionId)
        if (current === undefined) return appError('PLAN_NOT_FOUND', 'Plano Web não encontrado.')
        const normalizedPlan = { ...input.plan, steps: input.plan.steps.map((step) => ({ ...step, effects: step.effects ?? [] })) }
        current.plan = normalizedPlan
        plans.set(input.executionId, current)
        return success(normalizedPlan)
      },
      read: async (input) => {
        const value = plans.get(input.executionId)
        return value === undefined ? appError('PLAN_NOT_FOUND', 'Execução Web não encontrada.') : success(value)
      },
      decide: async (input) => success({ id: crypto.randomUUID(), executionId: input.executionId, stepId: input.stepId, action: 'web approval', target: '/workspace', risk: 'LOW', effectsHash: '0'.repeat(64), scope: input.scope, decision: input.decision, decidedAt: new Date().toISOString() }),
      start: async (input) => {
        const current = plans.get(input.executionId)
        if (current === undefined) return appError('PLAN_NOT_FOUND', 'Execução Web não encontrada.')
        current.execution = { ...current.execution, state: 'EXECUTION', updatedAt: new Date().toISOString() }
        plans.set(input.executionId, current)
        executionEvents.get(input.executionId)?.push({ id: crypto.randomUUID(), at: new Date().toISOString(), state: 'EXECUTION', category: 'STATE', title: 'Execução iniciada.', severity: 'INFO' })
        return success(current.execution)
      },
      events: async (input) => success(executionEvents.get(input.executionId) ?? []),
      applyWorkspaceWrite: async (input) => {
        const write = await rpc<FileDocument>('workspace.write', { relativePath: input.relativePath, content: input.content, expectedHash: input.expectedHash })
        return write.ok ? success({ effectId: input.effectId, relativePath: write.value.relativePath, hash: write.value.hash, modifiedAt: write.value.modifiedAt }) : write
      },
      applyProposedWorkspaceWrite: async () => appError('PROPOSAL_REQUIRED', 'A proposta precisa existir no runtime Web antes da materialização.')
    },
    research: {
      search: (input) => rpc('research.search', input),
      collect: (input) => rpc('research.collect', input),
      resolve: (input) => rpc('research.resolve', input)
    },
    prompt: {
      save: async (input) => {
        const existing = getPrompts()
        const prior = existing.find((item) => item.name === input.name)
        const now = new Date().toISOString()
        const template: PromptTemplate = { id: prior?.id ?? crypto.randomUUID(), name: input.name, version: (prior?.version ?? 0) + 1, content: input.content, variables: input.variables ?? [], createdAt: prior?.createdAt ?? now, updatedAt: now }
        putPrompts([...existing.filter((item) => item.id !== template.id), template])
        return success(template)
      },
      list: async () => success(getPrompts()),
      compile: async (input) => {
        const template = getPrompts().find((item) => item.id === input.templateId)
        if (template === undefined) return appError('PROMPT_NOT_FOUND', 'Template não encontrado.')
        let content = template.content
        for (const variable of template.variables) content = content.replaceAll(`{{${variable.name}}}`, input.values[variable.name] ?? variable.defaultValue ?? '')
        const lint: PromptLintIssue[] = []
        return success({ templateId: template.id, version: template.version, content, hash: await sha256(content), compiledAt: new Date().toISOString(), lint })
      },
      compare: async (input) => {
        const items = getPrompts(); const left = items.find((item) => item.id === input.leftId); const right = items.find((item) => item.id === input.rightId)
        if (left === undefined || right === undefined) return appError('PROMPT_NOT_FOUND', 'Template para comparação não encontrado.')
        const leftLines = new Set(left.content.split('\n')); const rightLines = new Set(right.content.split('\n'))
        return success({ left, right, added: [...rightLines].filter((line) => !leftLines.has(line)), removed: [...leftLines].filter((line) => !rightLines.has(line)) })
      },
      lint: async (input) => {
        const issues: PromptLintIssue[] = []
        if (input.content.length < 30) issues.push({ severity: 'WARNING', code: 'SHORT_PROMPT', message: 'Prompt muito curto; detalhe objetivo, contexto e critérios.' })
        if (!/objetiv|goal|missão/i.test(input.content)) issues.push({ severity: 'INFO', code: 'NO_EXPLICIT_OBJECTIVE', message: 'Considere declarar um objetivo explícito.' })
        return success(issues)
      },
      export: async (input) => {
        const template = getPrompts().find((item) => item.id === input.templateId)
        return template === undefined ? appError('PROMPT_NOT_FOUND', 'Template não encontrado.') : success(JSON.stringify(template, null, 2))
      }
    },
    visual: {
      statuses: async () => success(visualStatuses),
      add: async (input) => {
        const asset: VisualAsset = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        putVisualAssets([...getVisualAssets(), asset])
        return success(asset)
      },
      list: async () => success(getVisualAssets()),
      use: async (input) => {
        const asset = getVisualAssets().find((item) => item.id === input.assetId)
        return asset === undefined ? appError('VISUAL_ASSET_NOT_FOUND', 'Asset visual não encontrado.') : success(asset)
      },
      open: async (input) => {
        const provider = visualStatuses.find((item) => item.id === input.provider)
        if (provider === undefined) return appError('VISUAL_PROVIDER_NOT_FOUND', 'Provider visual não encontrado.')
        window.open(provider.url, '_blank', 'noopener,noreferrer')
        return success(undefined)
      }
    },
    settings: {
      get: async () => success(getProfile()),
      save: async (input) => { const profile = { ...input.profile, updatedAt: new Date().toISOString() }; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return success(profile) },
      export: async () => success(JSON.stringify(getProfile(), null, 2)),
      import: async (input) => {
        try { const profile = JSON.parse(input.serialized) as UIProfile; localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return success(profile) }
        catch { return appError('INVALID_PROFILE', 'Perfil importado não é JSON válido.') }
      }
    }
  }

  const loadouts = new Map<string, AgentLoadoutView[]>()
  const controlCenter: ControlCenterDesktopApi = {
    status: async () => success({ product: 'Tupiniquim Dev AI', sections: [{ id: 'web-runtime', label: 'Web Runtime' }, { id: 'models', label: 'Modelos' }, { id: 'toolbox', label: 'Toolbox' }], policy: { explicitProviderSelection: true, explicitModelSelection: true, automaticFallback: false, privilegedActionsDefaultDeny: true } }),
    inspectPortable: async () => success({ root: '/workspace', directories: { runtime: '/workspace/.tupiniquim-web/runtime', models: '/workspace/.tupiniquim-web/models', data: '/workspace/.tupiniquim-web/data', projects: '/workspace', cache: '/workspace/.tupiniquim-web/cache' }, runtimes: [{ id: 'cloudflare-sandbox', label: 'Cloudflare Sandbox', available: true, state: 'AVAILABLE' }, { id: 'workers-ai', label: 'Workers AI', available: true, state: 'AVAILABLE' }] }),
    runToolboxGate: async (input) => success({ gateId: input.gateId, state: 'NOT_AVAILABLE', evidence: 'Gate disponível na UI Web; execução automatizada será realizada no workspace Sandbox quando o comando correspondente estiver configurado.' }),
    listSkills: async () => success([{ id: 'tupiniquim-toolbox', name: 'Tupiniquim Toolbox', status: 'APPROVED_INTERNAL', enabled: true, runtimeExecutionAuthorized: false }]),
    setSkillEnabled: async (input) => success({ id: 'tupiniquim-toolbox', name: 'Tupiniquim Toolbox', status: 'APPROVED_INTERNAL', enabled: input.enabled, runtimeExecutionAuthorized: false }),
    listAgents: async () => success([{ id: 'workers-ai', name: 'Workers AI Web Agent', capabilities: ['chat', 'plan', 'research', 'workspace', 'terminal', 'git'], effects: ['workspace.write', 'terminal.command'] }]),
    listAgentLoadouts: async (input) => success(loadouts.get(input.projectId) ?? []),
    putAgentLoadout: async (input) => {
      const view: AgentLoadoutView = { projectId: input.projectId, agentId: input.agentId, provider: input.provider, model: input.model, skillIds: input.skillIds, permissionProfile: input.permissionProfile, runtimeExecutionAuthorized: false }
      const current = loadouts.get(input.projectId) ?? []
      loadouts.set(input.projectId, [...current.filter((item) => item.agentId !== input.agentId), view])
      return success(view)
    }
  }

  const googleTasks: GoogleTasksDesktopApi = {
    status: async () => success({ state: 'NOT_CONFIGURED', configured: false, authenticated: false, secureStorageAvailable: true, scope: 'https://www.googleapis.com/auth/tasks' }),
    connect: async () => appError('GOOGLE_TASKS_WEB_CONFIG_REQUIRED', 'Configure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no runtime Web para OAuth do Google Tasks.'),
    disconnect: async () => success({ state: 'NOT_CONFIGURED', configured: false, authenticated: false, secureStorageAvailable: true, scope: 'https://www.googleapis.com/auth/tasks' }),
    listTaskLists: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    createTaskList: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    listTasks: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    createTask: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    updateTask: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    completeTask: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.'),
    deleteTask: async () => appError('GOOGLE_TASKS_AUTH_REQUIRED', 'Conecte o Google Tasks primeiro.')
  }

  window.studio = studio
  window.controlCenter = controlCenter
  window.googleTasks = googleTasks
}

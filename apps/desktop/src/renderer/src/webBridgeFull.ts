import type {
  AIEvent,
  AIThreadHistory,
  AgentTurnReference,
  GoogleTask,
  GoogleTaskList,
  GoogleTasksConnectionStatus,
  PlannedExecution,
  PromptComparison,
  PromptLintIssue,
  PromptTemplate,
  Result,
  UIProfile,
  VisualAsset,
  WorkspaceWriteProposal
} from '@tupiniquim/contracts'

const WORKSPACE_KEY = 'tupiniquim.web.workspace-id'
const MODEL_KEY = 'tupiniquim.web.model'
const DEFAULT_MODEL = '@cf/zai-org/glm-4.7-flash'

interface RpcEnvelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string; retryable: boolean }
  events?: AIEvent[]
  proposals?: WorkspaceWriteProposal[]
}

const workspaceId = (): string => {
  const existing = localStorage.getItem(WORKSPACE_KEY)
  if (existing !== null && /^[a-zA-Z0-9_-]{8,96}$/.test(existing)) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(WORKSPACE_KEY, created)
  return created
}

const rpcEnvelope = async <T>(action: string, input?: unknown): Promise<RpcEnvelope<T>> => {
  try {
    const response = await fetch('/api/studio', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tupiniquim-workspace': workspaceId(),
        'x-tupiniquim-model': localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL
      },
      body: JSON.stringify(input === undefined ? { action } : { action, input })
    })
    return await response.json() as RpcEnvelope<T>
  } catch (cause) {
    return { ok: false, error: { code: 'WEB_TRANSPORT_ERROR', message: cause instanceof Error ? cause.message : 'Falha de transporte Web.', retryable: true } }
  }
}

const rpc = async <T>(action: string, input?: unknown): Promise<Result<T>> => {
  const envelope = await rpcEnvelope<T>(action, input)
  if (envelope.ok) return { ok: true, value: envelope.value as T }
  return { ok: false, error: envelope.error ?? { code: 'WEB_RUNTIME_ERROR', message: 'Falha no runtime Web.', retryable: true } }
}

const sleep = async (milliseconds: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const installWebFullOverrides = (): void => {
  const agentListeners = new Set<(event: AIEvent) => void>()
  const proposalListeners = new Set<(proposal: WorkspaceWriteProposal) => void>()

  const baseConfigure = window.studio.workspace.configure.bind(window.studio.workspace)
  window.studio.workspace.configure = async (input) => {
    const configured = await baseConfigure(input)
    if (!configured.ok) return configured
    const bootstrapped = await rpc<string>('full.workspace.bootstrap')
    return bootstrapped.ok ? bootstrapped : configured
  }

  window.studio.agent.session = () => rpc('full.agent.session')
  window.studio.agent.history = (input) => rpc<AIThreadHistory>('full.agent.history', input)
  window.studio.agent.lookupProposalStatus = (proposalId) => rpc('full.agent.proposal-status', { proposalId })
  window.studio.agent.onEvent = (listener) => {
    agentListeners.add(listener)
    return () => agentListeners.delete(listener)
  }
  window.studio.agent.onWorkspaceWriteProposal = (listener) => {
    proposalListeners.add(listener)
    return () => proposalListeners.delete(listener)
  }
  window.studio.agent.send = async (input): Promise<Result<AgentTurnReference>> => {
    const envelope = await rpcEnvelope<AgentTurnReference>('agent.send', input)
    if (!envelope.ok || envelope.value === undefined) {
      return { ok: false, error: envelope.error ?? { code: 'AGENT_SEND_FAILED', message: 'Falha ao enviar mensagem.', retryable: true } }
    }
    queueMicrotask(() => {
      for (const event of envelope.events ?? []) for (const listener of agentListeners) listener(event)
      for (const proposal of envelope.proposals ?? []) for (const listener of proposalListeners) listener(proposal)
    })
    return { ok: true, value: envelope.value }
  }

  window.studio.planning.create = (input) => rpc<PlannedExecution>('full.planning.create', input)
  window.studio.planning.update = (input) => rpc('full.planning.update', input)
  window.studio.planning.read = (input) => rpc<PlannedExecution>('full.planning.read', input)
  window.studio.planning.decide = (input) => rpc('full.planning.decide', input)
  window.studio.planning.start = (input) => rpc('full.planning.start', input)
  window.studio.planning.events = (input) => rpc('full.planning.events', input)
  window.studio.planning.applyProposedWorkspaceWrite = (input) => rpc('full.planning.apply-proposal', input)

  window.studio.prompt.save = (input) => rpc<PromptTemplate>('full.prompt.save', input)
  window.studio.prompt.list = () => rpc<PromptTemplate[]>('full.prompt.list')
  window.studio.prompt.compile = (input) => rpc('full.prompt.compile', input)
  window.studio.prompt.compare = (input) => rpc<PromptComparison>('full.prompt.compare', input)
  window.studio.prompt.lint = (input) => rpc<PromptLintIssue[]>('full.prompt.lint', input)
  window.studio.prompt.export = (input) => rpc<string>('full.prompt.export', input)

  window.studio.settings.get = () => rpc<UIProfile>('full.settings.get')
  window.studio.settings.save = (input) => rpc<UIProfile>('full.settings.save', input)
  window.studio.settings.export = () => rpc<string>('full.settings.export')
  window.studio.settings.import = (input) => rpc<UIProfile>('full.settings.import', input)

  window.studio.visual.add = (input) => rpc<VisualAsset>('full.visual.add', input)
  window.studio.visual.list = () => rpc<VisualAsset[]>('full.visual.list')
  window.studio.visual.use = (input) => rpc<VisualAsset>('full.visual.use', input)

  window.controlCenter.runToolboxGate = (input) => rpc('full.control.gate', input)
  window.controlCenter.listSkills = (input) => rpc('full.control.skills', input)
  window.controlCenter.setSkillEnabled = (input) => rpc('full.control.skill-set', input)
  window.controlCenter.listAgentLoadouts = (input) => rpc('full.control.loadouts', input)
  window.controlCenter.putAgentLoadout = (input) => rpc('full.control.loadout-put', input)

  window.googleTasks.status = () => rpc<GoogleTasksConnectionStatus>('google-tasks.status')
  window.googleTasks.connect = async (): Promise<Result<GoogleTasksConnectionStatus>> => {
    const started = await rpcEnvelope<{ status: GoogleTasksConnectionStatus; authUrl: string }>('google-tasks.connect')
    if (!started.ok || started.value === undefined) return { ok: false, error: started.error ?? { code: 'GOOGLE_TASKS_CONNECT_FAILED', message: 'Falha ao iniciar OAuth do Google Tasks.', retryable: true } }
    const popup = window.open(started.value.authUrl, 'tupiniquim-google-tasks', 'popup,width=560,height=720')
    if (popup === null) return { ok: false, error: { code: 'POPUP_BLOCKED', message: 'Permita pop-ups para conectar o Google Tasks.', retryable: true } }
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await sleep(1000)
      const status = await rpc<GoogleTasksConnectionStatus>('google-tasks.status')
      if (status.ok && status.value.authenticated) return status
      if (popup.closed && attempt > 2) break
    }
    return rpc<GoogleTasksConnectionStatus>('google-tasks.status')
  }
  window.googleTasks.disconnect = () => rpc<GoogleTasksConnectionStatus>('google-tasks.disconnect')
  window.googleTasks.listTaskLists = (input) => rpc<GoogleTaskList[]>('google-tasks.task-lists', input)
  window.googleTasks.createTaskList = (input) => rpc<GoogleTaskList>('google-tasks.task-list.create', input)
  window.googleTasks.listTasks = (input) => rpc<GoogleTask[]>('google-tasks.tasks', input)
  window.googleTasks.createTask = (input) => rpc<GoogleTask>('google-tasks.task.create', input)
  window.googleTasks.updateTask = (input) => rpc<GoogleTask>('google-tasks.task.update', input)
  window.googleTasks.completeTask = (input) => rpc<GoogleTask>('google-tasks.task.complete', input)
  window.googleTasks.deleteTask = async (input): Promise<Result<void>> => {
    const result = await rpc<null>('google-tasks.task.delete', input)
    return result.ok ? { ok: true, value: undefined } : result
  }
}

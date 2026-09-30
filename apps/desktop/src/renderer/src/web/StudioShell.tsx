import { Activity, Bot, Boxes, Braces, CheckCircle2, ChevronsUpDown, Code2, FolderTree, GitBranch, LayoutPanelLeft, Save, Settings2, ShieldCheck, Sparkles, TerminalSquare, X } from 'lucide-react'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { AIProviderKind, AIStatus, FileDocument, FileEntry, GitStatus, LocalModel, Mode, PlannedExecution, ProposalStatus, SystemInfo, WorkspaceWriteProposal } from '@tupiniquim/contracts'
import { evaluateSend, handleAgentEvent, providerDisplayName, providerLabel, providerTurnBlockReason, providerUsesSelectableModel } from '../agentGating'
import type { ConversationMessage } from '../agentGating'
import { ControlCenter } from '../components/ControlCenter'
import { FileTree } from '../components/FileTree'
import { GitReviewPane } from '../components/GitReviewPane'
import { ProposalProvenance } from '../components/ProposalProvenance'
import { ThemeToggle } from '../components/ThemeToggle'
import { GoogleTasksDock } from '../GoogleTasksDock'
import {
  RUNTIME_LOCK_MESSAGE,
  WEB_ONBOARDING_KEY,
  executionRuntimeView,
  parseOnboardingPreferences,
  studioSuggestions,
  type ExecutionRuntimeView,
  type WebRoute
} from './experience'

const CodeEditor = lazy(async () => import('./CodeEditor'))
const TerminalPaneLazy = lazy(async () => {
  const [module] = await Promise.all([import('../components/TerminalPane'), import('@xterm/xterm/css/xterm.css')])
  return { default: module.TerminalPane }
})

const modes: Array<{ mode: Mode; label: string }> = [
  { mode: 'CHAT', label: 'Chat' }, { mode: 'PLAN', label: 'Plan' }, { mode: 'RESEARCH', label: 'Research' }, { mode: 'EXECUTE', label: 'Execute' },
  { mode: 'REVIEW', label: 'Review' }, { mode: 'DEBUG', label: 'Debug' }, { mode: 'PROMPT', label: 'Prompt' }, { mode: 'VISUAL', label: 'Visual' }
]

type StudioTool = 'files' | 'terminal' | 'git' | 'activity'

interface HealthPayload {
  executionRuntime?: { state?: string }
}

interface StudioShellProps {
  onNavigate: (route: WebRoute) => void
}

const basename = (path: string): string => path.split('/').at(-1) ?? path

/**
 * Studio Web chat-first.
 * Referência de UX: TailGrids AI Chat (21st.dev/@tailgrids) — conversa no
 * centro, composer claro, ferramentas técnicas em drawers sob demanda
 * (progressive disclosure). Toda a lógica de guarda fail-closed vem de
 * ../agentGating.ts (Issue #25) — nenhuma regra foi relaxada nesta superfície.
 */
export const StudioShell = ({ onNavigate }: StudioShellProps): React.JSX.Element => {
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [document, setDocument] = useState<FileDocument | null>(null)
  const [content, setContent] = useState('')
  const [git, setGit] = useState<GitStatus | null>(null)
  const [mode, setMode] = useState<Mode>('CHAT')
  const [notice, setNotice] = useState('Preparando o Studio…')
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [selectedLocalModel, setSelectedLocalModel] = useState('')
  const [agentInput, setAgentInput] = useState('')
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [planned, setPlanned] = useState<PlannedExecution | null>(null)
  const [proposal, setProposal] = useState<WorkspaceWriteProposal | null>(null)
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus | null>(null)
  const [expiredProposals, setExpiredProposals] = useState<Array<{ proposal: WorkspaceWriteProposal; status: ProposalStatus }>>([])
  const [runtime, setRuntime] = useState<ExecutionRuntimeView>(executionRuntimeView(null))
  const [tool, setTool] = useState<StudioTool | null>(null)
  const [showControlCenter, setShowControlCenter] = useState(false)
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading')
  const providerRef = useRef<AIProviderKind | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const dirty = document !== null && content !== document.content
  const preferences = useMemo(() => parseOnboardingPreferences(localStorage.getItem(WEB_ONBOARDING_KEY)), [])
  const suggestions = useMemo(() => studioSuggestions(preferences), [preferences])

  useEffect(() => {
    providerRef.current = aiStatus?.provider ?? null
  }, [aiStatus?.provider])

  const refreshRuntime = async (): Promise<void> => {
    try {
      const response = await fetch('/api/health')
      const body = await response.json() as HealthPayload
      setRuntime(executionRuntimeView(body.executionRuntime?.state))
    } catch {
      setRuntime(executionRuntimeView('OFFLINE'))
    }
  }

  const loadSession = async (): Promise<void> => {
    const session = await window.studio.agent.session()
    if (session.ok) {
      setSessionId(session.value?.session.id ?? null)
      setConversation((session.value?.turns ?? []).flatMap((turn) => {
        if (turn.role !== 'user' && turn.role !== 'assistant' && turn.role !== 'error') return []
        return [{ id: turn.id, role: turn.role, text: turn.text, turnId: turn.turnId, complete: true, provider: turn.provider }]
      }))
    }
  }

  const syncWorkspace = async (): Promise<void> => {
    const [tree, status] = await Promise.all([
      window.studio.workspace.list({ relativePath: '', depth: 4 }),
      window.studio.git.status()
    ])
    if (tree.ok) setFiles(tree.value)
    if (status.ok) setGit(status.value)
  }

  useEffect(() => {
    // Bootstrap Web: o workspace lógico canônico `/workspace` é preparado
    // automaticamente (mesma sequência certificada do Web Product Smoke:
    // pick → configure → session recovery → tree/git/status).
    const bootstrap = async (): Promise<void> => {
      const info = await window.studio.system.info()
      if (info.ok) setSystem(info.value)
      const selected = await window.studio.workspace.pick()
      if (!selected.ok || selected.value === null) {
        setNotice(selected.ok ? 'Workspace Web não identificado.' : selected.error.message)
        setBootState('error')
        return
      }
      const configured = await window.studio.workspace.configure({ root: selected.value })
      if (!configured.ok) {
        setNotice(configured.error.message)
        setBootState('error')
        return
      }
      setWorkspaceRoot(configured.value)
      await loadSession()
      const agentStatus = await window.studio.agent.status()
      if (agentStatus.ok) {
        setAIStatus(agentStatus.value)
        setSelectedLocalModel(agentStatus.value.selectedModel ?? '')
        if (agentStatus.value.state === 'DISCONNECTED') {
          const reconnected = await window.studio.agent.selectProvider({ provider: agentStatus.value.provider })
          if (reconnected.ok) setAIStatus(reconnected.value)
        }
        if (providerUsesSelectableModel(agentStatus.value.provider)) {
          const models = await window.studio.agent.listLocalModels()
          if (models.ok) setLocalModels(models.value)
          const refreshed = await window.studio.agent.status()
          if (refreshed.ok) { setAIStatus(refreshed.value); setSelectedLocalModel(refreshed.value.selectedModel ?? '') }
        }
      }
      void syncWorkspace()
      setBootState('ready')
      setNotice('Workspace Web preparado.')
    }
    void bootstrap()
    const runtimeKickoff = window.setTimeout(() => { void refreshRuntime() }, 0)
    const runtimeTimer = window.setInterval(() => { void refreshRuntime() }, 60_000)
    const removeAgentListener = window.studio.agent.onEvent((event) => handleAgentEvent(event, setAIStatus, setConversation, setSending, () => providerRef.current))
    const removeProposalListener = window.studio.agent.onWorkspaceWriteProposal((incoming) => {
      setProposal((current) => {
        if (current !== null && current.executionId === incoming.executionId && current.stepId === incoming.stepId && current.id !== incoming.id) {
          void window.studio.agent.lookupProposalStatus(current.id).then((result) => {
            const status: ProposalStatus = result.ok ? result.value : 'EXPIRED'
            setExpiredProposals((prev) => [...prev, { proposal: current, status }])
          })
        }
        return incoming
      })
      setProposalStatus('PENDING_REVIEW')
      setConversation((current) => [...current, { id: incoming.id, role: 'assistant', text: `PROPOSTA DISPONÍVEL PARA REVISÃO\n${incoming.effect.operation} ${incoming.effect.target}\nHash ${incoming.effect.payloadHash.slice(0, 12)}…`, turnId: incoming.turnId, complete: true, provider: incoming.provider }])
      void window.studio.planning.read({ executionId: incoming.executionId }).then((result) => { if (result.ok) setPlanned(result.value) })
    })
    return () => {
      window.clearTimeout(runtimeKickoff)
      window.clearInterval(runtimeTimer)
      removeAgentListener()
      removeProposalListener()
    }
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' })
  }, [conversation.length, sending])

  const pushErrorConversation = (text: string): void => {
    setConversation((current) => {
      const last = current.at(-1)
      if (last !== undefined && last.role === 'error' && last.text === text) return current
      return [...current, { id: crypto.randomUUID(), role: 'error', text, turnId: null, complete: true, provider: aiStatus?.provider ?? null }]
    })
  }

  const sendToAgent = async (): Promise<void> => {
    const message = agentInput.trim()
    // Issue #25 — guarda fail-closed do composer (regra central evaluateSend,
    // consciente do modo): executa ANTES de adicionar a mensagem do usuário,
    // limpar o textarea, setar sending=true ou chamar agent.send().
    const decision = evaluateSend({ status: aiStatus, hasWorkspace: workspaceRoot !== null, message, isSending: sending, selectedModel: selectedLocalModel, mode })
    if (!decision.allowed) {
      if (decision.blockReason !== null) pushErrorConversation(decision.blockReason)
      return
    }
    setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: message, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
    setAgentInput('')
    setSending(true)
    if (mode === 'VISUAL') {
      const result = await window.studio.visual.statuses()
      if (result.ok) {
        const providers = result.value.map((provider) => `• ${provider.label}: ${provider.state}\n  ${provider.detail}`).join('\n')
        setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `VISUAL LAB\nSolicitação: ${message}\n\nPROVEDORES\n${providers}\n\nAssets só podem entrar no produto com origem, direitos e licença conhecida.`, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: result.error.message, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      setSending(false)
      return
    }
    if (mode === 'PROMPT') {
      const variableNames = [...new Set([...message.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/gu)].map((match) => match[1]).filter((name): name is string => name !== undefined))]
      const [saved, linted] = await Promise.all([
        window.studio.prompt.save({ name: message.split(/\r?\n/u)[0]?.slice(0, 80) ?? 'Novo template', content: message, variables: variableNames.map((name) => ({ name, description: `Variável ${name}`, required: true })) }),
        window.studio.prompt.lint({ content: message })
      ])
      if (saved.ok && linted.ok) {
        const report = linted.value.length === 0 ? 'Nenhum problema de lint.' : linted.value.map((issue) => `• ${issue.severity} ${issue.code}: ${issue.message}`).join('\n')
        setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `TEMPLATE VERSIONADO\n${saved.value.name} · v${saved.value.version}\n${variableNames.length} variável(is)\n\n${report}`, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: !saved.ok ? saved.error.message : !linted.ok ? linted.error.message : 'Falha no Prompt Architect.', turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      setSending(false)
      return
    }
    if (mode === 'RESEARCH') {
      const [searchResult, resolutionResult] = await Promise.all([
        window.studio.research.search({ query: message, maxResults: 6 }),
        window.studio.research.resolve({ requirements: message, platforms: ['WEB', 'DESKTOP', 'MOBILE'], availableTools: ['node', 'pnpm', 'electron', 'git'] })
      ])
      const sections: string[] = []
      if (resolutionResult.ok) sections.push(`TECHNOLOGY RESOLUTION\n${resolutionResult.value.knowledgePack.summary}\n${resolutionResult.value.recommendations.map((candidate) => `• ${candidate.name}: ${candidate.score}/100`).join('\n')}`)
      if (searchResult.ok) sections.push(`EVIDÊNCIAS EXTERNAS — NÃO CONFIÁVEIS\n${searchResult.value.sources.map((source) => `• ${source.title}\n  ${source.url}`).join('\n') || 'Nenhum resultado retornado pelo provedor HTTP.'}`)
      if (!searchResult.ok) sections.push(`PESQUISA INDISPONÍVEL\n${searchResult.error.message}`)
      if (!resolutionResult.ok) sections.push(`RESOLUÇÃO INDISPONÍVEL\n${resolutionResult.error.message}`)
      setConversation((current) => [...current, { id: crypto.randomUUID(), role: sections.length > 0 ? 'assistant' : 'error', text: sections.join('\n\n'), turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      setSending(false)
      return
    }
    if (mode === 'PLAN') {
      const planResult = await window.studio.planning.create({ objective: message, mode })
      if (planResult.ok) {
        setPlanned(planResult.value)
        setProposal(null)
        setProposalStatus(null)
        const targetStep = planResult.value.plan.steps.find((step) => step.requiresApproval)
        if (targetStep === undefined) {
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: 'O plano não possui um passo mutável compatível com workspace.write.', turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
          setSending(false)
          return
        }
        if (aiStatus?.provider !== 'ollama') {
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: 'Plano persistido, mas o provider atual permanece read-only. Selecione Ollama local com um modelo compatível para gerar a proposta sem habilitar APIs experimentais.', turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
          setSending(false)
          return
        }
        // Issue #25 — guarda provider-turn imediatamente ANTES do único
        // agent.send deste caminho (PLANO já foi persistido).
        const planTurnBlock = providerTurnBlockReason(aiStatus, selectedLocalModel)
        if (planTurnBlock !== null) {
          pushErrorConversation(planTurnBlock)
          setSending(false)
          return
        }
        const turn = await window.studio.agent.send({
          message,
          mode,
          proposalContext: { executionId: planResult.value.execution.id, stepId: targetStep.id }
        })
        if (!turn.ok) {
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: turn.error.message, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
          setSending(false)
        }
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: planResult.error.message, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      if (!planResult.ok) setSending(false)
      return
    }
    // Issue #25 — guarda provider-turn imediatamente ANTES do agent.send dos
    // modos que enviam ao agente (CHAT/EXECUTE/REVIEW/DEBUG).
    const turnBlock = providerTurnBlockReason(aiStatus, selectedLocalModel)
    if (turnBlock !== null) {
      pushErrorConversation(turnBlock)
      setSending(false)
      return
    }
    const threadId = aiStatus?.activeThreadId
    const result = await window.studio.agent.send({ message, mode, ...(threadId !== null && threadId !== undefined ? { threadId } : {}) })
    if (!result.ok) {
      setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: result.error.message, turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      setSending(false)
    }
  }

  const interruptAgent = async (): Promise<void> => {
    if (aiStatus?.activeThreadId === null || aiStatus?.activeThreadId === undefined || aiStatus.activeTurnId === null) return
    const result = await window.studio.agent.interrupt({ threadId: aiStatus.activeThreadId, turnId: aiStatus.activeTurnId })
    if (!result.ok) setNotice(result.error.message)
  }

  const selectAgentProvider = async (provider: AIProviderKind): Promise<void> => {
    if (sending || aiStatus?.state === 'BUSY') return
    const result = await window.studio.agent.selectProvider({ provider })
    if (!result.ok) { setNotice(result.error.message); return }
    setAIStatus(result.value)
    if (proposal !== null) {
      const lookup = await window.studio.agent.lookupProposalStatus(proposal.id)
      setExpiredProposals((current) => [...current, { proposal, status: lookup.ok ? lookup.value : 'EXPIRED' }])
      setProposal(null)
      setProposalStatus('EXPIRED')
    }
    const session = await window.studio.agent.session()
    if (session.ok) setSessionId(session.value?.session.id ?? null)
    setSelectedLocalModel(result.value.selectedModel ?? '')
    if (!providerUsesSelectableModel(provider)) { setLocalModels([]); return }
    const models = await window.studio.agent.listLocalModels()
    if (models.ok) setLocalModels(models.value)
    else setNotice(models.error.message)
  }

  const selectProviderModel = async (model: string): Promise<void> => {
    if (model === '') return
    const result = await window.studio.agent.selectLocalModel({ model })
    if (result.ok) { setSelectedLocalModel(model); setAIStatus(result.value) }
    else setNotice(result.error.message)
  }

  const editPlanStep = (stepId: string, title: string): void => {
    setPlanned((current) => current === null ? null : { ...current, plan: { ...current.plan, steps: current.plan.steps.map((step) => step.id === stepId ? { ...step, title } : step) } })
  }

  const savePlan = async (): Promise<void> => {
    if (planned === null) return
    const result = await window.studio.planning.update({ executionId: planned.execution.id, plan: planned.plan })
    if (result.ok) { setPlanned({ ...planned, plan: result.value }); setNotice('Plano atualizado e persistido.') }
    else setNotice(result.error.message)
  }

  const decidePlanStep = async (stepId: string, decision: 'APPROVED' | 'DENIED'): Promise<void> => {
    if (planned === null) return
    const currentStep = planned.plan.steps.find((step) => step.id === stepId)
    const matchesProposal = proposal !== null
      && proposal.executionId === planned.execution.id
      && proposal.stepId === stepId
      && currentStep?.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id) === true
    if (!matchesProposal || proposalStatus !== 'PENDING_REVIEW') {
      setNotice('A proposta pública não corresponde ao manifesto atualmente exibido para revisão.')
      return
    }
    const result = await window.studio.planning.decide({ executionId: planned.execution.id, stepId, decision, scope: 'TASK' })
    if (!result.ok) { setNotice(result.error.message); return }
    const refreshed = await window.studio.planning.read({ executionId: planned.execution.id })
    if (refreshed.ok) setPlanned(refreshed.value)
    if (proposal?.stepId === stepId) setProposalStatus(decision === 'APPROVED' ? 'APPROVED' : 'DENIED')
    setNotice(decision === 'APPROVED' ? 'Efeito aprovado para esta tarefa.' : 'Efeito negado; a execução foi bloqueada.')
  }

  const startPlannedExecution = async (): Promise<void> => {
    if (planned === null) return
    const result = await window.studio.planning.start({ executionId: planned.execution.id })
    if (result.ok) {
      setPlanned({ ...planned, execution: result.value })
      const events = await window.studio.planning.events({ executionId: planned.execution.id })
      if (events.ok) {
        const evidence = events.value.filter((event) => event.category === 'TOOL' || event.category === 'GIT').slice(-2)
        if (evidence.length > 0) setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'EXECUÇÃO AUTORIZADA\n' + evidence.map((event) => event.title + ': ' + (event.detail ?? '')).join('\n'), turnId: null, complete: true, provider: aiStatus?.provider ?? null }])
      }
      if (proposal !== null && proposal.executionId === planned.execution.id && proposalStatus === 'APPROVED') {
        const applied = await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: proposal.id })
        if (applied.ok) {
          setProposalStatus('MATERIALIZED')
          await syncWorkspace()
          setNotice(`Proposta materializada atomicamente: ${applied.value.relativePath}`)
        } else {
          setProposalStatus('FAILED')
          setNotice(applied.error.message)
        }
      } else setNotice('Execução autorizada; baseline real de workspace e Git registrado.')
    }
    else setNotice(result.error.message)
  }

  const openFile = async (relativePath: string): Promise<void> => {
    if (dirty && !window.confirm('Há alterações não salvas. Descartar e abrir outro arquivo?')) return
    const result = await window.studio.workspace.read({ relativePath })
    if (result.ok) { setDocument(result.value); setContent(result.value.content); setNotice(`Aberto: ${relativePath}`) }
    else setNotice(result.error.message)
  }

  const saveFile = async (): Promise<void> => {
    if (document === null) return
    const result = await window.studio.workspace.write({ relativePath: document.relativePath, content, expectedHash: document.hash })
    if (result.ok) { setDocument(result.value); setContent(result.value.content); setNotice('Arquivo salvo atomicamente.') }
    else setNotice(result.error.message)
  }

  const openTool = (next: StudioTool): void => {
    setTool((current) => current === next ? null : next)
    void refreshRuntime()
    if (next === 'files') void syncWorkspace()
    if (next === 'git') void syncWorkspace()
  }

  const applySuggestion = (prompt: string, suggestionMode: Mode): void => {
    setMode(suggestionMode)
    setAgentInput(prompt)
    composerRef.current?.focus()
  }

  const workspaceName = useMemo(() => workspaceRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Nenhum projeto', [workspaceRoot])
  const sendDecision = evaluateSend({ status: aiStatus, hasWorkspace: workspaceRoot !== null, message: agentInput, isSending: sending, selectedModel: selectedLocalModel, mode })
  const availabilityCaption = aiStatus === null
    ? 'Aguardando estado do provider…'
    : aiStatus.provider === 'ollama'
      ? (selectedLocalModel === '' ? 'Selecione um modelo local' : 'Ollama somente loopback')
      : aiStatus.provider === 'cloudflare-workers-ai'
        ? (selectedLocalModel === '' ? 'Selecione um modelo Workers AI' : `Workers AI · ${selectedLocalModel}`)
        : aiStatus.state === 'AUTH_REQUIRED'
          ? 'Codex requer autenticação no runtime isolado'
          : aiStatus.state !== 'READY'
            ? `Codex indisponível (estado ${aiStatus.state})`
            : 'Enter para enviar'
  const availableProviders: AIProviderKind[] = aiStatus?.availableProviders ?? ((system?.platform === 'cloudflare-edge' || system?.platform === 'cloudflare-sandbox')
    ? ['cloudflare-workers-ai']
    : ['codex-app-server', 'ollama'])
  const missingEffectManifest = planned?.plan.steps.some((step) => step.requiresApproval && step.effects.length === 0) ?? false
  const proposalMatchesManifest = proposal !== null && planned !== null
    && proposal.executionId === planned.execution.id
    && planned.plan.steps.some((step) => step.id === proposal.stepId && step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id))
  const proposalReady = proposalMatchesManifest && proposalStatus === 'APPROVED'
  const conversationEmpty = conversation.length === 0 && planned === null && proposal === null

  return (
    <div className="web-studio">
      <header className="ws-topbar">
        <div className="brand"><span className="ws-brand-mark" aria-hidden="true"><Braces size={16} /></span><strong>Tupiniquim</strong><span className="ws-brand-sub">DEV AI STUDIO</span></div>
        <button className="project-switcher" title="Workspace lógico da sessão Web" onClick={() => { void syncWorkspace() }}><Boxes size={14} aria-hidden="true" /><span>{workspaceName}</span><ChevronsUpDown size={12} aria-hidden="true" /></button>
        <span className={`ws-runtime-chip tone-${runtime.tone}`} title={runtime.detail}>{runtime.label}</span>
        <div className="ws-top-controls">
          <label className="ws-select">Provider
            <select aria-label="Provedor de IA" value={aiStatus?.provider ?? availableProviders[0] ?? 'cloudflare-workers-ai'} disabled={sending || aiStatus?.state === 'BUSY'} onChange={(event) => void selectAgentProvider(event.target.value as AIProviderKind)}>
              {availableProviders.map((provider) => <option key={provider} value={provider}>{providerDisplayName(provider)}</option>)}
            </select>
          </label>
          {providerUsesSelectableModel(aiStatus?.provider) && (
            <label className="ws-select">Model
              <select aria-label="Modelo de IA" value={selectedLocalModel} disabled={localModels.length === 0 || aiStatus?.state !== 'READY'} onChange={(event) => void selectProviderModel(event.target.value)}>
                <option value="">Selecionar modelo</option>
                {localModels.map((model) => <option key={model.model} value={model.model}>{model.displayName ?? model.name}</option>)}
              </select>
            </label>
          )}
          <nav className="ws-tools" aria-label="Ferramentas de engenharia">
            <button className={tool === 'files' ? 'active' : ''} title="Arquivos do workspace" aria-pressed={tool === 'files'} onClick={() => openTool('files')}><FolderTree size={15} aria-hidden="true" /><span>Arquivos</span></button>
            <button className={tool === 'terminal' ? 'active' : ''} title="Terminal (Runtime Local)" aria-pressed={tool === 'terminal'} onClick={() => openTool('terminal')}><TerminalSquare size={15} aria-hidden="true" /><span>Terminal</span></button>
            <button className={tool === 'git' ? 'active' : ''} title="Revisão Git" aria-pressed={tool === 'git'} onClick={() => openTool('git')}><GitBranch size={15} aria-hidden="true" /><span>Git</span></button>
            <button className={tool === 'activity' ? 'active' : ''} title="Atividade da sessão" aria-pressed={tool === 'activity'} onClick={() => openTool('activity')}><Activity size={15} aria-hidden="true" /><span>Atividade</span></button>
          </nav>
          <ThemeToggle />
          <button className="ws-icon-btn" title="Control Center" onClick={() => setShowControlCenter(true)}><ShieldCheck size={16} aria-hidden="true" /></button>
          <button className="ws-icon-btn" title="Workbench completo (editor, explorer e deck)" onClick={() => onNavigate('workbench')}><LayoutPanelLeft size={16} aria-hidden="true" /></button>
          <button className="ws-icon-btn" title="Refazer onboarding" onClick={() => onNavigate('onboarding')}><Settings2 size={16} aria-hidden="true" /></button>
        </div>
      </header>

      <main className="ws-main">
        <section className="ws-thread" aria-label="Conversa com o agente">
          {bootState === 'loading' && (
            <div className="ws-empty" role="status"><span className="wx-spinner" aria-hidden="true" /><p>Preparando workspace e recuperando a sessão…</p></div>
          )}
          {bootState === 'error' && (
            <div className="ws-empty error"><Bot size={22} aria-hidden="true" /><h1>Não foi possível preparar o Studio.</h1><p>{notice}</p><button className="ld-btn primary" onClick={() => window.location.reload()}>Tentar novamente</button></div>
          )}
          {bootState === 'ready' && conversationEmpty && (
            <div className="ws-empty">
              <div className="ws-empty-orb" aria-hidden="true"><Sparkles size={20} /></div>
              <h1>Em que vamos trabalhar?</h1>
              <p>Comece pela conversa. Planos, arquivos, terminal e Git aparecem quando forem necessários.</p>
              <div className="ws-suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion.id} onClick={() => applySuggestion(suggestion.prompt, suggestion.mode)}>
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {bootState === 'ready' && !conversationEmpty && (
            <div className="ws-messages">
              <p className="ws-sysnote">{aiStatus?.provider === 'cloudflare-workers-ai' ? 'Workers AI executa a inferência na nuvem Cloudflare; apenas modelos compatíveis com esta edição Web aparecem na seleção.' : aiStatus?.provider === 'ollama' ? 'Ollama usa somente o loopback local; modelos são escolhidos explicitamente.' : 'Provider selecionado explicitamente — nenhum fallback automático.'}</p>
              {conversation.map((message) => (
                <div key={message.id} className={`agent-message ${message.role}`} data-provider={message.provider ?? ''}>
                  <span className="message-label">{message.role === 'user' ? 'VOCÊ' : message.role === 'error' ? 'ERRO' : providerLabel(message.provider)}</span>
                  <p>{message.text}{!message.complete && <span className="stream-caret">▋</span>}</p>
                </div>
              ))}
              {expiredProposals.map((item) => <ProposalProvenance key={item.proposal.id} proposal={item.proposal} status={item.status} expired />)}
              {proposal !== null && <ProposalProvenance proposal={proposal} status={proposalStatus ?? 'PENDING_REVIEW'} />}
              {planned !== null && (
                <div className="live-plan-card">
                  <header><div><CheckCircle2 size={15} aria-hidden="true" /><strong>{planned.plan.title}</strong></div><span>{planned.execution.state}</span></header>
                  <ol>{planned.plan.steps.map((step, index) => (
                    <li key={step.id}>
                      <span className="step-number">{index + 1}</span>
                      <div>
                        <input aria-label={`Título do passo ${index + 1}`} value={step.title} onChange={(event) => editPlanStep(step.id, event.target.value)} />
                        <small>{step.risk} · {step.requiresApproval ? step.effects.length === 0 ? 'manifesto de efeitos pendente' : String(step.effects.length) + ' efeito(s) para aprovação' : 'sem mutação'}</small>
                        {step.effects.map((effect) => <small key={effect.id} title={`${effect.capability} · ${effect.operation} · ${effect.target} · ${effect.payloadHash}`}>{effect.capability} · {effect.operation} · {effect.target} · hash {effect.payloadHash.slice(0, 12)}…</small>)}
                      </div>
                      {step.requiresApproval && <div className="approval-actions"><button disabled={step.effects.length === 0 || proposalStatus !== 'PENDING_REVIEW' || proposal?.executionId !== planned.execution.id || proposal.stepId !== step.id || !step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id)} onClick={() => void decidePlanStep(step.id, 'APPROVED')}>Aprovar</button><button className="deny" disabled={step.effects.length === 0 || proposalStatus !== 'PENDING_REVIEW' || proposal?.executionId !== planned.execution.id || proposal.stepId !== step.id || !step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id)} onClick={() => void decidePlanStep(step.id, 'DENIED')}>Negar</button></div>}
                    </li>
                  ))}</ol>
                  <footer><button onClick={() => void savePlan()}>Salvar plano</button><button className="primary" title={missingEffectManifest ? 'Aguardando manifesto de efeitos do runtime.' : !proposalReady ? 'A proposta precisa ser aprovada antes da execução.' : undefined} disabled={planned.execution.state === 'BLOCKED' || missingEffectManifest || !proposalReady} onClick={() => void startPlannedExecution()}>Iniciar execução</button></footer>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          )}
        </section>

        <section className="ws-composer-zone" aria-label="Composer">
          <div className="ws-mode-switch" role="group" aria-label="Modo do agente">
            {modes.map((item) => <button key={item.mode} className={mode === item.mode ? 'active' : ''} aria-pressed={mode === item.mode} onClick={() => setMode(item.mode)}>{item.label}</button>)}
          </div>
          <div className="ws-composer">
            <textarea
              ref={composerRef}
              aria-label="Mensagem ao agente"
              placeholder={workspaceRoot === null ? 'Preparando workspace…' : 'Descreva o que deseja construir…'}
              value={agentInput}
              rows={3}
              onChange={(event) => setAgentInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' && !event.shiftKey) || (event.ctrlKey && event.key === 'Enter')) {
                  event.preventDefault()
                  void sendToAgent()
                }
              }}
            />
            <div className="ws-composer-row">
              <span className="ws-availability">{availabilityCaption}</span>
              {aiStatus?.state === 'BUSY'
                ? <button className="ws-send" onClick={() => void interruptAgent()}>Interromper</button>
                : <button className="ws-send" disabled={!sendDecision.allowed} title={sendDecision.blockReason ?? undefined} onClick={() => void sendToAgent()}><Sparkles size={15} aria-hidden="true" />{sending ? 'Conectando…' : 'Enviar'}</button>}
            </div>
          </div>
          <p className="ws-composer-hint">Toda mutação de workspace passa por plano e aprovação explícita. Shift+Enter quebra linha.</p>
        </section>
      </main>

      {tool !== null && (
        <div className="ws-drawer-backdrop" onClick={() => setTool(null)}>
          <aside
            className={`ws-drawer${tool === 'terminal' ? ' wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={tool === 'files' ? 'Arquivos do workspace' : tool === 'terminal' ? 'Terminal' : tool === 'git' ? 'Revisão Git' : 'Atividade da sessão'}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === 'Escape') setTool(null) }}
          >
            <header className="ws-drawer-head">
              <strong>{tool === 'files' ? 'Arquivos' : tool === 'terminal' ? 'Terminal' : tool === 'git' ? 'Revisão Git' : 'Atividade'}</strong>
              <span className={`ws-runtime-chip tone-${runtime.tone}`}>{runtime.label}</span>
              <button className="ws-icon-btn" autoFocus title="Fechar painel" onClick={() => setTool(null)}><X size={16} aria-hidden="true" /></button>
            </header>
            {!runtime.osCapabilities && tool !== 'activity'
              ? (
                  <div className="ws-runtime-lock" role="status">
                    <TerminalSquare size={22} aria-hidden="true" />
                    <h2>{RUNTIME_LOCK_MESSAGE}</h2>
                    <p>O chat Cloud continua funcionando normalmente. Quando o gateway do Runtime Local reportar READY, Files, Git, terminal, build e testes são liberados progressivamente.</p>
                    <div className="ws-runtime-lock-actions">
                      <button className="ld-btn ghost" onClick={() => void refreshRuntime()}>Verificar novamente</button>
                      <button className="ld-btn primary" onClick={() => { setTool(null); setShowControlCenter(true) }}>Abrir Control Center</button>
                    </div>
                  </div>
                )
              : (
                  <div className="ws-drawer-body">
                    {tool === 'files' && (
                      <div className="ws-files">
                        <div className="ws-files-tree">
                          {files.length > 0
                            ? <FileTree entries={files} selected={document?.relativePath} onSelect={(path) => void openFile(path)} />
                            : <div className="ws-files-empty"><Code2 size={18} aria-hidden="true" /><p>Nenhum arquivo mapeado ainda.</p><button className="ld-btn ghost" onClick={() => void syncWorkspace()}>Atualizar</button></div>}
                        </div>
                        <div className="ws-files-editor">
                          {document !== null
                            ? (
                                <>
                                  <div className="ws-files-editor-head"><span>{dirty ? '● ' : ''}{basename(document.relativePath)}</span><button className="ws-icon-btn" disabled={!dirty} title="Salvar" onClick={() => void saveFile()}><Save size={15} aria-hidden="true" /></button><button className="ws-icon-btn" title="Fechar arquivo" onClick={() => { setDocument(null); setContent('') }}><X size={15} aria-hidden="true" /></button></div>
                                  <Suspense fallback={<div className="ws-panel-loading" role="status"><span className="wx-spinner" aria-hidden="true" /><p>Carregando editor…</p></div>}>
                                    <CodeEditor path={document.relativePath} value={content} onChange={setContent} />
                                  </Suspense>
                                </>
                              )
                            : <div className="ws-files-empty"><p>Selecione um arquivo para visualizar e editar.</p></div>}
                        </div>
                      </div>
                    )}
                    {tool === 'terminal' && (
                      <Suspense fallback={<div className="ws-panel-loading" role="status"><span className="wx-spinner" aria-hidden="true" /><p>Carregando terminal…</p></div>}>
                        <TerminalPaneLazy workspaceReady={workspaceRoot !== null} platform={system?.platform ?? null} />
                      </Suspense>
                    )}
                    {tool === 'git' && <GitReviewPane workspaceReady={workspaceRoot !== null} />}
                    {tool === 'activity' && <SessionActivity sessionId={sessionId} threadId={aiStatus?.activeThreadId ?? null} workspaceReady={workspaceRoot !== null} runtime={runtime} />}
                  </div>
                )}
          </aside>
        </div>
      )}

      <ControlCenter open={showControlCenter} onClose={() => setShowControlCenter(false)} workspaceRoot={workspaceRoot} aiStatus={aiStatus} localModels={localModels} selectedLocalModel={selectedLocalModel} onSelectProvider={selectAgentProvider} onSelectModel={selectProviderModel} onRefreshModels={async () => { const result = await window.studio.agent.listLocalModels(); if (result.ok) setLocalModels(result.value) }} />
      <GoogleTasksDock />

      <footer className="statusbar">
        <span><ShieldCheck size={13} aria-hidden="true" />Fail-closed</span>
        <span>{workspaceRoot === null ? 'Sem workspace' : workspaceRoot}</span>
        <span aria-label="Sessão Tupiniquim" data-session-id={sessionId ?? ''} title={sessionId ?? ''}>{sessionId === null ? 'Sessão nova' : `Sessão ${sessionId.slice(0, 8)}…`}</span>
        <span>{git?.branch ?? 'sem Git'}</span>
        <div className="spacer" />
        <span className="ws-notice">{notice}</span>
        <span>{runtime.label}</span>
        <span>{system?.platform ?? 'web'} · v{system?.version ?? '0.1.0'}</span>
      </footer>
    </div>
  )
}

const SessionActivity = ({ sessionId, threadId, workspaceReady, runtime }: { sessionId: string | null; threadId: string | null; workspaceReady: boolean; runtime: ExecutionRuntimeView }): React.JSX.Element => {
  const [turnCount, setTurnCount] = useState<number | null>(null)
  useEffect(() => {
    if (threadId === null) return
    let active = true
    void window.studio.agent.history({ threadId }).then((result) => { if (active && result.ok) setTurnCount(result.value.turns.length) })
    return () => { active = false }
  }, [threadId])
  return (
    <div className="ws-activity">
      <div className="ws-activity-item ok"><strong>Studio Web iniciado</strong><p>Superfície conversacional com guardas fail-closed ativas.</p></div>
      {workspaceReady && <div className="ws-activity-item ok"><strong>Workspace preparado</strong><p>Workspace lógico /workspace disponível para esta sessão.</p></div>}
      <div className="ws-activity-item"><strong>Sessão</strong><p>{sessionId ?? 'Nenhuma sessão persistida ainda.'}</p></div>
      <div className="ws-activity-item"><strong>Execução</strong><p>{runtime.label} — {runtime.detail}</p></div>
      {turnCount !== null && <div className="ws-activity-item"><strong>{turnCount} turns persistidos</strong><p>Histórico recuperável entre recargas da página.</p></div>}
    </div>
  )
}

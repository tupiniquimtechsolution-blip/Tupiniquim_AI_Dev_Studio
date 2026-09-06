import Editor from '@monaco-editor/react'
import { Bot, Boxes, Braces, CheckCircle2, ChevronsUpDown, Code2, Eye, FileSearch, GitBranch, History, LayoutDashboard, Palette, PanelBottom, Save, Search, Settings2, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AIEvent, AIProviderKind, AIStatus, AIThreadHistory, FileDocument, FileEntry, GitStatus, LocalModel, Mode, PlannedExecution, ProposalStatus, SystemInfo, UIProfile, WorkspaceContext, WorkspaceWriteProposal } from '@tupiniquim/contracts'
import { FileTree } from './components/FileTree'
import { TerminalPane } from './components/TerminalPane'

const modes: Array<{ mode: Mode; label: string }> = [
  { mode: 'CHAT', label: 'Chat' }, { mode: 'PLAN', label: 'Plan' }, { mode: 'RESEARCH', label: 'Research' }, { mode: 'EXECUTE', label: 'Execute' },
  { mode: 'REVIEW', label: 'Review' }, { mode: 'DEBUG', label: 'Debug' }, { mode: 'PROMPT', label: 'Prompt' }, { mode: 'VISUAL', label: 'Visual' }
]

const languageFor = (file?: string): string => {
  const extension = file?.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', md: 'markdown', css: 'css', html: 'html', py: 'python', rs: 'rust', kt: 'kotlin', swift: 'swift' } as Record<string, string>)[extension ?? ''] ?? 'plaintext'
}

const basename = (path: string): string => path.split('/').at(-1) ?? path

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  turnId: string | null
  complete: boolean
}

// ProposalStatus imported from @tupiniquim/contracts — includes EXPIRED

export const App = (): React.JSX.Element => {
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null)
  const [document, setDocument] = useState<FileDocument | null>(null)
  const [content, setContent] = useState('')
  const [git, setGit] = useState<GitStatus | null>(null)
  const [mode, setMode] = useState<Mode>('PLAN')
  const [deck, setDeck] = useState<'terminal' | 'tests' | 'review' | 'timeline'>('terminal')
  const [notice, setNotice] = useState('Abra um workspace para iniciar.')
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [selectedLocalModel, setSelectedLocalModel] = useState('')
  const [agentInput, setAgentInput] = useState('')
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [sending, setSending] = useState(false)
  const [planned, setPlanned] = useState<PlannedExecution | null>(null)
  const [proposal, setProposal] = useState<WorkspaceWriteProposal | null>(null)
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus | null>(null)
  const [expiredProposals, setExpiredProposals] = useState<Array<{ proposal: WorkspaceWriteProposal; status: ProposalStatus }>>([])
  const [profile, setProfile] = useState<UIProfile | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const profileRef = useRef<UIProfile | null>(null)
  const dirty = document !== null && content !== document.content

  useEffect(() => {
    void window.studio.system.info().then((result) => { if (result.ok) setSystem(result.value) })
    void window.studio.agent.status().then((result) => { if (result.ok) setAIStatus(result.value) })
    void window.studio.settings.get().then((result) => { if (result.ok) { profileRef.current = result.value; setProfile(result.value) } })
    const removeAgentListener = window.studio.agent.onEvent((event) => handleAgentEvent(event, setAIStatus, setConversation, setSending))
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
      setConversation((current) => [...current, { id: incoming.id, role: 'assistant', text: `PROPOSTA DISPONÍVEL PARA REVISÃO\n${incoming.effect.operation} ${incoming.effect.target}\nHash ${incoming.effect.payloadHash.slice(0, 12)}…`, turnId: incoming.turnId, complete: true }])
      void window.studio.planning.read({ executionId: incoming.executionId }).then((result) => { if (result.ok) setPlanned(result.value) })
    })
    return () => { removeAgentListener(); removeProposalListener() }
  }, [])

  const openWorkspace = async (): Promise<void> => {
    const selected = await window.studio.workspace.pick()
    if (!selected.ok || selected.value === null) return
    const configured = await window.studio.workspace.configure({ root: selected.value })
    if (!configured.ok) { setNotice(configured.error.message); return }
    setWorkspaceRoot(configured.value)
    setPlanned(null)
    setProposal(null)
    setProposalStatus(null)
    setExpiredProposals([])
    const [tree, status, context] = await Promise.all([
      window.studio.workspace.list({ relativePath: '', depth: 4 }),
      window.studio.git.status(),
      window.studio.workspace.context()
    ])
    if (tree.ok) setFiles(tree.value)
    if (status.ok) setGit(status.value)
    if (context.ok) setWorkspaceContext(context.value)
    setNotice(context.ok ? 'Workspace autorizado e contexto de metadados mapeado.' : 'Workspace autorizado e mapeado.')
  }

  const openFile = async (relativePath: string): Promise<void> => {
    if (dirty && !window.confirm('Há alterações não salvas. Descartar e abrir outro arquivo?')) return
    const result = await window.studio.workspace.read({ relativePath })
    if (result.ok) { setDocument(result.value); setContent(result.value.content); setNotice(`Aberto: ${relativePath}`) }
    else setNotice(result.error.message)
  }

  const save = async (): Promise<void> => {
    if (document === null) return
    const result = await window.studio.workspace.write({ relativePath: document.relativePath, content, expectedHash: document.hash })
    if (result.ok) { setDocument(result.value); setContent(result.value.content); setNotice('Arquivo salvo atomicamente.') }
    else setNotice(result.error.message)
  }

  const sendToAgent = async (): Promise<void> => {
    const message = agentInput.trim()
    if (message === '' || workspaceRoot === null || sending) return
    setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: message, turnId: null, complete: true }])
    setAgentInput('')
    setSending(true)
    if (mode === 'VISUAL') {
      const result = await window.studio.visual.statuses()
      if (result.ok) {
        const providers = result.value.map((provider) => `• ${provider.label}: ${provider.state}\n  ${provider.detail}`).join('\n')
        setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `VISUAL LAB\nSolicitação: ${message}\n\nPROVEDORES\n${providers}\n\nAssets só podem entrar no produto com origem, direitos e licença conhecida.`, turnId: null, complete: true }])
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: result.error.message, turnId: null, complete: true }])
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
        setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `TEMPLATE VERSIONADO\n${saved.value.name} · v${saved.value.version}\n${variableNames.length} variável(is)\n\n${report}`, turnId: null, complete: true }])
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: !saved.ok ? saved.error.message : !linted.ok ? linted.error.message : 'Falha no Prompt Architect.', turnId: null, complete: true }])
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
      setConversation((current) => [...current, { id: crypto.randomUUID(), role: sections.length > 0 ? 'assistant' : 'error', text: sections.join('\n\n'), turnId: null, complete: true }])
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
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: 'O plano não possui um passo mutável compatível com workspace.write.', turnId: null, complete: true }])
          setSending(false)
          return
        }
        if (aiStatus?.provider !== 'ollama') {
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: 'Plano persistido, mas o provider atual permanece read-only. Selecione Ollama local com um modelo compatível para gerar a proposta sem habilitar APIs experimentais.', turnId: null, complete: true }])
          setSending(false)
          return
        }
        const turn = await window.studio.agent.send({
          message,
          mode,
          proposalContext: { executionId: planResult.value.execution.id, stepId: targetStep.id }
        })
        if (!turn.ok) {
          setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: turn.error.message, turnId: null, complete: true }])
          setSending(false)
        }
      } else setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: planResult.error.message, turnId: null, complete: true }])
      if (!planResult.ok) setSending(false)
      return
    }
    const threadId = aiStatus?.activeThreadId
    const result = await window.studio.agent.send({ message, mode, ...(threadId !== null && threadId !== undefined ? { threadId } : {}) })
    if (!result.ok) {
      setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'error', text: result.error.message, turnId: null, complete: true }])
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
    setConversation([])
    setPlanned(null)
    setProposal(null)
    setProposalStatus(null)
    setExpiredProposals([])
    setSelectedLocalModel('')
    if (provider !== 'ollama') { setLocalModels([]); return }
    const models = await window.studio.agent.listLocalModels()
    if (models.ok) setLocalModels(models.value)
    else setNotice(models.error.message)
  }

  const selectOllamaModel = async (model: string): Promise<void> => {
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
        if (evidence.length > 0) setConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'EXECUÇÃO AUTORIZADA\n' + evidence.map((event) => event.title + ': ' + (event.detail ?? '')).join('\n'), turnId: null, complete: true }])
      }
      if (proposal !== null && proposal.executionId === planned.execution.id && proposalStatus === 'APPROVED') {
        const applied = await window.studio.planning.applyProposedWorkspaceWrite({ proposalId: proposal.id })
        if (applied.ok) {
          setProposalStatus('MATERIALIZED')
          const [tree, status] = await Promise.all([
            window.studio.workspace.list({ relativePath: '', depth: 4 }),
            window.studio.git.status()
          ])
          if (tree.ok) setFiles(tree.value)
          if (status.ok) setGit(status.value)
          setNotice(`Proposta materializada atomicamente: ${applied.value.relativePath}`)
        } else {
          setProposalStatus('FAILED')
          setNotice(applied.error.message)
        }
      } else setNotice('Execução autorizada; baseline real de workspace e Git registrado.')
    }
    else setNotice(result.error.message)
  }

  const updateProfile = (updater: (current: UIProfile) => UIProfile): void => {
    const current = profileRef.current
    if (current === null) return
    const updated = updater(current)
    profileRef.current = updated
    setProfile(updated)
  }

  const saveProfile = async (): Promise<void> => {
    const current = profileRef.current
    if (current === null) return
    const result = await window.studio.settings.save({ profile: current })
    if (result.ok) { profileRef.current = result.value; setProfile(result.value); setNotice('Preferências e layout persistidos.') }
    else setNotice(result.error.message)
  }

  const beginResize = (key: 'explorerWidth' | 'agentWidth' | 'deckHeight', event: React.PointerEvent<HTMLDivElement>): void => {
    const initial = profileRef.current
    if (initial === null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = key === 'deckHeight' ? event.clientY : event.clientX
    const start = initial.layout[key]
    const move = (pointer: PointerEvent): void => {
      const delta = key === 'deckHeight' ? origin - pointer.clientY : key === 'agentWidth' ? origin - pointer.clientX : pointer.clientX - origin
      const limit = key === 'deckHeight' ? 500 : key === 'agentWidth' ? 560 : 480
      updateProfile((current) => ({ ...current, layout: { ...current.layout, [key]: Math.max(0, Math.min(limit, start + delta)) } }))
    }
    const finish = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); void saveProfile() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
  }

  const workspaceName = useMemo(() => workspaceRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Nenhum projeto', [workspaceRoot])
  const missingEffectManifest = planned?.plan.steps.some((step) => step.requiresApproval && step.effects.length === 0) ?? false
  const proposalMatchesManifest = proposal !== null && planned !== null
    && proposal.executionId === planned.execution.id
    && planned.plan.steps.some((step) => step.id === proposal.stepId && step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id))
  const proposalReady = proposalMatchesManifest && proposalStatus === 'APPROVED'

  return (
    <main className={`studio ${profile?.density === 'COMFORTABLE' ? 'density-comfortable' : 'density-compact'}`} style={profile === null ? undefined : { '--bg': profile.theme.background, '--surface': profile.theme.surface, '--raised': profile.theme.raised, '--text': profile.theme.text, '--muted': profile.theme.muted, '--accent': profile.theme.accent, '--info': profile.theme.info, '--warning': profile.theme.warning, '--danger': profile.theme.danger, '--explorer-width': `${profile.layout.explorerWidth}px`, '--agent-width': `${profile.layout.agentWidth}px`, '--deck-height': `${profile.layout.deckHeight}px` } as React.CSSProperties}>
      <header className="ribbon drag-region">
        <div className="brand no-drag"><span className="brand-mark"><Braces size={17} /></span><strong>Tupiniquim</strong><span className="brand-sub">AI DEV STUDIO</span></div>
        <button className="project-switcher no-drag" onClick={() => void openWorkspace()}><Boxes size={15} /><span>{workspaceName}</span><ChevronsUpDown size={13} /></button>
        <div className="ribbon-meta no-drag"><GitBranch size={14} /><span>{git?.branch ?? 'sem Git'}</span></div>
        <div className="mode-switch no-drag">{modes.map((item) => <button key={item.mode} className={mode === item.mode ? 'active' : ''} onClick={() => setMode(item.mode)}>{item.label}</button>)}</div>
        <div className="ribbon-state no-drag"><span className="state-dot running" /><span>ASSISTED</span><ShieldCheck size={15} /></div>
      </header>

      <div className="workbench">
        <nav className="activity-rail" aria-label="Navegação principal">
          <button className="active" title="Explorer"><Code2 /></button><button title="Pesquisa"><Search /></button><button title="Agentes"><Bot /></button>
          <button title="Research"><FileSearch /></button><button title="Prompt Architect"><Sparkles /></button><button title="Visual Lab"><Palette /></button>
          <div className="spacer" /><button title="Layout" onClick={() => updateProfile((current) => ({ ...current, layout: { explorerWidth: 230, agentWidth: 340, deckHeight: 220 } }))}><LayoutDashboard /></button><button title="Configurações" onClick={() => setShowSettings((current) => !current)}><Settings2 /></button>
        </nav>

        <aside className="explorer panel">
          <div className="panel-title"><span>WORKSPACE</span><button className="icon-button" onClick={() => void openWorkspace()} title="Abrir workspace"><Boxes size={14} /></button></div>
          {files.length > 0 ? <FileTree entries={files} selected={document?.relativePath} onSelect={(path) => void openFile(path)} /> : <div className="empty-compact"><Code2 size={22} /><p>Abra um workspace real.</p><button onClick={() => void openWorkspace()}>Abrir pasta</button></div>}
          <div className="explorer-footer"><span>{git?.entries.length ?? 0} alterações</span><span>{files.length} raízes</span></div>
        </aside>

        <section className="editor-area">
          <div className="editor-tabs">
            {document !== null ? <div className="editor-tab active"><span>{dirty ? '● ' : ''}{basename(document.relativePath)}</span><button onClick={() => { setDocument(null); setContent('') }}>×</button></div> : <div className="editor-tab active"><span>Visão geral</span></div>}
            <div className="spacer" /><button className="icon-button" disabled={!dirty} onClick={() => void save()} title="Salvar"><Save size={15} /></button>
          </div>
          {document !== null ? (
            <Editor height="100%" path={document.relativePath} language={languageFor(document.relativePath)} value={content} onChange={(value) => setContent(value ?? '')} theme="vs-dark" options={{ minimap: { enabled: true }, fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace', fontSize: 13, padding: { top: 16 }, smoothScrolling: true, automaticLayout: true }} />
          ) : (
            <div className="welcome-canvas">
              <div className="aurora" />
              <span className="eyebrow">ESTAÇÃO LOCAL-FIRST</span><h1>Engenharia com<br /><em>controle de voo.</em></h1>
              <p>Planeje, aprove, execute, teste e revise software real com uma trilha causal recuperável.</p>
              <div className="quick-grid"><button onClick={() => void openWorkspace()}><Boxes /><span><strong>Abrir workspace</strong><small>Mapear repositório local</small></span></button><button onClick={() => setMode('PLAN')}><PanelBottom /><span><strong>Novo plano</strong><small>Definir antes de alterar</small></span></button><button onClick={() => setDeck('timeline')}><History /><span><strong>Caixa-preta</strong><small>Rever eventos e checkpoints</small></span></button></div>
            </div>
          )}
        </section>

        <aside className="agent-panel panel">
          <div className="agent-heading"><div className="agent-orb"><Bot size={18} /></div><div><strong>Agente principal</strong><small>Modo {mode}</small></div><span className="availability">{aiStatus?.state ?? 'LOCAL'}</span></div>
          <div className="context-strip"><span>ESTADO</span><strong>{aiStatus?.state ?? 'DISCONNECTED'}</strong><span>POLÍTICA</span><strong>ASSISTED</strong><span>CONTEXTO</span><strong>{workspaceContext === null ? 'NÃO MAPEADO' : String(workspaceContext.entries.length) + (workspaceContext.truncated ? '+' : '') + ' ITENS'}</strong></div>
          <div className="provider-controls">
            <label>PROVIDER<select aria-label="Provedor de IA" value={aiStatus?.provider ?? 'codex-app-server'} disabled={sending || aiStatus?.state === 'BUSY'} onChange={(event) => void selectAgentProvider(event.target.value as AIProviderKind)}><option value="codex-app-server">Codex App Server</option><option value="ollama">Ollama local</option></select></label>
            {aiStatus?.provider === 'ollama' && <label>MODELO<select aria-label="Modelo Ollama local" value={selectedLocalModel} disabled={localModels.length === 0 || aiStatus.state !== 'READY'} onChange={(event) => void selectOllamaModel(event.target.value)}><option value="">Selecionar modelo</option>{localModels.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select></label>}
          </div>
          <section className="agent-conversation">
            <div className="agent-message"><span className="message-label">SISTEMA</span><p>{aiStatus?.provider === 'ollama' ? 'Ollama usa somente o loopback local; modelos são escolhidos explicitamente e não há downloads automáticos.' : 'Codex usa stdio JSONL, dados em F:\\CODEX e execução read-only nesta onda. Mutações aguardam aprovação granular.'}</p></div>
            {conversation.map((message) => <div key={message.id} className={`agent-message ${message.role}`}><span className="message-label">{message.role === 'user' ? 'VOCÊ' : message.role === 'error' ? 'ERRO' : aiStatus?.provider === 'ollama' ? 'OLLAMA' : 'CODEX'}</span><p>{message.text}{!message.complete && <span className="stream-caret">▋</span>}</p></div>)}
            {expiredProposals.map((item) => <ProposalProvenance key={item.proposal.id} proposal={item.proposal} status={item.status} expired />)}
            {proposal !== null && <ProposalProvenance proposal={proposal} status={proposalStatus ?? 'PENDING_REVIEW'} />}
            {planned !== null ? (
              <div className="live-plan-card">
                <header><div><CheckCircle2 size={15} /><strong>{planned.plan.title}</strong></div><span>{planned.execution.state}</span></header>
                <ol>{planned.plan.steps.map((step, index) => (
                  <li key={step.id}>
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <input value={step.title} onChange={(event) => editPlanStep(step.id, event.target.value)} />
                      <small>{step.risk} · {step.requiresApproval ? step.effects.length === 0 ? 'manifesto de efeitos pendente' : String(step.effects.length) + ' efeito(s) para aprovação' : 'sem mutação'}</small>
                      {step.effects.map((effect) => <small key={effect.id} title={`${effect.capability} · ${effect.operation} · ${effect.target} · ${effect.payloadHash}`}>{effect.capability} · {effect.operation} · {effect.target} · hash {effect.payloadHash.slice(0, 12)}…</small>)}
                    </div>
                    {step.requiresApproval && <div className="approval-actions"><button disabled={step.effects.length === 0 || proposalStatus !== 'PENDING_REVIEW' || proposal?.executionId !== planned.execution.id || proposal.stepId !== step.id || !step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id)} onClick={() => void decidePlanStep(step.id, 'APPROVED')}>Aprovar</button><button className="deny" disabled={step.effects.length === 0 || proposalStatus !== 'PENDING_REVIEW' || proposal?.executionId !== planned.execution.id || proposal.stepId !== step.id || !step.effects.some((effect) => effect.id === proposal.effect.id && effect.source?.proposalId === proposal.id)} onClick={() => void decidePlanStep(step.id, 'DENIED')}>Negar</button></div>}
                  </li>
                ))}</ol>
                <footer><button onClick={() => void savePlan()}>Salvar plano</button><button className="primary" title={missingEffectManifest ? 'Aguardando manifesto de efeitos do runtime.' : !proposalReady ? 'A proposta precisa ser aprovada antes da execução.' : undefined} disabled={planned.execution.state === 'BLOCKED' || missingEffectManifest || !proposalReady} onClick={() => void startPlannedExecution()}>Iniciar execução</button></footer>
              </div>
            ) : conversation.length === 0 && <div className="plan-card"><div><CheckCircle2 size={15} /><strong>Fluxo protegido</strong></div><ol><li><span>1</span>Entender objetivo</li><li><span>2</span>Produzir plano verificável</li><li><span>3</span>Solicitar aprovação material</li><li><span>4</span>Executar e validar</li></ol></div>}
          </section>
          <div className="composer"><textarea aria-label="Mensagem ao agente" placeholder={workspaceRoot === null ? 'Abra um workspace primeiro…' : 'Descreva o que deseja construir…'} value={agentInput} onChange={(event) => setAgentInput(event.target.value)} onKeyDown={(event) => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void sendToAgent() } }} /><div><span>{aiStatus?.provider === 'ollama' ? selectedLocalModel === '' ? 'Selecione um modelo local' : 'Ollama somente loopback' : aiStatus?.account === 'API_KEY' ? 'API key local' : aiStatus?.account === 'CHATGPT' ? 'Conta Codex' : 'Ctrl + Enter para enviar'}</span>{aiStatus?.state === 'BUSY' ? <button onClick={() => void interruptAgent()}>Interromper</button> : <button disabled={workspaceRoot === null || agentInput.trim() === '' || sending || (aiStatus?.provider === 'ollama' && (aiStatus.state !== 'READY' || selectedLocalModel === ''))} onClick={() => void sendToAgent()}><Sparkles size={15} />{sending ? 'Conectando…' : 'Enviar'}</button>}</div></div>
        </aside>

        <section className="bottom-deck">
          <nav><button className={deck === 'terminal' ? 'active' : ''} onClick={() => setDeck('terminal')}><TerminalSquare size={14} />Terminal</button><button className={deck === 'tests' ? 'active' : ''} onClick={() => setDeck('tests')}><CheckCircle2 size={14} />Testes</button><button className={deck === 'review' ? 'active' : ''} onClick={() => setDeck('review')}><Eye size={14} />Review</button><button className={deck === 'timeline' ? 'active' : ''} onClick={() => setDeck('timeline')}><History size={14} />Caixa-preta</button><div className="spacer" /><span className="notice">{notice}</span></nav>
          <div className="deck-content">{deck === 'terminal' && <TerminalPane workspaceReady={workspaceRoot !== null} />}{deck === 'tests' && <DeckEmpty icon={<CheckCircle2 />} title="Nenhuma suíte executada" detail="Testes reais aparecerão aqui com comando, duração e evidência." />}{deck === 'review' && <DeckEmpty icon={<Eye />} title="Diff aguardando mudanças" detail="O review compara o baseline Git sem ocultar arquivos." />}{deck === 'timeline' && <Timeline key={aiStatus?.activeThreadId ?? 'empty'} workspaceReady={workspaceRoot !== null} threadId={aiStatus?.activeThreadId ?? null} />}</div>
        </section>
        <div className="resize-handle explorer-resize" role="separator" aria-label="Redimensionar explorer" onPointerDown={(event) => beginResize('explorerWidth', event)} onDoubleClick={() => updateProfile((current) => ({ ...current, layout: { ...current.layout, explorerWidth: current.layout.explorerWidth === 0 ? 230 : 0 } }))} />
        <div className="resize-handle agent-resize" role="separator" aria-label="Redimensionar agente" onPointerDown={(event) => beginResize('agentWidth', event)} onDoubleClick={() => updateProfile((current) => ({ ...current, layout: { ...current.layout, agentWidth: current.layout.agentWidth === 0 ? 340 : 0 } }))} />
        <div className="resize-handle deck-resize" role="separator" aria-label="Redimensionar deck inferior" onPointerDown={(event) => beginResize('deckHeight', event)} onDoubleClick={() => updateProfile((current) => ({ ...current, layout: { ...current.layout, deckHeight: current.layout.deckHeight === 0 ? 220 : 0 } }))} />
      </div>
      {showSettings && profile !== null && <aside className="settings-popover"><header><strong>Preferências</strong><button onClick={() => setShowSettings(false)}>×</button></header><label>Densidade<select value={profile.density} onChange={(event) => updateProfile((current) => ({ ...current, density: event.target.value as UIProfile['density'] }))}><option value="COMPACT">Compacta</option><option value="COMFORTABLE">Confortável</option></select></label><label>Acento<input type="color" value={profile.theme.accent} onChange={(event) => updateProfile((current) => ({ ...current, theme: { ...current.theme, accent: event.target.value } }))} /></label><label>Fundo<input type="color" value={profile.theme.background} onChange={(event) => updateProfile((current) => ({ ...current, theme: { ...current.theme, background: event.target.value } }))} /></label><button className="save-settings" onClick={() => void saveProfile()}>Validar e salvar</button></aside>}
      <footer className="statusbar"><span><ShieldCheck size={13} />Sandbox ativo</span><span>{workspaceRoot === null ? 'Sem workspace' : workspaceRoot}</span><div className="spacer" /><span>{system?.platform ?? 'win32'} · {system?.arch ?? 'x64'}</span><span>v{system?.version ?? '0.1.0'}</span></footer>
    </main>
  )
}

const DeckEmpty = ({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }): React.JSX.Element => <div className="deck-empty"><span>{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>

const ProposalProvenance = ({ proposal, status, expired }: { proposal: WorkspaceWriteProposal; status: ProposalStatus; expired?: boolean }): React.JSX.Element => (
  <section className={`proposal-provenance${expired === true ? ' expired' : ''}`} aria-label="Proveniência da proposta de escrita">
    <header><strong>workspace.write</strong><span>{status}</span></header>
    <dl>
      <div><dt>Provider</dt><dd>{proposal.provider}</dd></div>
      <div><dt>Tool</dt><dd>{proposal.tool}</dd></div>
      <div><dt>Execution</dt><dd title={proposal.executionId}>{proposal.executionId}</dd></div>
      <div><dt>Step</dt><dd title={proposal.stepId}>{proposal.stepId}</dd></div>
      <div><dt>Thread</dt><dd title={proposal.threadId}>{proposal.threadId}</dd></div>
      <div><dt>Turn</dt><dd title={proposal.turnId}>{proposal.turnId}</dd></div>
      <div><dt>Tool call</dt><dd title={proposal.toolCallId}>{proposal.toolCallId}</dd></div>
      <div><dt>Target</dt><dd title={proposal.effect.target}>{proposal.effect.target}</dd></div>
      <div><dt>Operation</dt><dd>{proposal.effect.operation}</dd></div>
      <div><dt>Manifest</dt><dd title={proposal.effect.id}>{proposal.effect.id}</dd></div>
      <div><dt>Proposal</dt><dd title={proposal.id}>{proposal.id}</dd></div>
      <div><dt>Hash</dt><dd title={proposal.effect.payloadHash}>{proposal.effect.payloadHash}</dd></div>
      <div><dt>Target baseline</dt><dd title={proposal.effect.expectedTargetHash ?? 'INEXISTENTE'}>{proposal.effect.expectedTargetHash ?? 'INEXISTENTE'}</dd></div>
      <div><dt>Timestamp</dt><dd>{new Date(proposal.createdAt).toLocaleString('pt-BR')}</dd></div>
    </dl>
  </section>
)

const Timeline = ({ workspaceReady, threadId }: { workspaceReady: boolean; threadId: string | null }): React.JSX.Element => {
  const [history, setHistory] = useState<AIThreadHistory | null>(null)
  useEffect(() => {
    if (threadId === null) return
    let active = true
    void window.studio.agent.history({ threadId }).then((result) => { if (active && result.ok) setHistory(result.value) })
    return () => { active = false }
  }, [threadId])
  return (
    <div className="timeline"><div className="timeline-event success"><span /><time>agora</time><strong>Aplicação iniciada</strong><p>Fronteiras Electron e armazenamento F:\CODEX-only ativos.</p></div>{workspaceReady && <div className="timeline-event info"><span /><time>agora</time><strong>Workspace autorizado</strong><p>Mapa de arquivos e estado Git carregados.</p></div>}{history !== null && <div className="timeline-event info"><span /><time>histórico</time><strong>{String(history.turns.length)} turns persistidos</strong><p>{history.events.slice(-3).map((event) => event.kind + (event.status === undefined ? '' : ' · ' + event.status)).join('\n') || 'Eventos sem conteúdo bruto de entrada.'}</p></div>}</div>
  )
}

const handleAgentEvent = (
  event: AIEvent,
  setStatus: React.Dispatch<React.SetStateAction<AIStatus | null>>,
  setConversation: React.Dispatch<React.SetStateAction<ConversationMessage[]>>,
  setSending: React.Dispatch<React.SetStateAction<boolean>>
): void => {
  if (event.kind === 'STATUS') {
    void window.studio.agent.status().then((result) => { if (result.ok) setStatus(result.value) })
  } else if (event.kind === 'MESSAGE_DELTA') {
    setConversation((current) => {
      const last = current.at(-1)
      if (last?.role === 'assistant' && last.turnId === (event.turnId ?? null) && !last.complete) {
        return [...current.slice(0, -1), { ...last, text: `${last.text}${event.text ?? ''}` }]
      }
      return [...current, { id: event.id, role: 'assistant', text: event.text ?? '', turnId: event.turnId ?? null, complete: false }]
    })
  } else if (event.kind === 'TURN_COMPLETED') {
    setConversation((current) => current.map((message) => message.turnId === (event.turnId ?? null) ? { ...message, complete: true } : message))
    setSending(false)
  } else if (event.kind === 'ERROR') {
    setConversation((current) => [...current, { id: event.id, role: 'error', text: event.detail ?? 'Falha no Codex App Server.', turnId: event.turnId ?? null, complete: true }])
    setSending(false)
  }
}

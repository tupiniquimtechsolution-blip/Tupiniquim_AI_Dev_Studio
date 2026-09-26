import { useEffect, useMemo, useState } from 'react'
import type { AIProviderKind, AIStatus, LocalModel, SkillControlView, ToolboxGateId, ToolboxGateView } from '@tupiniquim/contracts'
import './control-center.css'

const toolboxGates: Array<{ id: ToolboxGateId; label: string }> = [
  { id: 'quality-gates', label: 'Qualidade completa' },
  { id: 'dependency-audit', label: 'Dependências' },
  { id: 'secret-scan', label: 'Secret scan' },
  { id: 'security-review', label: 'Segurança' },
  { id: 'privacy-lgpd', label: 'LGPD / Privacidade' },
  { id: 'accessibility-wcag', label: 'WCAG / Acessibilidade' },
  { id: 'architecture-review', label: 'Arquitetura' },
  { id: 'supply-chain', label: 'Supply chain' },
  { id: 'release-checklist', label: 'Release checklist' }
]

interface ControlCenterProps {
  open: boolean
  onClose(): void
  workspaceRoot: string | null
  aiStatus: AIStatus | null
  localModels: LocalModel[]
  selectedLocalModel: string
  onSelectProvider(provider: AIProviderKind): Promise<void>
  onSelectModel(model: string): Promise<void>
  onRefreshModels(): Promise<void>
}

export const ControlCenter = (props: ControlCenterProps): React.JSX.Element | null => {
  const [section, setSection] = useState('models-providers')
  const [skills, setSkills] = useState<SkillControlView[]>([])
  const [portableRoot, setPortableRoot] = useState('')
  const [portableResult, setPortableResult] = useState<string>('Informe a raiz do AI Lab/USB para detectar runtimes sem alterar arquivos.')
  const [gateResult, setGateResult] = useState<ToolboxGateView | null>(null)
  const [busy, setBusy] = useState(false)
  const projectId = useMemo(() => props.workspaceRoot ?? '', [props.workspaceRoot])

  useEffect(() => {
    if (!props.open || projectId === '') { setSkills([]); return }
    void window.controlCenter.listSkills({ projectId }).then((result) => {
      if (result.ok) setSkills(result.value)
    })
  }, [props.open, projectId])

  if (!props.open) return null

  const runGate = async (gateId: ToolboxGateId): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.controlCenter.runToolboxGate({ gateId })
      setGateResult(result.ok ? result.value : { gateId, state: 'FAIL', evidence: result.error.message })
    } finally { setBusy(false) }
  }

  const inspectPortable = async (): Promise<void> => {
    if (portableRoot.trim() === '') return
    setBusy(true)
    try {
      const result = await window.controlCenter.inspectPortable({ root: portableRoot })
      if (!result.ok) { setPortableResult(result.error.message); return }
      setPortableResult(result.value.runtimes.map((runtime) => `${runtime.available ? '✓' : '○'} ${runtime.label}: ${runtime.state}`).join('\n'))
    } finally { setBusy(false) }
  }

  const toggleToolbox = async (enabled: boolean): Promise<void> => {
    if (projectId === '') return
    const result = await window.controlCenter.setSkillEnabled({ projectId, skillId: 'tupiniquim-toolbox', enabled, approvedByUser: true })
    if (result.ok) setSkills([result.value])
  }

  return <div className="control-center-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}>
    <section className="control-center" role="dialog" aria-modal="true" aria-label="Tupiniquim Control Center">
      <header><div><strong>Tupiniquim Control Center</strong><small>AI Lab + Toolbox + Dev AI</small></div><button onClick={props.onClose}>×</button></header>
      <div className="control-center-body">
        <nav>{[
          ['models-providers', 'Modelos & Providers'], ['skills', 'Skills'], ['toolbox', 'Toolbox'], ['ai-lab', 'AI Lab'], ['agents', 'Agentes'], ['security-quality', 'Segurança & Qualidade']
        ].map(([id, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}</nav>
        <main>
          {section === 'models-providers' && <div className="cc-stack"><h2>Modelos & Providers</h2><p>Seleção explícita. Nenhum fallback automático.</p><label>Provider<select value={props.aiStatus?.provider ?? 'codex-app-server'} disabled={busy || props.aiStatus?.state === 'BUSY'} onChange={(event) => void props.onSelectProvider(event.target.value as AIProviderKind)}><option value="codex-app-server">Codex App Server</option><option value="ollama">Ollama local</option></select></label>{props.aiStatus?.provider === 'ollama' && <><label>Modelo<select value={props.selectedLocalModel} onChange={(event) => void props.onSelectModel(event.target.value)}><option value="">Selecionar modelo</option>{props.localModels.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select></label><button onClick={() => void props.onRefreshModels()}>Atualizar modelos</button></>}</div>}
          {section === 'skills' && <div className="cc-stack"><h2>Skills</h2><p>Descoberta não equivale a aprovação. Somente skills auditadas podem ser habilitadas.</p>{projectId === '' ? <div className="cc-note">Abra um workspace para gerenciar skills por projeto.</div> : skills.map((skill) => <div className="cc-card" key={skill.id}><div><strong>{skill.name}</strong><small>{skill.status} · execução automática: NÃO</small></div><button onClick={() => void toggleToolbox(!skill.enabled)}>{skill.enabled ? 'Desabilitar' : 'Habilitar'}</button></div>)}</div>}
          {section === 'toolbox' && <div className="cc-stack"><h2>Toolbox</h2><p>Gates allowlisted; nenhum comando arbitrário vem da interface.</p><div className="cc-grid">{toolboxGates.map((gate) => <button key={gate.id} disabled={busy || projectId === ''} onClick={() => void runGate(gate.id)}>{gate.label}</button>)}</div>{gateResult !== null && <pre className={`cc-evidence state-${gateResult.state.toLowerCase()}`}>{gateResult.gateId}: {gateResult.state}\n{gateResult.evidence}</pre>}</div>}
          {section === 'ai-lab' && <div className="cc-stack"><h2>AI Lab</h2><p>Detecção read-only da estrutura portátil runtime/models/data/projects/cache.</p><label>Raiz portátil<input value={portableRoot} onChange={(event) => setPortableRoot(event.target.value)} placeholder="Ex.: D:\\AI-LAB ou F:\\AI-LAB" /></label><button disabled={busy || portableRoot.trim() === ''} onClick={() => void inspectPortable()}>Detectar runtimes</button><pre className="cc-evidence">{portableResult}</pre></div>}
          {section === 'agents' && <div className="cc-stack"><h2>Agentes</h2><p>Agent, provider, modelo e skills permanecem identidades separadas. Loadouts exigem aprovação explícita e só aceitam skills habilitadas no projeto.</p><div className="cc-note">Agent loadout control está ativo no core; edição visual avançada fica bloqueada até existir binding persistente no runtime da interface.</div></div>}
          {section === 'security-quality' && <div className="cc-stack"><h2>Segurança & Qualidade</h2><p>Ausência de ambiente = NOT_AVAILABLE, nunca PASS. Use o Toolbox para executar os gates suportados e revisar evidências.</p><div className="cc-card"><div><strong>Política</strong><small>Default deny · approvals · AuditLog · sem fallback automático</small></div><span className="cc-badge">ATIVA</span></div></div>}
        </main>
      </div>
    </section>
  </div>
}

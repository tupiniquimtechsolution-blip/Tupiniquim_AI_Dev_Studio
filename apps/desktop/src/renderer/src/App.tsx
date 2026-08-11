import Editor from '@monaco-editor/react'
import { Bot, Boxes, Braces, CheckCircle2, ChevronsUpDown, Code2, Eye, FileSearch, GitBranch, History, LayoutDashboard, Palette, PanelBottom, Save, Search, Settings2, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FileDocument, FileEntry, GitStatus, Mode, SystemInfo } from '@tupiniquim/contracts'
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

export const App = (): React.JSX.Element => {
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [document, setDocument] = useState<FileDocument | null>(null)
  const [content, setContent] = useState('')
  const [git, setGit] = useState<GitStatus | null>(null)
  const [mode, setMode] = useState<Mode>('PLAN')
  const [deck, setDeck] = useState<'terminal' | 'tests' | 'review' | 'timeline'>('terminal')
  const [notice, setNotice] = useState('Abra um workspace para iniciar.')
  const dirty = document !== null && content !== document.content

  useEffect(() => { void window.studio.system.info().then((result) => { if (result.ok) setSystem(result.value) }) }, [])

  const openWorkspace = async (): Promise<void> => {
    const selected = await window.studio.workspace.pick()
    if (!selected.ok || selected.value === null) return
    const configured = await window.studio.workspace.configure({ root: selected.value })
    if (!configured.ok) { setNotice(configured.error.message); return }
    setWorkspaceRoot(configured.value)
    const [tree, status] = await Promise.all([
      window.studio.workspace.list({ relativePath: '', depth: 4 }),
      window.studio.git.status()
    ])
    if (tree.ok) setFiles(tree.value)
    if (status.ok) setGit(status.value)
    setNotice('Workspace autorizado e mapeado.')
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

  const workspaceName = useMemo(() => workspaceRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'Nenhum projeto', [workspaceRoot])

  return (
    <main className="studio">
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
          <div className="spacer" /><button title="Layout"><LayoutDashboard /></button><button title="Configurações"><Settings2 /></button>
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
          <div className="agent-heading"><div className="agent-orb"><Bot size={18} /></div><div><strong>Agente principal</strong><small>Modo {mode}</small></div><span className="availability">LOCAL</span></div>
          <div className="context-strip"><span>ESTADO</span><strong>REQUEST</strong><span>POLÍTICA</span><strong>ASSISTED</strong></div>
          <section className="agent-conversation">
            <div className="agent-message"><span className="message-label">SISTEMA</span><p>Workspace, Git e terminal usam adapters reais. O acesso privilegiado passa pela política e pelo audit log.</p></div>
            <div className="plan-card"><div><CheckCircle2 size={15} /><strong>Próximo fluxo</strong></div><ol><li><span>1</span>Entender objetivo</li><li><span>2</span>Produzir plano verificável</li><li><span>3</span>Solicitar aprovação material</li><li><span>4</span>Executar e validar</li></ol></div>
          </section>
          <div className="composer"><textarea aria-label="Mensagem ao agente" placeholder="Descreva o que deseja construir…" /><div><span>Ctrl + Enter para enviar</span><button disabled title="Codex entra na próxima onda"><Sparkles size={15} />Enviar</button></div></div>
        </aside>

        <section className="bottom-deck">
          <nav><button className={deck === 'terminal' ? 'active' : ''} onClick={() => setDeck('terminal')}><TerminalSquare size={14} />Terminal</button><button className={deck === 'tests' ? 'active' : ''} onClick={() => setDeck('tests')}><CheckCircle2 size={14} />Testes</button><button className={deck === 'review' ? 'active' : ''} onClick={() => setDeck('review')}><Eye size={14} />Review</button><button className={deck === 'timeline' ? 'active' : ''} onClick={() => setDeck('timeline')}><History size={14} />Caixa-preta</button><div className="spacer" /><span className="notice">{notice}</span></nav>
          <div className="deck-content">{deck === 'terminal' && <TerminalPane workspaceReady={workspaceRoot !== null} />}{deck === 'tests' && <DeckEmpty icon={<CheckCircle2 />} title="Nenhuma suíte executada" detail="Testes reais aparecerão aqui com comando, duração e evidência." />}{deck === 'review' && <DeckEmpty icon={<Eye />} title="Diff aguardando mudanças" detail="O review compara o baseline Git sem ocultar arquivos." />}{deck === 'timeline' && <Timeline workspaceReady={workspaceRoot !== null} />}</div>
        </section>
      </div>
      <footer className="statusbar"><span><ShieldCheck size={13} />Sandbox ativo</span><span>{workspaceRoot === null ? 'Sem workspace' : workspaceRoot}</span><div className="spacer" /><span>{system?.platform ?? 'win32'} · {system?.arch ?? 'x64'}</span><span>v{system?.version ?? '0.1.0'}</span></footer>
    </main>
  )
}

const DeckEmpty = ({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }): React.JSX.Element => <div className="deck-empty"><span>{icon}</span><div><strong>{title}</strong><p>{detail}</p></div></div>

const Timeline = ({ workspaceReady }: { workspaceReady: boolean }): React.JSX.Element => (
  <div className="timeline"><div className="timeline-event success"><span /><time>agora</time><strong>Aplicação iniciada</strong><p>Fronteiras Electron e armazenamento E-only ativos.</p></div>{workspaceReady && <div className="timeline-event info"><span /><time>agora</time><strong>Workspace autorizado</strong><p>Mapa de arquivos e estado Git carregados.</p></div>}</div>
)

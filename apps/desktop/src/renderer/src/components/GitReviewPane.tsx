import './git-review.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitStatus } from '@tupiniquim/contracts'

export const GitReviewPane = ({ workspaceReady }: { workspaceReady: boolean }): React.JSX.Element => {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [output, setOutput] = useState('Abra um workspace para consultar o Git real.')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(workspaceReady)
  const request = useRef(0)
  const refresh = useCallback(async (): Promise<void> => {
    if (!workspaceReady) return
    const current = ++request.current
    try {
      const [snapshot, diff] = await Promise.all([window.studio.git.status(), window.studio.git.diff()])
      if (current !== request.current) return
      setStatus(snapshot.ok ? snapshot.value : null)
      setFeedback(snapshot.ok ? 'Estado Git atualizado.' : snapshot.error.message)
      setOutput(diff.ok ? diff.value || 'Sem alterações tracked não staged. Índice e arquivos novos aparecem na lista de estado.' : diff.error.message)
    } catch {
      if (current === request.current) { setStatus(null); setFeedback('Consulta Git não confirmada.'); setOutput('Diff indisponível.') }
    } finally { if (current === request.current) setBusy(false) }
  }, [workspaceReady])
  useEffect(() => { void refresh(); return () => { request.current += 1 } }, [refresh])
  return <section className="git-review-pane" aria-label="Revisão Git somente leitura">
    <p>Painel somente leitura. Commit, checkpoint e restauração ainda não estão disponíveis nesta superfície.</p>
    <button disabled={!workspaceReady || busy} onClick={() => { setBusy(true); void refresh() }}>Atualizar estado e diff</button>
    <p role="status" aria-live="polite">{feedback}</p>
    {status !== null && <><h3>{status.branch === '(detached)' ? 'HEAD destacado' : status.branch}</h3><p>{status.upstream === undefined ? 'Sem upstream configurado.' : `Upstream: ${status.upstream}`} · À frente: {status.ahead} · Atrás: {status.behind}</p>
      <h3>Estado de arquivos</h3>{status.entries.length === 0 ? <p>Árvore de trabalho e índice sem alterações.</p> : <ul>{status.entries.map((entry) => <li key={entry.path}><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.path}</code><p>Índice: {entry.index} · Trabalho: {entry.worktree}</p></li>)}</ul>}</>}
    <h3>Diff tracked não staged</h3><pre aria-label="Diff Git" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{output}</pre>
  </section>
}

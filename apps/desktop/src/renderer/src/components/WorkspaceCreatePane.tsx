import { useRef, useState } from 'react'
import type { WorkspaceCreateReview } from '../../../../../../packages/contracts/src/workspace-create'

export const WorkspaceCreatePane = ({ onCreated }: { onCreated: () => void }): React.JSX.Element | null => {
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [review, setReview] = useState<WorkspaceCreateReview | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  if (window.studio.workspace.prepareCreate === undefined || window.studio.workspace.approveCreate === undefined) return null
  const run = async (approve: boolean): Promise<void> => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      if (approve && review !== null) {
        const result = await window.studio.workspace.approveCreate?.({ reviewId: review.id })
        if (result?.ok) { setStatus(`Arquivo criado: ${result.value.relativePath}`); setReview(null); setPath(''); setContent(''); onCreated() }
        else setStatus(result?.error.message ?? 'Capacidade indisponível.')
      } else {
        const result = await window.studio.workspace.prepareCreate?.({ relativePath: path, content })
        if (result?.ok) { setReview(result.value); setStatus('Revise caminho e conteúdo. A aprovação cria somente este arquivo.') }
        else setStatus(result?.error.message ?? 'Capacidade indisponível.')
      }
    } catch { setStatus('Criação não confirmada. O rascunho foi preservado.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <details className="prompt-architect-pane"><summary>Novo arquivo</summary>
    <p>Criação manual com aprovação única. Nunca substitui arquivos. O diretório pai deve existir. Fechar o painel descarta este rascunho.</p>
    <fieldset disabled={busy}><legend>{review === null ? 'Rascunho' : 'Revisão de criação'}</legend>
      <label>Caminho do novo arquivo<input aria-label="Caminho do novo arquivo" value={review?.relativePath ?? path} readOnly={review !== null} maxLength={500} onChange={(event) => setPath(event.target.value)} /></label>
      <label>Conteúdo do novo arquivo<textarea aria-label="Conteúdo do novo arquivo" value={review?.content ?? content} readOnly={review !== null} maxLength={1_000_000} onChange={(event) => setContent(event.target.value)} /></label>
      {review === null ? <button onClick={() => void run(false)} disabled={path === ''}>Preparar revisão</button> : <><p>Operação: CREATE · Origem: usuário · Risco: alto</p><p style={{ overflowWrap: 'anywhere' }}>SHA-256: {review.payloadHash}</p><p>Válida até {new Date(review.expiresAt).toLocaleTimeString()}.</p><button onClick={() => void run(true)}>Aprovar e criar arquivo</button><button onClick={() => { setReview(null); setStatus('Revisão abandonada. Prepare outra após editar.') }}>Voltar ao rascunho</button></>}
    </fieldset><p role="status" aria-live="polite">{status}</p>
  </details>
}

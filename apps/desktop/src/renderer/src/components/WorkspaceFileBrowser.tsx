import { useEffect, useRef, useState } from 'react'
import type { FileEntry, SearchMatch } from '@tupiniquim/contracts'
import { FileTree } from './FileTree'

interface WorkspaceFileBrowserProps {
  entries: FileEntry[]
  selected: string | undefined
  onSelect: (path: string) => void
  onRefresh: () => void
}

/** Read-only search through the typed workspace bridge; never scans in renderer. */
export const WorkspaceFileBrowser = ({ entries, selected, onSelect, onRefresh }: WorkspaceFileBrowserProps): React.JSX.Element => {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<SearchMatch[] | null>(null)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef(0)
  useEffect(() => () => { request.current += 1 }, [])

  const search = async (): Promise<void> => {
    if (query.trim() === '') return
    const current = ++request.current
    setPending(true)
    setNotice('Buscando no conteúdo dos arquivos…')
    try {
      const result = await window.studio.workspace.search({ query: query.trim(), limit: 100 })
      if (request.current !== current) return
      if (result.ok) {
        setMatches(result.value)
        setNotice(result.value.length === 100 ? '100 resultados. Refine a busca para encontrar outros arquivos.' : `${result.value.length} resultado(s).`)
      } else { setMatches(null); setNotice(result.error.message) }
    } catch {
      if (request.current === current) { setMatches(null); setNotice('Não foi possível buscar. Verifique o Runtime e tente novamente.') }
    } finally {
      if (request.current === current) setPending(false)
    }
  }

  return <div className="workspace-file-browser">
    <form onSubmit={(event) => { event.preventDefault(); void search() }}>
      <label htmlFor="workspace-content-search">Buscar no conteúdo</label>
      <input id="workspace-content-search" type="search" maxLength={200} value={query} placeholder="Texto nos arquivos…" onChange={(event) => {
        request.current += 1
        setQuery(event.target.value)
        setMatches(null)
        setNotice('')
        setPending(false)
      }} />
      <div className="workspace-search-actions">
        <button disabled={pending || query.trim() === ''} type="submit">{pending ? 'Buscando…' : 'Buscar'}</button>
        <button type="button" onClick={onRefresh}>Atualizar arquivos</button>
      </div>
    </form>
    <p className="workspace-search-notice" role="status">{notice}</p>
    {matches !== null
      ? <ul className="workspace-search-results" aria-label="Resultados da busca">
          {matches.map((match, index) => <li key={`${match.relativePath}:${match.line}:${index}`}>
            <button onClick={() => onSelect(match.relativePath)}>
              <strong>{match.relativePath}:{match.line}</strong><span>{match.preview}</span>
            </button>
          </li>)}
        </ul>
      : entries.length > 0
        ? <FileTree entries={entries} selected={selected} onSelect={onSelect} />
        : <p className="workspace-search-notice">Nenhum arquivo mapeado. Atualize para consultar o workspace.</p>}
  </div>
}

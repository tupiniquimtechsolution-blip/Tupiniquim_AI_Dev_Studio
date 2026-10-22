import { useRef, useState } from 'react'
import { TerminalPane } from './TerminalPane'

export const TerminalSessions = ({ workspaceReady, platform }: { workspaceReady: boolean; platform?: string | null }): React.JSX.Element => {
  const [sessions, setSessions] = useState([1])
  const [active, setActive] = useState(1)
  const sequence = useRef(1)
  const close = (): void => {
    if (!window.confirm('Encerrar esta sessão e descartar seu histórico visual?')) return
    const remaining = sessions.filter((id) => id !== active)
    setSessions(remaining); setActive(remaining[0] ?? 0)
  }
  return <section className="terminal-sessions" aria-label="Sessões de terminal">
    <div className="terminal-session-controls" role="group" aria-label="Selecionar sessão de terminal">
      {sessions.map((id) => <button key={id} aria-pressed={active === id} onClick={() => setActive(id)}>Sessão {id}</button>)}
      <button disabled={!workspaceReady || sessions.length >= 4} onClick={() => { const id = ++sequence.current; setSessions((current) => [...current, id]); setActive(id) }}>Nova sessão</button>
      <button disabled={sessions.length === 0} onClick={close}>Fechar sessão</button>
    </div>
    <p className="terminal-session-caption">Até 4 sessões. Cada shell exige confirmação antes de iniciar. Fechar o painel encerra todas as sessões. {platform === 'cloudflare-edge' && 'No Runtime Web: 15min sem entrada ou 60min de duração encerram o shell.'}</p>
    {sessions.map((id) => <div key={id} className="terminal-session-panel" hidden={active !== id} aria-label={`Terminal da sessão ${id}`}><TerminalPane workspaceReady={workspaceReady} platform={platform} /></div>)}
    {sessions.length === 0 && <p>Nenhuma sessão. Use Nova sessão para abrir outra.</p>}
  </section>
}

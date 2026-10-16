import '../monaco'
import '@xterm/xterm/css/xterm.css'
import { MessageSquare } from 'lucide-react'
import { App } from '../App'
import { GoogleTasksDock } from '../GoogleTasksDock'
import type { WebRoute } from './experience'

interface WorkbenchProps {
  onNavigate: (route: WebRoute) => void
}

/**
 * Workbench completo (superfície clássica) disponível em `/workbench`.
 * Progressive disclosure: o Studio chat-first é a entrada padrão; nenhuma
 * capacidade foi removida — editor, explorer, deck e caixa-preta seguem aqui.
 */
export const Workbench = ({ onNavigate }: WorkbenchProps): React.JSX.Element => (
  <div className="wx-workbench-host">
    <App />
    <GoogleTasksDock />
    <button className="wx-back-to-chat" onClick={() => onNavigate('studio')} title="Voltar ao Studio conversacional">
      <MessageSquare size={14} aria-hidden="true" /> Voltar ao chat
    </button>
  </div>
)

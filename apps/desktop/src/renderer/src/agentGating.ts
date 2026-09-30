import type { AIEvent, AIProviderKind, AIStatus, Mode } from '@tupiniquim/contracts'

/**
 * Regras centrais de disponibilidade do agente compartilhadas entre a
 * superfície Desktop (App.tsx) e a superfície Web chat-first (StudioShell).
 * Extraídas de App.tsx sem alteração semântica — Issue #25 (Wave 17)
 * permanece a fonte normativa do comportamento fail-closed.
 */

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  turnId: string | null
  complete: boolean
  provider: AIProviderKind | null
}

export const providerLabel = (provider: AIProviderKind | null): string =>
  provider === 'ollama' ? 'OLLAMA' : provider === 'codex-app-server' ? 'CODEX' : provider === 'cloudflare-workers-ai' ? 'WORKERS AI' : 'AGENTE'

export const providerDisplayName = (provider: AIProviderKind): string =>
  provider === 'ollama' ? 'Ollama local' : provider === 'codex-app-server' ? 'Codex App Server' : 'Cloudflare Workers AI'

export const providerUsesSelectableModel = (provider: AIProviderKind | null | undefined): boolean =>
  provider === 'ollama' || provider === 'cloudflare-workers-ai'

// ── Issue #25 (Wave 17) — fronteira de envio FAIL-CLOSED (escopo por modo) ──
// Readiness de provider (state === 'READY') é requisito somente das OPERAÇÕES
// QUE REALMENTE ENVIAM AO PROVIDER:
//   - Modos que enviam ao agente (CHAT/EXECUTE/REVIEW/DEBUG e demais que
//     chamam window.studio.agent.send): botão Enviar, Ctrl+Enter e a guarda do
//     sendToAgent() exigem provider READY (Codex: state READY; Ollama: READY +
//     modelo explicitamente selecionado);
//   - PLAN: planning.create() roda INDEPENDENTE do provider; apenas a etapa
//     que chama window.studio.agent.send() (geração de proposta) exige
//     readiness — guarda posicionada imediatamente antes da chamada;
//   - Modos independentes de provider (VISUAL/PROMPT/RESEARCH) usam as
//     próprias fronteiras Tupiniquim (visual.statuses / prompt.* / research.*)
//     e NUNCA chamam agent.send: readiness de provider não os bloqueia.
//
// Provider em estado != READY (AUTH_REQUIRED, DISCONNECTED, STARTING, ERROR,
// STOPPED, NOT_INSTALLED) NUNCA inicia turno: as guardas executam ANTES de
// adicionar a mensagem do usuário, ANTES de limpar o textarea, ANTES de
// sending=true e ANTES de window.studio.agent.send() — logo, antes de criar
// thread, alterar activeThreadId ou alterar a sessão.
//
// A troca de provider continua explícita pelo usuário — nenhum fallback
// automático.
export const CODEX_AUTH_REQUIRED_MESSAGE = 'Codex requer autenticação no runtime isolado do Tupiniquim.'
export const OLLAMA_MODEL_REQUIRED_MESSAGE = 'Selecione um modelo Ollama local antes de enviar.'

export const sendBlockedReason = (status: AIStatus | null): string => {
  if (status === null) return 'Provider ainda não reportou estado. Envio bloqueado até READY.'
  if (status.state === 'AUTH_REQUIRED') {
    return status.provider === 'codex-app-server' ? CODEX_AUTH_REQUIRED_MESSAGE : `${providerDisplayName(status.provider)} requer autenticação; envio bloqueado.`
  }
  const label = providerDisplayName(status.provider)
  return `${label} indisponível no momento (estado ${status.state}). Envio bloqueado até READY.`
}

/**
 * Readiness ESTRITA para operações que realmente enviam ao provider — a
 * última barreira, posicionada imediatamente antes de cada chamada a
 * window.studio.agent.send(). Retorna a razão de bloqueio ou null quando o
 * turno pode iniciar (state READY; Ollama: + modelo explicitamente selecionado).
 */
export const providerTurnBlockReason = (status: AIStatus | null, selectedModel: string): string | null => {
  if (status === null || status.state !== 'READY') return sendBlockedReason(status)
  if (providerUsesSelectableModel(status.provider) && selectedModel === '') {
    return status.provider === 'ollama' ? OLLAMA_MODEL_REQUIRED_MESSAGE : 'Selecione um modelo compatível com Workers AI antes de enviar.'
  }
  return null
}

// Modos INDEPENDENTES de provider (funcionalidades Tupiniquim com fronteiras
// próprias — nunca chamam window.studio.agent.send). PLAN entra aqui no nível
// do composer: o plano é criado/persistido independentemente; a etapa
// provider-backed de proposta é guardada internamente antes do agent.send.
export const PROVIDER_INDEPENDENT_MODES: ReadonlySet<Mode> = new Set<Mode>(['VISUAL', 'PROMPT', 'RESEARCH', 'PLAN'])

export const isProviderBackedMode = (mode: Mode): boolean => !PROVIDER_INDEPENDENT_MODES.has(mode)

export interface SendDecision {
  allowed: boolean
  /** Razão de indisponibilidade (provider/modelo) para exibição; null em bloqueios neutros (entrada vazia, sem workspace, turno em voo). */
  blockReason: string | null
}

/**
 * Capability do composer (botão Enviar + Ctrl+Enter + guarda de topo do
 * sendToAgent) CONSCIENTE DO MODO ATUAL:
 * - modo provider-backed → provider READY é obrigatório (fail-closed);
 * - modo independente → somente workspace, mensagem e turno livre.
 */
export const evaluateSend = (input: {
  status: AIStatus | null
  hasWorkspace: boolean
  message: string
  isSending: boolean
  selectedModel: string
  mode: Mode
}): SendDecision => {
  const message = input.message.trim()
  if (message === '') return { allowed: false, blockReason: null }
  if (!input.hasWorkspace) return { allowed: false, blockReason: null }
  if (input.isSending) return { allowed: false, blockReason: null }
  if (isProviderBackedMode(input.mode)) {
    const providerReason = providerTurnBlockReason(input.status, input.selectedModel)
    if (providerReason !== null) return { allowed: false, blockReason: providerReason }
  }
  return { allowed: true, blockReason: null }
}

export const handleAgentEvent = (
  event: AIEvent,
  setStatus: React.Dispatch<React.SetStateAction<AIStatus | null>>,
  setConversation: React.Dispatch<React.SetStateAction<ConversationMessage[]>>,
  setSending: React.Dispatch<React.SetStateAction<boolean>>,
  getProvider: () => AIProviderKind | null
): void => {
  if (event.kind === 'STATUS') {
    void window.studio.agent.status().then((result) => { if (result.ok) setStatus(result.value) })
  } else if (event.kind === 'MESSAGE_DELTA') {
    setConversation((current) => {
      const last = current.at(-1)
      if (last?.role === 'assistant' && last.turnId === (event.turnId ?? null) && !last.complete) {
        return [...current.slice(0, -1), { ...last, text: `${last.text}${event.text ?? ''}` }]
      }
      return [...current, { id: event.id, role: 'assistant', text: event.text ?? '', turnId: event.turnId ?? null, complete: false, provider: getProvider() }]
    })
  } else if (event.kind === 'TURN_COMPLETED') {
    setConversation((current) => current.map((message) => message.turnId === (event.turnId ?? null) ? { ...message, complete: true } : message))
    setSending(false)
  } else if (event.kind === 'ERROR') {
    setConversation((current) => [...current, { id: event.id, role: 'error', text: event.detail ?? 'Falha no Codex App Server.', turnId: event.turnId ?? null, complete: true, provider: getProvider() }])
    setSending(false)
  }
}

import type { AIProviderKind, AIStatus } from '@tupiniquim/contracts'

/**
 * Wave 17 — Issue #25 (fronteira de autenticação/disponibilidade do Codex).
 *
 * REGRA ÚNICA de capacidade de envio, derivada do estado REAL do provider
 * observado pela UI (`aiStatus`). É a única autoridade usada por:
 *
 * - `disabled` do botão Enviar;
 * - Ctrl+Enter no composer;
 * - guarda interna de `sendToAgent()` (o envio nunca depende do DOM).
 *
 * Fail-closed por construção: `null`, `AUTH_REQUIRED`, `DISCONNECTED`,
 * `STARTING`, `BUSY`, `ERROR`, `STOPPED`, `NOT_INSTALLED` e qualquer estado
 * futuro diferente de `READY` bloqueiam o envio. Nenhum estado é interpretado
 * como "provavelmente pronto" e nenhum retry/relogin é iniciado pelo renderer.
 *
 * Não há fallback automático entre providers: a regra considera APENAS o
 * provider selecionado e o seu estado. Um Codex bloqueado nunca libera envio
 * para o Ollama (e vice-versa), e a troca de provider/model continua sendo uma
 * decisão explícita do usuário.
 */

/**
 * Mensagem explícita do bloqueio de autenticação do Codex. O runtime isolado do
 * Tupiniquim (`CODEX_HOME` em `dataRoot/codex-home`) não herda as credenciais do
 * perfil normal do Codex: a autenticação precisa acontecer nesse runtime, sem
 * copiar `auth.json`, tokens, cookies ou API keys entre homes.
 */
export const codexAuthRequiredReason = 'Codex requer autenticação no runtime isolado do Tupiniquim.'

export interface AgentSendCapability {
  /** `true` somente com o provider selecionado `READY` (e, no Ollama, com modelo explícito). */
  readonly canSend: boolean
  /** Motivo do bloqueio; `null` quando `canSend` é `true`. */
  readonly reason: string | null
  /** `true` quando o bloqueio é de autenticação — nunca resolvido por retry do renderer. */
  readonly requiresAuthentication: boolean
}

const providerDisplayName = (provider: AIProviderKind): string =>
  provider === 'ollama' ? 'Ollama local' : 'Codex App Server'

const blocked = (reason: string, requiresAuthentication = false): AgentSendCapability => ({
  canSend: false,
  reason,
  requiresAuthentication
})

export const resolveAgentSendCapability = (
  status: AIStatus | null,
  selectedLocalModel: string
): AgentSendCapability => {
  // Sem estado observado não existe capacidade de envio (nunca "otimista").
  if (status === null) return blocked('O estado do provider ainda não foi observado; o envio permanece bloqueado.')

  if (status.state === 'AUTH_REQUIRED') {
    return blocked(
      status.provider === 'codex-app-server'
        ? codexAuthRequiredReason
        : `${providerDisplayName(status.provider)} requer autenticação no runtime isolado do Tupiniquim.`,
      true
    )
  }

  // READY é a ÚNICA porta de envio: BUSY/STARTING/ERROR/STOPPED/DISCONNECTED/NOT_INSTALLED bloqueiam.
  if (status.state !== 'READY') {
    return blocked(`${providerDisplayName(status.provider)} não está READY (${status.state}); o envio permanece bloqueado.`)
  }

  // Ollama continua exigindo READY + modelo explicitamente selecionado.
  if (status.provider === 'ollama' && selectedLocalModel.trim() === '') {
    return blocked('Selecione explicitamente um modelo local do Ollama antes de enviar.')
  }

  return { canSend: true, reason: null, requiresAuthentication: false }
}

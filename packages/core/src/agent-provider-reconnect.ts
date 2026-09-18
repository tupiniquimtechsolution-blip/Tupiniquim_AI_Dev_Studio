import type { AIStatus } from '@tupiniquim/contracts'
import type { PrivilegedRuntimeGate } from './tupiniquim-session'

export interface ProviderReconnectDependencies {
  gate: PrivilegedRuntimeGate
  currentStatus(): AIStatus
  connect(): Promise<AIStatus>
}

/**
 * Issue #25 (dogfood pós-auth) — reconexão EXPLÍCITA do provider JÁ selecionado.
 *
 * Problema real do dogfood: após restart do app com Codex já selecionado, o
 * estado inicial DISCONNECTED nunca convergia sozinho para READY — o handler
 * de `agent.provider.select` retornava apenas o status quando o provider
 * pedido era o MESMO já selecionado (nenhum caminho de startup executava
 * `connect()`), exigindo o ritual artificial Ollama → Codex.
 *
 * Esta função é o caminho determinístico de reconexão do provider corrente,
 * usado tanto pela re-seleção explícita do MESMO provider (handler IPC) quanto
 * pelo startup do renderer (uma única tentativa, via `agent.provider.select`):
 *
 * - Provider ATIVO (READY/BUSY): retorna o status corrente SEM chamar
 *   `connect()` — nenhuma reinicialização desnecessária de processo/conexão;
 * - Qualquer outro estado (DISCONNECTED/STARTING/ERROR/STOPPED/NOT_INSTALLED/
 *   AUTH_REQUIRED): executa `connect()` SOB o mesmo protocolo de gate da troca
 *   de provider (`beginProviderSelect`/`endProviderSelect`) — nunca em
 *   paralelo com send em voo, troca de provider ou shutdown selado, que são
 *   recusados fail-closed pelo próprio gate;
 * - A TERMINALIDADE do estado é autoridade do ADAPTER: o adapter Codex trata
 *   AUTH_REQUIRED como terminal de `connect()` (retorna sem re-spawnar, sem
 *   login, sem retry) — fail-closed preservado; o Ollama apenas re-sonda o
 *   runtime local (modelo selecionado preservado pelo adapter);
 * - A identidade do provider NÃO muda: nenhum switch, nenhuma invalidação de
 *   propostas, nenhum toque na sessão/modelo/workspace/thread — isso continua
 *   exclusivo do caminho de TROCA de provider.
 */
export const reconnectSelectedProvider = async (dependencies: ProviderReconnectDependencies): Promise<AIStatus> => {
  const current = dependencies.currentStatus()
  if (current.state === 'READY' || current.state === 'BUSY') return current
  dependencies.gate.beginProviderSelect()
  try {
    return await dependencies.connect()
  } finally {
    dependencies.gate.endProviderSelect()
  }
}

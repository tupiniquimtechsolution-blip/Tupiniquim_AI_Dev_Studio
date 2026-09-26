import { describe, expect, it } from 'vitest'
import type { AIStatus } from '@tupiniquim/contracts'
import {
  PrivilegedRuntimeGate,
  agentRuntimeBusyMessage,
  agentRuntimeSealedMessage,
  reconnectSelectedProvider
} from './index'

/**
 * Issue #25 (dogfood pós-auth) — unidade da reconexão explícita do provider JÁ
 * selecionado (requisitos A/B/C/D/E da correção):
 *
 * A) DISCONNECTED + runtime livre → connect() é chamado sob o gate → READY;
 * B) READY/BUSY → connect() NÃO é chamado (nenhuma reinicialização);
 * C) runtimeGate travado (send em voo) ou selado (shutdown) → recusado
 *    fail-closed, SEM chamar connect();
 * D) AUTH_REQUIRED delega a terminalidade ao adapter (connect é no-op que
 *    devolve o estado terminal — sem login, sem retry);
 * E) a identidade do provider permanece a MESMA (a função só reconecta o
 *    provider corrente; nenhum switch é executado aqui).
 *
 * A integração com o adapter Codex REAL (fixture controlada) e o E2E Electron
 * (startup do processo real) complementam esta unidade.
 */

const statusWithState = (state: AIStatus['state']): AIStatus => ({
  provider: 'codex-app-server',
  state,
  account: 'NONE',
  version: '1.0.0-test',
  activeThreadId: null,
  activeTurnId: null,
  detail: null
})

interface FakeAgent {
  status: AIStatus
  connectCalls: number
}

const fakeAgent = (state: AIStatus['state']): FakeAgent => ({ status: statusWithState(state), connectCalls: 0 })

/**
 * Connect fake síncrono que devolve Promise (espelha o adapter Codex real:
 * connect() de estado terminal retorna o status corrente sem spawnar nada).
 */
const fakeConnect = (agent: FakeAgent, nextState?: AIStatus['state']): (() => Promise<AIStatus>) => () => {
  agent.connectCalls += 1
  if (nextState !== undefined) agent.status = statusWithState(nextState)
  return Promise.resolve(agent.status)
}

describe('reconnectSelectedProvider (Issue #25 — provider já selecionado)', () => {
  it('A) DISCONNECTED com runtime livre executa connect() sob o gate e devolve READY', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('DISCONNECTED')
    const status = await reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent, 'READY')
    })
    expect(agent.connectCalls).toBe(1)
    expect(status.state).toBe('READY')
    // Gate liberado após a reconexão (nenhuma transição presa).
    expect(gate.locked()).toBe(false)
  })

  it('B) READY não chama connect() — nenhuma reinicialização de processo/conexão', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('READY')
    const status = await reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent)
    })
    expect(agent.connectCalls).toBe(0)
    expect(status.state).toBe('READY')
    expect(gate.locked()).toBe(false)
  })

  it('B) BUSY não chama connect() — turno em andamento não é interrompido', async () => {
    const gate = new PrivilegedRuntimeGate(() => true)
    const agent = fakeAgent('BUSY')
    const status = await reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent)
    })
    expect(agent.connectCalls).toBe(0)
    expect(status.state).toBe('BUSY')
  })

  it('C) runtimeGate travado por send em voo recusa a reconexão SEM chamar connect()', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('DISCONNECTED')
    gate.beginSend()
    try {
      await expect(reconnectSelectedProvider({
        gate,
        currentStatus: () => agent.status,
        connect: fakeConnect(agent, 'READY')
      })).rejects.toThrow(agentRuntimeBusyMessage)
      expect(agent.connectCalls).toBe(0)
    } finally {
      gate.endSend()
    }
    expect(gate.locked()).toBe(false)
  })

  it('C) runtimeGate travado por transição de provider recusa a reconexão fail-closed', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('DISCONNECTED')
    gate.beginProviderSelect()
    try {
      await expect(reconnectSelectedProvider({
        gate,
        currentStatus: () => agent.status,
        connect: fakeConnect(agent, 'READY')
      })).rejects.toThrow(agentRuntimeBusyMessage)
      expect(agent.connectCalls).toBe(0)
    } finally {
      gate.endProviderSelect()
    }
    expect(gate.locked()).toBe(false)
  })

  it('C) runtimeGate selado para shutdown recusa a reconexão fail-closed', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('DISCONNECTED')
    gate.sealForShutdown()
    await expect(reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent, 'READY')
    })).rejects.toThrow(agentRuntimeSealedMessage)
    expect(agent.connectCalls).toBe(0)
  })

  it('D) AUTH_REQUIRED delega a terminalidade ao adapter: connect é no-op e o estado permanece fail-closed', async () => {
    const gate = new PrivilegedRuntimeGate(() => false)
    const agent = fakeAgent('AUTH_REQUIRED')
    // O adapter Codex real retorna o status terminal SEM re-spawnar/login.
    const status = await reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent)
    })
    expect(status.state).toBe('AUTH_REQUIRED')
    expect(agent.connectCalls).toBe(1)
    expect(gate.locked()).toBe(false)
  })

  it('E) STARTING com provider busy recusa fail-closed ANTES de duplicar conexão (defesa em profundidade)', async () => {
    const gate = new PrivilegedRuntimeGate(() => true)
    const agent = fakeAgent('STARTING')
    // agentBusy() === true (STARTING) → o gate recusa ANTES de duplicar conexão;
    // no handler real o locked() de entrada já recusa com a mensagem amigável.
    await expect(reconnectSelectedProvider({
      gate,
      currentStatus: () => agent.status,
      connect: fakeConnect(agent, 'READY')
    })).rejects.toThrow(agentRuntimeBusyMessage)
    expect(agent.connectCalls).toBe(0)
  })
})

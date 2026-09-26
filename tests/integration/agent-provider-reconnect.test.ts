import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CodexAppServerAdapter } from '@tupiniquim/adapters'
import type { AIEvent, AIStatus } from '@tupiniquim/contracts'
import {
  PrivilegedRuntimeGate,
  agentRuntimeBusyMessage,
  agentRuntimeSealedMessage,
  reconnectSelectedProvider
} from '@tupiniquim/core'

/**
 * Issue #25 (dogfood pós-auth) — integração da reconexão explícita do provider
 * JÁ selecionado, com o adapter Codex REAL (fixtures controladas por stdio,
 * sem credencial ChatGPT real) e o PrivilegedRuntimeGate REAL:
 *
 * A) processo novo + provider Codex já selecionado + status inicial
 *    DISCONNECTED + credencial válida (fixture autenticada) → conexão
 *    explícita do MESMO provider → READY, SEM o ritual Ollama → Codex;
 * B) já READY → a re-seleção do MESMO provider NÃO reinicia o processo
 *    (nenhum novo spawn do app-server);
 * D) credencial ausente (fixture NÃO autenticada) → converge fail-closed para
 *    AUTH_REQUIRED (terminal: sem retry, sem login) e permanece assim;
 * C) runtimeGate travado (send em voo) ou selado (shutdown) → recusado
 *    fail-closed, SEM spawnar processo algum;
 * E) nenhuma troca automática de provider: a reconexão opera sobre o MESMO
 *    adapter/provider — o status retornado nunca muda a identidade.
 *
 * O E2E Electron (tests/e2e/desktop.spec.ts) prova o mesmo lifecycle no
 * processo REAL (startup do app + IPC canônico) na máquina Windows F:.
 */

const projectRoot = process.cwd()
const adapters: CodexAppServerAdapter[] = []
const dataRoots: string[] = []

const isolatedDataRoot = async (prefix: string): Promise<string> => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), prefix))
  dataRoots.push(dataRoot)
  return dataRoot
}

const startingSpawns = (events: AIEvent[]): number =>
  events.filter((event) => event.kind === 'STATUS' && event.status === 'STARTING').length

const buildAdapter = (fixture: string, dataRoot: string, events: AIEvent[]): CodexAppServerAdapter => {
  const adapter = new CodexAppServerAdapter({
    // CODEX_HOME isolado (dataRoot temporário exclusivo do teste) — nenhuma
    // credencial real é lida ou copiada; a fixture controla a conta.
    dataRoot,
    projectRoot,
    getWorkspaceRoot: () => projectRoot,
    onEvent: (event) => events.push(event),
    codexPath: process.execPath,
    serverArgs: [path.join(projectRoot, 'tests', 'fixtures', fixture)],
    skipApiKeyLogin: true
  })
  adapters.push(adapter)
  return adapter
}

afterAll(async () => {
  for (const adapter of adapters.splice(0)) await adapter.close().catch(() => undefined)
  for (const dataRoot of dataRoots.splice(0)) await rm(dataRoot, { recursive: true, force: true })
}, 30_000)

describe('reconnectSelectedProvider com adapter Codex real (Issue #25 — dogfood pós-auth)', () => {
  it('A) DISCONNECTED + credencial válida: reconexão explícita do MESMO provider converge para READY sem ritual', async () => {
    const events: AIEvent[] = []
    const adapter = buildAdapter('fake-codex-app-server.mjs', await isolatedDataRoot('tupiniquim-reconnect-auth-'), events)
    // Estado inicial de processo novo: DISCONNECTED (o dogfood real).
    expect(adapter.status().state).toBe('DISCONNECTED')
    const gate = new PrivilegedRuntimeGate(() => false)
    const status: AIStatus = await reconnectSelectedProvider({
      gate,
      currentStatus: () => adapter.status(),
      connect: () => adapter.connect()
    })
    expect(status.state).toBe('READY')
    expect(status.provider).toBe('codex-app-server')
    expect(adapter.status().state).toBe('READY')
    expect(startingSpawns(events)).toBe(1)
    expect(gate.locked()).toBe(false)
  }, 30_000)

  it('B) já READY: re-seleção do MESMO provider NÃO reinicia o processo/conexão', async () => {
    const events: AIEvent[] = []
    const adapter = buildAdapter('fake-codex-app-server.mjs', await isolatedDataRoot('tupiniquim-reconnect-ready-'), events)
    const gate = new PrivilegedRuntimeGate(() => false)
    await reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() })
    expect(adapter.status().state).toBe('READY')
    const spawnsAfterFirst = startingSpawns(events)
    const status = await reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() })
    expect(status.state).toBe('READY')
    // Nenhum novo spawn: o adapter ativo não é reiniciado desnecessariamente.
    expect(startingSpawns(events)).toBe(spawnsAfterFirst)
    expect(gate.locked()).toBe(false)
  }, 30_000)

  it('D) credencial ausente: converge fail-closed para AUTH_REQUIRED e permanece terminal (sem retry/login)', async () => {
    const events: AIEvent[] = []
    const adapter = buildAdapter('fake-codex-app-server-unauthenticated.mjs', await isolatedDataRoot('tupiniquim-reconnect-unauth-'), events)
    expect(adapter.status().state).toBe('DISCONNECTED')
    const gate = new PrivilegedRuntimeGate(() => false)
    const status = await reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() })
    expect(status.state).toBe('AUTH_REQUIRED')
    const spawnsAfterFirst = startingSpawns(events)
    // Nova tentativa explícita: o adapter trata AUTH_REQUIRED como terminal —
    // nenhum novo spawn, nenhum login, nenhum loop de reconexão.
    const again = await reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() })
    expect(again.state).toBe('AUTH_REQUIRED')
    expect(startingSpawns(events)).toBe(spawnsAfterFirst)
    expect(gate.locked()).toBe(false)
  }, 30_000)

  it('C) runtimeGate travado por send em voo: recusa fail-closed SEM spawnar processo', async () => {
    const events: AIEvent[] = []
    const adapter = buildAdapter('fake-codex-app-server.mjs', await isolatedDataRoot('tupiniquim-reconnect-locked-'), events)
    const gate = new PrivilegedRuntimeGate(() => false)
    gate.beginSend()
    try {
      await expect(reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() }))
        .rejects.toThrow(agentRuntimeBusyMessage)
      expect(adapter.status().state).toBe('DISCONNECTED')
      expect(startingSpawns(events)).toBe(0)
    } finally {
      gate.endSend()
    }
    expect(gate.locked()).toBe(false)
  }, 30_000)

  it('C) runtimeGate selado para shutdown: recusa fail-closed SEM spawnar processo', async () => {
    const events: AIEvent[] = []
    const adapter = buildAdapter('fake-codex-app-server.mjs', await isolatedDataRoot('tupiniquim-reconnect-sealed-'), events)
    const gate = new PrivilegedRuntimeGate(() => false)
    gate.sealForShutdown()
    await expect(reconnectSelectedProvider({ gate, currentStatus: () => adapter.status(), connect: () => adapter.connect() }))
      .rejects.toThrow(agentRuntimeSealedMessage)
    expect(adapter.status().state).toBe('DISCONNECTED')
    expect(startingSpawns(events)).toBe(0)
  }, 30_000)
})

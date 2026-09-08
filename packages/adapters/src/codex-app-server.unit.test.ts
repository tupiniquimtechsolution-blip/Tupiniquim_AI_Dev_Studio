import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AIEvent } from '@tupiniquim/contracts'
import { CodexAppServerAdapter, maxCodexTerminalTurns } from './codex-app-server'

const delay = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 20))
const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return
    await delay()
  }
  throw new Error('Timeout aguardando estado do adapter Codex.')
}

const fixture = path.join(process.cwd(), 'tests', 'fixtures', 'fake-codex-app-server-programmable.mjs')
const existingImmediateFixture = path.join(process.cwd(), 'tests', 'fixtures', 'fake-codex-app-server.mjs')

let dataRoot = ''

afterEach(async () => {
  if (dataRoot !== '') await rm(dataRoot, { recursive: true, force: true })
  dataRoot = ''
})

const createAdapter = async (events: AIEvent[], serverArgs = [fixture]): Promise<CodexAppServerAdapter> => {
  dataRoot = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-codex-unit-'))
  const adapter = new CodexAppServerAdapter({
    dataRoot,
    projectRoot: process.cwd(),
    getWorkspaceRoot: () => process.cwd(),
    onEvent: (event) => events.push(event),
    codexPath: process.execPath,
    serverArgs,
    skipApiKeyLogin: true
  })
  await adapter.connect()
  return adapter
}

describe('CodexAppServerAdapter — monotonicidade do turno', () => {
  it('completion-before-send-return deixa o status final READY', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events, [existingImmediateFixture])
    try {
      const reference = await adapter.send({ message: 'turno imediato', mode: 'CHAT' })
      expect(reference.turnId).toMatch(/^turn-controlled-/)
      await waitFor(() => adapter.status().state === 'READY' && adapter.status().activeTurnId === null)
      const completedAt = events.findIndex((event) => event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId)
      expect(completedAt).toBeGreaterThanOrEqual(0)
      expect(events.slice(completedAt + 1).some((event) => event.kind === 'STATUS' && event.status === 'BUSY' && event.turnId === reference.turnId)).toBe(false)
      await delay()
      expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
    } finally {
      await adapter.close()
    }
  })

  it('fluxo normal marca BUSY até o turn/completed', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events)
    try {
      const reference = await adapter.send({ message: 'TUPINIQUIM_HOLD_TURN', mode: 'CHAT' })
      expect(adapter.status()).toMatchObject({ state: 'BUSY', activeTurnId: reference.turnId })
      await waitFor(() => adapter.status().state === 'READY')
      expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
      expect(events.some((event) => event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId)).toBe(true)
    } finally {
      await adapter.close()
    }
  })

  it('ERROR/RETRYING não é terminal e só READY no TURN_COMPLETED', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events)
    try {
      const reference = await adapter.send({ message: 'TUPINIQUIM_RETRY_THEN_COMPLETE', mode: 'CHAT' })
      expect(adapter.status()).toMatchObject({ state: 'BUSY', activeTurnId: reference.turnId })
      await waitFor(() => events.some((event) => event.kind === 'ERROR' && event.status === 'RETRYING' && event.turnId === reference.turnId))
      expect(adapter.status()).toMatchObject({ state: 'BUSY', activeTurnId: reference.turnId })
      await waitFor(() => adapter.status().state === 'READY')
      expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
      expect(events.some((event) => event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId)).toBe(true)
    } finally {
      await adapter.close()
    }
  })

  it('ERROR/FAILED seguido de TURN_COMPLETED/FAILED termina READY sem BUSY tardio', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events)
    try {
      const reference = await adapter.send({ message: 'TUPINIQUIM_FAIL_THEN_COMPLETE', mode: 'CHAT' })
      await waitFor(() => events.some((event) => event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId))
      expect(events.some((event) => event.kind === 'ERROR' && event.status === 'FAILED' && event.turnId === reference.turnId)).toBe(true)
      expect(events.some((event) => event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId && event.status?.toLowerCase() === 'failed')).toBe(true)
      expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
      await delay()
      expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
    } finally {
      await adapter.close()
    }
  })
})

describe('CodexAppServerAdapter — terminalTurns bounded (Incremento 4/4)', () => {
  it('65+ conclusões preservam somente as 64 mais recentes, com eviction oldest-first', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events, [existingImmediateFixture])
    try {
      expect(maxCodexTerminalTurns).toBe(64)
      // 66 turns concluídos pelo servidor controlado (imediato).
      let lastTurnId = ''
      for (let index = 1; index <= 66; index += 1) {
        const reference = await adapter.send({ message: `turno ${String(index)}`, mode: 'CHAT' })
        lastTurnId = reference.turnId
      }
      // Espera a ÚLTIMA conclusão chegar: as 66 conclusões resultam em
      // exatamente 64 ids retidos (eviction das 2 mais antigas).
      await waitFor(() => adapter.terminalTurnIds().includes(lastTurnId))
      const retained = adapter.terminalTurnIds()
      expect(retained).toHaveLength(64)
      // Eviction oldest-first determinística: as duas mais antigas saíram...
      expect(retained).not.toContain('turn-controlled-1')
      expect(retained).not.toContain('turn-controlled-2')
      // ...as 64 mais recentes ficaram, em ordem de inserção.
      expect(retained[0]).toBe('turn-controlled-3')
      expect(retained.at(-1)).toBe('turn-controlled-66')
      // A sonda devolve cópia estável (o set interno não vaza por referência).
      expect(adapter.terminalTurnIds()).toEqual(retained)
    } finally {
      await adapter.close()
    }
  })

  it('close() limpa o lifecycle efêmero — novo adapter (pós-restart) começa vazio', async () => {
    const events: AIEvent[] = []
    const adapter = await createAdapter(events, [existingImmediateFixture])
    const reference = await adapter.send({ message: 'turno único', mode: 'CHAT' })
    await waitFor(() => adapter.terminalTurnIds().includes(reference.turnId))
    expect(adapter.terminalTurnIds()).toEqual([reference.turnId])
    await adapter.close()
    expect(adapter.terminalTurnIds()).toEqual([])
  })
})

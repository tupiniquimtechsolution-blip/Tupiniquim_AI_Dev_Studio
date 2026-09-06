import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AIEvent } from '@tupiniquim/contracts'
import { CodexAppServerAdapter } from './codex-app-server'

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
      expect(events.some((event) => event.kind === 'ERROR' && event.status === 'RETRYING' && event.turnId === reference.turnId)).toBe(true)
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

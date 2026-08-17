import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CodexAppServerAdapter, findCodexExecutable, type AIHistoryRepository } from '@tupiniquim/adapters'
import type { AIEvent, AIThread, AITurn } from '@tupiniquim/contracts'

const projectRoot = process.cwd()
const dataRoot = path.join('D:\\CODEX\\Tupiniquim-AI-Dev-Studio.data', 'tests', 'codex-app-server')
let adapter: CodexAppServerAdapter | null = null
const events: AIEvent[] = []

class MemoryAIHistory implements AIHistoryRepository {
  public readonly threads: AIThread[] = []
  public readonly turns: AITurn[] = []
  public readonly recordedEvents: AIEvent[] = []

  public putAIThread(thread: AIThread): Promise<void> { this.threads.push(thread); return Promise.resolve() }
  public putAITurn(turn: AITurn): Promise<void> { this.turns.push(turn); return Promise.resolve() }
  public appendAIEvent(event: AIEvent): Promise<void> { this.recordedEvents.push(event); return Promise.resolve() }
}

afterAll(async () => {
  await adapter?.close()
}, 30_000)

describe('CodexAppServerAdapter', () => {
  it('negocia o protocolo estável por stdio e detecta autenticação sem expor credenciais', async () => {
    await mkdir(dataRoot, { recursive: true })
    adapter = new CodexAppServerAdapter({
      dataRoot,
      projectRoot,
      getWorkspaceRoot: () => projectRoot,
      onEvent: (event) => events.push(event),
      codexPath: await findCodexExecutable(),
      skipApiKeyLogin: true
    })
    const status = await adapter.connect()
    expect(['READY', 'AUTH_REQUIRED']).toContain(status.state)
    expect(status.version).toMatch(/codex/iu)
    expect(status.provider).toBe('codex-app-server')
    expect(events.some((event) => event.kind === 'STATUS')).toBe(true)
    expect(JSON.stringify(events)).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/u)
  }, 60_000)

  it.runIf(process.env.TUPINIQUIM_LIVE_CODEX_TEST === '1')('recebe streaming de um turno real e conclui sem mutações', async () => {
    if (adapter === null) throw new Error('Adapter não inicializado.')
    const before = events.length
    const reference = await adapter.send({ message: 'Responda somente com TUPINIQUIM_CODEX_OK.', mode: 'CHAT' })
    await new Promise<void>((resolve, reject) => {
      const poll = setInterval(() => {
        if (events.some((event, index) => index >= before && event.kind === 'TURN_COMPLETED' && event.turnId === reference.turnId)) {
          clearInterval(poll)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)
      const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('Timeout aguardando conclusão do turno Codex.')) }, 90_000)
    })
    const text = events.filter((event, index) => index >= before && event.kind === 'MESSAGE_DELTA' && event.turnId === reference.turnId).map((event) => event.text ?? '').join('')
    const evidence = events.slice(before).map((event) => ({ kind: event.kind, status: event.status, detail: event.detail, textLength: event.text?.length ?? 0 }))
    if (text === '') {
      expect(evidence.some((event) => event.status === 'FAILED' && event.detail === 'OpenAI API sem créditos disponíveis para este projeto.')).toBe(true)
    } else expect(text).toContain('TUPINIQUIM_CODEX_OK')
  }, 120_000)

  it('persiste o ciclo JSONL controlado e retoma uma thread sem conteúdo bruto', async () => {
    const history = new MemoryAIHistory()
    const controlled = new CodexAppServerAdapter({
      dataRoot,
      projectRoot,
      getWorkspaceRoot: () => projectRoot,
      onEvent: (event) => events.push(event),
      codexPath: process.execPath,
      serverArgs: [path.join(projectRoot, 'tests', 'fixtures', 'fake-codex-app-server.mjs')],
      skipApiKeyLogin: true,
      history
    })
    await controlled.connect()
    const reference = await controlled.send({ message: 'entrada confidencial que não deve persistir', mode: 'CHAT' })
    await controlled.interrupt(reference)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(history.threads).toMatchObject([{ id: reference.threadId, model: 'codex-test-model' }])
    expect(history.turns).toMatchObject([{ id: reference.turnId, threadId: reference.threadId, mode: 'CHAT' }])
    expect(history.recordedEvents.some((event) => event.kind === 'MESSAGE_DELTA' && event.text === 'CONTROLLED_STREAM_OK')).toBe(true)
    expect(JSON.stringify(history)).not.toContain('entrada confidencial')
    await controlled.close()

    const resumed = new CodexAppServerAdapter({
      dataRoot,
      projectRoot,
      getWorkspaceRoot: () => projectRoot,
      onEvent: (event) => events.push(event),
      codexPath: process.execPath,
      serverArgs: [path.join(projectRoot, 'tests', 'fixtures', 'fake-codex-app-server.mjs')],
      skipApiKeyLogin: true,
      history
    })
    await resumed.connect()
    const resumedReference = await resumed.send({ message: 'retomar', mode: 'CHAT', threadId: reference.threadId })
    expect(resumedReference.threadId).toBe(reference.threadId)
    await resumed.close()
  }, 30_000)
})

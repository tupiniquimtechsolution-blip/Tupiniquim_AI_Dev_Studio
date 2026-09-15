import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CodexAppServerAdapter, findCodexExecutable, type AIHistoryRepository } from '@tupiniquim/adapters'
import type { AIEvent, AIThread, AITurn } from '@tupiniquim/contracts'

const projectRoot = process.cwd()
const dataRoot = path.join('F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data', 'tests', 'codex-app-server')
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
    expect(status.version).toMatch(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/u)
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

/**
 * Wave 17 — Issue #25 (fronteira de autenticação do Codex, fail-closed).
 *
 * O runtime isolado do Tupiniquim (`CODEX_HOME` dentro de `dataRoot`,
 * `codex home` vazio, sem herdar o perfil normal do Codex) pode responder
 * `AUTH_REQUIRED`. Nesse estado o adapter precisa recusar o envio ANTES de
 * qualquer efeito observável: sem thread nova, sem turno, sem evento público
 * e sem tráfego `thread/start`/`turn/start` no protocolo JSONL.
 *
 * Evidência de isolamento exigida pela Issue: nada de `auth.json`, tokens,
 * cookies ou API keys é copiado para o home isolado durante a recusa.
 */
describe('CodexAppServerAdapter — fronteira de autenticação fail-closed', () => {
  it('AUTH_REQUIRED recusa o envio sem criar thread/turno e sem copiar credenciais', async () => {
    await mkdir(dataRoot, { recursive: true })
    const methodLog = path.join(dataRoot, 'auth-required-methods.jsonl')
    // Log SEMPRE por execução: um arquivo residual de outra rodada não pode
    // produzir evidência falsa (nem PASS falso por arquivo antigo).
    await rm(methodLog, { force: true })
    const history = new MemoryAIHistory()
    const authEvents: AIEvent[] = []
    const controlled = new CodexAppServerAdapter({
      dataRoot,
      projectRoot,
      getWorkspaceRoot: () => projectRoot,
      onEvent: (event) => authEvents.push(event),
      codexPath: process.execPath,
      serverArgs: [
        path.join(projectRoot, 'tests', 'fixtures', 'fake-codex-app-server.mjs'),
        '--requires-openai-auth',
        `--method-log=${methodLog}`
      ],
      skipApiKeyLogin: true,
      history
    })
    try {
      const status = await controlled.connect()
      expect(status).toMatchObject({ provider: 'codex-app-server', state: 'AUTH_REQUIRED', account: 'NONE' })

      // Recusa fail-closed: o envio não produz thread, turno nem turno público.
      await expect(controlled.send({ message: 'mensagem que não deve virar turno', mode: 'CHAT' }))
        .rejects.toThrow(/autenticação/u)

      expect(history.threads).toEqual([])
      expect(history.turns).toEqual([])
      expect(history.recordedEvents).toEqual([])
      expect(controlled.terminalTurnIds()).toEqual([])
      const publicTurnKinds = ['THREAD_STARTED', 'TURN_STARTED', 'MESSAGE_DELTA', 'TURN_COMPLETED', 'ERROR']
      expect(authEvents.filter((event) => publicTurnKinds.includes(event.kind))).toEqual([])

      // Prova no PROTOCOLO: handshake + account/read aconteceram; nenhum
      // thread/start ou turn/start foi enviado ao runtime isolado.
      const methods = (await readFile(methodLog, 'utf8'))
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => (JSON.parse(line) as { method: string }).method)
      expect(methods).toContain('initialize')
      expect(methods).toContain('account/read')
      expect(methods).not.toContain('thread/start')
      expect(methods).not.toContain('turn/start')

      // Nenhum segredo/token em eventos de diagnóstico e nenhuma credencial
      // copiada para o home isolado do runtime Codex.
      expect(JSON.stringify(authEvents)).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/u)
      const isolatedHome = await readdir(path.join(dataRoot, 'codex-home'))
      expect(isolatedHome).not.toContain('auth.json')
      expect(isolatedHome).not.toContain('credentials.json')
    } finally {
      await controlled.close()
    }
  }, 30_000)
})

import { describe, expect, it } from 'vitest'
import type { AIEvent, AIThread, AITurn } from '@tupiniquim/contracts'
import { OllamaAdapter } from './ollama'

const delay = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 20))
const urlFor = (input: Parameters<typeof fetch>[0]): string => input instanceof URL ? input.href : typeof input === 'string' ? input : input.url

describe('OllamaAdapter', () => {
  it('descobre modelos locais e transmite NDJSON sem usar rede externa', async () => {
    const events: AIEvent[] = []
    const calls: Array<{ url: string; body?: string }> = []
    const storedThreads: AIThread[] = []
    const storedTurns: AITurn[] = []
    const fetchImpl: typeof fetch = (input, init) => {
      const url = urlFor(input)
      calls.push({ url, ...(typeof init?.body === 'string' ? { body: init.body } : {}) })
      if (url.endsWith('/api/tags')) {
        return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local', model: 'qwen-local', modified_at: '2026-08-17T00:00:00Z', size: 123 }] })))
      }
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"message":{"content":"OLLA"},"done":false}\n{"message":{"content":"MA_OK"},"done":true}\n'))
          controller.close()
        }
      })
      return Promise.resolve(new Response(stream))
    }
    const adapter = new OllamaAdapter({
      onEvent: (event) => events.push(event),
      fetchImpl,
      getWorkspaceRoot: () => 'D:\\CODEX\\workspace',
      history: {
        putAIThread: (thread) => { storedThreads.push(thread); return Promise.resolve() },
        putAITurn: (turn) => { storedTurns.push(turn); return Promise.resolve() },
        appendAIEvent: () => Promise.resolve()
      }
    })
    expect((await adapter.connect()).state).toBe('READY')
    expect(await adapter.listModels()).toMatchObject([{ name: 'qwen-local', size: 123 }])
    adapter.selectModel('qwen-local')
    const reference = await adapter.send({ message: 'teste local', mode: 'CHAT', workspaceContext: 'CONTEXTO DO WORKSPACE — SOMENTE METADADOS' })
    await delay()
    expect(events.some((event) => event.kind === 'MESSAGE_DELTA' && event.text === 'OLLA')).toBe(true)
    expect(events.some((event) => event.kind === 'TURN_COMPLETED' && event.status === 'COMPLETED')).toBe(true)
    expect(calls.find((call) => call.url.endsWith('/api/chat'))?.body).toContain('"model":"qwen-local"')
    expect(calls.find((call) => call.url.endsWith('/api/chat'))?.body).toContain('SOMENTE METADADOS')
    expect(reference.threadId).not.toBe('')
    expect(storedThreads).toMatchObject([{ provider: 'ollama', model: 'qwen-local' }])
    expect(storedTurns[0]?.threadId).toBe(reference.threadId)
    expect(storedTurns[0]?.inputHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(JSON.stringify(storedTurns)).not.toContain('teste local')
    await adapter.close()
  })

  it('reporta runtime ausente sem tentar instalar Ollama', async () => {
    const adapter = new OllamaAdapter({
      onEvent: () => undefined,
      fetchImpl: () => { throw new TypeError('fetch failed') }
    })
    await expect(adapter.connect()).resolves.toMatchObject({ state: 'NOT_INSTALLED' })
    await expect(adapter.listModels()).resolves.toEqual([])
  })

  it('diferencia runtime ausente de uma resposta de erro do runtime local', async () => {
    const adapter = new OllamaAdapter({
      onEvent: () => undefined,
      fetchImpl: () => Promise.resolve(new Response('', { status: 503 }))
    })
    await expect(adapter.connect()).resolves.toMatchObject({ state: 'ERROR' })
  })

  it('interrompe streaming local sem deixar turno ativo', async () => {
    const events: AIEvent[] = []
    let started: (() => void) | null = null
    const streamStarted = new Promise<void>((resolve) => { started = resolve })
    const fetchImpl: typeof fetch = (input, init) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
          started?.()
        }
      })
      const signal = init?.signal
      signal?.addEventListener('abort', () => streamController?.error(new DOMException('Aborted', 'AbortError')), { once: true })
      return Promise.resolve(new Response(stream))
    }
    const adapter = new OllamaAdapter({ onEvent: (event) => events.push(event), fetchImpl })
    await adapter.connect()
    adapter.selectModel('qwen-local')
    const reference = await adapter.send({ message: 'conteÃºdo privado', mode: 'CHAT' })
    await streamStarted
    await adapter.interrupt(reference)
    await delay()
    expect(events.some((event) => event.kind === 'TURN_COMPLETED' && event.status === 'CANCELLED')).toBe(true)
    expect(adapter.status()).toMatchObject({ state: 'READY', activeTurnId: null })
  })

  it('redige padrões sensíveis antes de publicar eventos locais', async () => {
    const events: AIEvent[] = []
    const fetchImpl: typeof fetch = (input) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"message":{"content":"token: valor-sensivel"},"done":true}\n'))
          controller.close()
        }
      })
      return Promise.resolve(new Response(stream))
    }
    const adapter = new OllamaAdapter({ onEvent: (event) => events.push(event), fetchImpl })
    await adapter.connect()
    adapter.selectModel('qwen-local')
    await adapter.send({ message: 'teste', mode: 'CHAT' })
    await delay()
    expect(events.find((event) => event.kind === 'MESSAGE_DELTA')?.text).toBe('token=[REDACTED]')
  })

  it('rejeita hosts Ollama remotos', () => {
    expect(() => new OllamaAdapter({ onEvent: () => undefined, baseUrl: 'https://ollama.com' })).toThrow('loopback')
  })
})

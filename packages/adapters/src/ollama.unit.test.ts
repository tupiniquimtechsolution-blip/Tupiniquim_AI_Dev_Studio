import { describe, expect, it } from 'vitest'
import type { AIEvent, AIThread, AITurn, NormalizedToolCallEnvelope, WorkspaceWriteProposal } from '@tupiniquim/contracts'
import { OllamaAdapter } from './ollama'

const delay = async (): Promise<void> => await new Promise((resolve) => setTimeout(resolve, 20))
const urlFor = (input: Parameters<typeof fetch>[0]): string => input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return
    await delay()
  }
  throw new Error('Timeout aguardando estado do adapter Ollama.')
}
const ndjsonResponse = (...chunks: unknown[]): Response => {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'))
      controller.close()
    }
  }))
}
const proposalFor = (call: { envelope: NormalizedToolCallEnvelope; executionId: string; stepId: string }): WorkspaceWriteProposal => {
  const args = call.envelope.arguments as Record<string, string>
  return {
    id: crypto.randomUUID(),
    provider: call.envelope.provider,
    toolCallId: call.envelope.callId,
    tool: call.envelope.tool,
    executionId: call.executionId,
    stepId: call.stepId,
    threadId: call.envelope.threadId,
    turnId: call.envelope.turnId,
    effect: {
      id: crypto.randomUUID(),
      capability: 'workspace.write',
      operation: (args.operation ?? 'CREATE') as 'CREATE' | 'REPLACE',
      target: args.relativePath ?? '',
      payloadHash: 'a'.repeat(64),
      risk: 'HIGH'
    },
    createdAt: new Date().toISOString()
  }
}
const rejectedMarker = 'MARCADOR_REJEITADO_OLLAMA'
const workspaceWriteToolCall = (argumentsValue: unknown, name = 'tupiniquim_workspace_write_proposal'): unknown => ({
  function: { name, arguments: argumentsValue }
})
const rejectedProposalChunk = (toolCalls: unknown[] | undefined, done: boolean): unknown => ({
  message: {
    content: rejectedMarker,
    ...(toolCalls === undefined ? {} : { tool_calls: toolCalls })
  },
  done
})
const rejectedNdjson = (...chunks: unknown[]): (() => Response) => () => ndjsonResponse(...chunks)
const validToolArguments = { relativePath: 'src/rejeitado.ts', content: rejectedMarker, operation: 'CREATE' }
const rejectedProposalScenarios: Array<[string, () => Response]> = [
  ['zero tool call', rejectedNdjson(rejectedProposalChunk(undefined, true))],
  ['tool desconhecida', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall(validToolArguments, 'ferramenta_nao_autorizada')], true))],
  ['múltiplas tools no mesmo chunk', rejectedNdjson(rejectedProposalChunk([
    workspaceWriteToolCall({ ...validToolArguments, relativePath: 'src/a.ts' }),
    workspaceWriteToolCall({ ...validToolArguments, relativePath: 'src/b.ts', operation: 'REPLACE' })
  ], true))],
  ['múltiplas tools em chunks separados', rejectedNdjson(
    rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, relativePath: 'src/a.ts' })], false),
    rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, relativePath: 'src/b.ts', operation: 'REPLACE' })], true)
  )],
  ['operation DELETE', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, operation: 'DELETE' })], true))],
  ['proveniência extra', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, executionId: rejectedMarker })], true))],
  ['argumento extra', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, unexpected: rejectedMarker })], true))],
  ['campo ausente', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall({ relativePath: 'src/rejeitado.ts', operation: 'CREATE' })], true))],
  ['tipo de campo incorreto', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall({ ...validToolArguments, content: 42 })], true))],
  ['JSON de argumentos malformado', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall(`{"relativePath":"src/rejeitado.ts","content":"${rejectedMarker}","operation":"CREATE"}`)], true))],
  ['EOF sem done', rejectedNdjson(rejectedProposalChunk([workspaceWriteToolCall(validToolArguments)], false))],
  ['múltiplos chunks done', rejectedNdjson(
    rejectedProposalChunk([workspaceWriteToolCall(validToolArguments)], true),
    rejectedProposalChunk(undefined, true)
  )],
  ['excesso de linhas', () => new Response(`${'\n'.repeat(100_001)}${JSON.stringify(rejectedProposalChunk(undefined, true))}`)]
]
const currentWorkspaceRoot = 'F:\\CODEX\\workspace'
const persistedThreadCollisionCases: Array<[string, AIThread['provider'], string]> = [
  ['com provider divergente', 'codex-app-server', currentWorkspaceRoot],
  ['com workspace divergente', 'ollama', 'F:\\CODEX\\outro-workspace'],
  ['mesmo no provider e workspace atuais', 'ollama', currentWorkspaceRoot]
]

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
      getWorkspaceRoot: () => 'F:\\CODEX\\workspace',
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
    expect(calls.find((call) => call.url.endsWith('/api/chat'))?.body).not.toContain('"tools"')
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
    const reference = await adapter.send({ message: 'conteúdo privado', mode: 'CHAT' })
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

  it('rejeita proposalContext fora de PLAN antes de acessar o runtime', async () => {
    let fetchCalls = 0
    const adapter = new OllamaAdapter({
      onEvent: () => undefined,
      fetchImpl: () => {
        fetchCalls += 1
        return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      }
    })

    await expect(adapter.send({
      message: 'Não anuncie ferramenta neste modo.',
      mode: 'CHAT',
      proposalContext: { executionId: crypto.randomUUID(), stepId: crypto.randomUUID() }
    })).rejects.toThrow()
    expect(fetchCalls).toBe(0)
    expect(adapter.status()).toMatchObject({ state: 'DISCONNECTED', activeThreadId: null, activeTurnId: null })
  })

  it.each(persistedThreadCollisionCases)('recusa thread persistida %s em vez de sobrescrevê-la', async (_label, provider, workspaceRoot) => {
    const threadId = 'thread-persistida-fora-da-memoria'
    const now = new Date().toISOString()
    const persistedThread: AIThread = { id: threadId, provider, workspaceRoot, model: 'modelo-persistido', createdAt: now, updatedAt: now }
    let reads = 0
    let threadWrites = 0
    let turnWrites = 0
    let chatCalls = 0
    const fetchImpl: typeof fetch = (input) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      chatCalls += 1
      return Promise.resolve(ndjsonResponse({ message: { content: 'NAO_DEVE_EXECUTAR' }, done: true }))
    }
    const adapter = new OllamaAdapter({
      onEvent: () => undefined,
      fetchImpl,
      getWorkspaceRoot: () => currentWorkspaceRoot,
      history: {
        getAIThread: (id) => {
          reads += 1
          return Promise.resolve(id === threadId ? persistedThread : null)
        },
        putAIThread: () => { threadWrites += 1; return Promise.resolve() },
        putAITurn: () => { turnWrites += 1; return Promise.resolve() },
        appendAIEvent: () => Promise.resolve()
      }
    })
    await adapter.connect()
    adapter.selectModel('qwen-local')

    await expect(adapter.send({ message: 'Não sobrescreva a thread.', mode: 'CHAT', threadId })).rejects.toThrow('Thread')
    expect(reads).toBe(1)
    expect(threadWrites).toBe(0)
    expect(turnWrites).toBe(0)
    expect(chatCalls).toBe(0)
    expect(adapter.status()).toMatchObject({ state: 'READY', activeThreadId: null, activeTurnId: null })
    await adapter.close()
  })

  it('executa uma proposta oficial de tool calling sem expor payload em eventos ou histórico', async () => {
    const marker = 'MARCADOR_BRUTO_OLLAMA_NAO_PERSISTIR'
    const executionId = crypto.randomUUID()
    const stepId = crypto.randomUUID()
    const events: AIEvent[] = []
    const storedEvents: AIEvent[] = []
    const chatBodies: string[] = []
    let chatIndex = 0
    const received: Array<{ envelope: NormalizedToolCallEnvelope; executionId: string; stepId: string }> = []
    const fetchImpl: typeof fetch = (input, init) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      if (typeof init?.body === 'string') chatBodies.push(init.body)
      chatIndex += 1
      if (chatIndex === 1) {
        return Promise.resolve(ndjsonResponse({
          message: {
            content: marker,
            tool_calls: [{
              function: {
                name: 'tupiniquim_workspace_write_proposal',
                arguments: { relativePath: 'src/gerado.ts', content: marker, operation: 'CREATE' }
              }
            }]
          },
          done: true
        }))
      }
      return Promise.resolve(ndjsonResponse({ message: { content: 'SEGUIMENTO_OK' }, done: true }))
    }
    const adapter = new OllamaAdapter({
      onEvent: (event) => events.push(event),
      fetchImpl,
      history: {
        putAIThread: () => Promise.resolve(),
        putAITurn: () => Promise.resolve(),
        appendAIEvent: (event) => { storedEvents.push(event); return Promise.resolve() }
      },
      onWorkspaceWriteToolCall: (call) => {
        received.push(call)
        return Promise.resolve(proposalFor(call))
      }
    })
    await adapter.connect()
    adapter.selectModel('qwen-local')
    const reference = await adapter.send({
      message: 'Proponha um arquivo TypeScript.',
      mode: 'PLAN',
      proposalContext: { executionId, stepId }
    })
    await waitFor(() => adapter.status().state === 'READY')

    const requestBody = JSON.parse(chatBodies[0] ?? '{}') as {
      tools?: Array<{ function?: { name?: string; parameters?: { properties?: Record<string, unknown> } } }>
    }
    expect(requestBody.tools).toHaveLength(1)
    expect(requestBody.tools?.[0]?.function?.name).toBe('tupiniquim_workspace_write_proposal')
    expect(Object.keys(requestBody.tools?.[0]?.function?.parameters?.properties ?? {}).sort()).toEqual(['content', 'operation', 'relativePath'])
    expect(chatBodies[0]).not.toContain(executionId)
    expect(chatBodies[0]).not.toContain(stepId)
    expect(received[0]).toMatchObject({
      executionId,
      stepId
    })
    expect(received[0]?.envelope).toMatchObject({
      provider: 'ollama',
      threadId: reference.threadId,
      turnId: reference.turnId,
      tool: 'workspace.write',
      arguments: {
        relativePath: 'src/gerado.ts',
        content: marker,
        operation: 'CREATE'
      }
    })
    expect(received[0]?.envelope.callId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    expect(JSON.stringify(events)).not.toContain(marker)
    expect(JSON.stringify(storedEvents)).not.toContain(marker)
    expect(events.some((event) => event.kind === 'MESSAGE_DELTA' && event.text === marker)).toBe(false)

    await adapter.send({ message: 'Continue sem ferramenta.', mode: 'CHAT', threadId: reference.threadId })
    await waitFor(() => adapter.status().state === 'READY')
    expect(chatBodies[1]).not.toContain(marker)
    expect(chatBodies[1]).toContain('Proposta workspace.write registrada para revisão humana.')
    await adapter.close()
  })

  it.each(rejectedProposalScenarios)('recusa %s sem executar callback nem vazar argumentos', async (_label, rejectedResponse) => {
    const events: AIEvent[] = []
    const storedEvents: AIEvent[] = []
    const chatBodies: string[] = []
    let chatCalls = 0
    let callbackCount = 0
    const fetchImpl: typeof fetch = (input, init) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      if (typeof init?.body === 'string') chatBodies.push(init.body)
      chatCalls += 1
      return Promise.resolve(chatCalls === 1
        ? rejectedResponse()
        : ndjsonResponse({ message: { content: 'RECUPERACAO_OK' }, done: true }))
    }
    const adapter = new OllamaAdapter({
      onEvent: (event) => events.push(event),
      fetchImpl,
      history: {
        putAIThread: () => Promise.resolve(),
        putAITurn: () => Promise.resolve(),
        appendAIEvent: (event) => { storedEvents.push(event); return Promise.resolve() }
      },
      onWorkspaceWriteToolCall: (call) => {
        callbackCount += 1
        return Promise.resolve(proposalFor(call))
      }
    })
    await adapter.connect()
    adapter.selectModel('qwen-local')
    const reference = await adapter.send({
      message: 'Tente propor uma escrita.',
      mode: 'PLAN',
      proposalContext: { executionId: crypto.randomUUID(), stepId: crypto.randomUUID() }
    })
    await waitFor(() => adapter.status().state === 'ERROR')
    expect(callbackCount).toBe(0)
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'ERROR', detail: 'Falha no streaming do Ollama local.', status: 'FAILED' })]))
    expect(JSON.stringify(events)).not.toContain(rejectedMarker)
    expect(JSON.stringify(storedEvents)).not.toContain(rejectedMarker)

    await adapter.connect()
    await adapter.send({ message: 'Continue após a recusa.', mode: 'CHAT', threadId: reference.threadId })
    await waitFor(() => adapter.status().state === 'READY')
    expect(callbackCount).toBe(0)
    expect(chatBodies[1]).not.toContain(rejectedMarker)
    expect(JSON.stringify(events)).not.toContain(rejectedMarker)
    expect(JSON.stringify(storedEvents)).not.toContain(rejectedMarker)
    await adapter.close()
  })

  it('injeta sessionContext no request sem persistir no histórico local', async () => {
    const chatBodies: string[] = []
    const fetchImpl: typeof fetch = (input, init) => {
      if (urlFor(input).endsWith('/api/tags')) return Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen-local' }] })))
      if (typeof init?.body === 'string') chatBodies.push(init.body)
      return Promise.resolve(ndjsonResponse({ message: { content: 'OLLAMA_SESSION_OK' }, done: true }))
    }
    const adapter = new OllamaAdapter({ onEvent: () => undefined, fetchImpl })
    await adapter.connect()
    adapter.selectModel('qwen-local')
    const sessionContext = [
      'CONTEXTO DA SESSÃO TUPINIQUIM — SOMENTE TURNS PÚBLICOS REDIGIDOS',
      '[codex-app-server / codex-test-model] user: Meu projeto usa arquitetura X'
    ].join('\n')
    const reference = await adapter.send({ message: 'Continue a análise', mode: 'CHAT', sessionContext })
    await waitFor(() => adapter.status().state === 'READY')
    expect(chatBodies[0]).toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
    expect(chatBodies[0]).toContain('arquitetura X')
    expect(chatBodies[0]).toContain('Continue a análise')

    await adapter.send({ message: 'segunda mensagem local', mode: 'CHAT', threadId: reference.threadId })
    await waitFor(() => adapter.status().state === 'READY')
    expect(chatBodies[1]).toContain('Continue a análise')
    expect(chatBodies[1]).toContain('OLLAMA_SESSION_OK')
    expect(chatBodies[1]).toContain('segunda mensagem local')
    expect(chatBodies[1]).not.toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
    expect(chatBodies[1]).not.toContain('arquitetura X')
    await adapter.close()
  })

  it('rejeita hosts Ollama remotos', () => {
    expect(() => new OllamaAdapter({ onEvent: () => undefined, baseUrl: 'https://ollama.com' })).toThrow('loopback')
  })
})

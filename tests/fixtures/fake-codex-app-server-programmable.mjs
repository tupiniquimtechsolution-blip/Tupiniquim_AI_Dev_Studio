import readline from 'node:readline'

let turnIndex = 0

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n')

const turnInputText = (params) => {
  const input = params?.input
  if (!Array.isArray(input)) return ''
  return input.map((item) => typeof item?.text === 'string' ? item.text : '').join('\n')
}

const emitCompletion = (threadId, turnId, text) => {
  send({ method: 'turn/started', params: { threadId, turn: { id: turnId } } })
  const delta = text.includes('CONTEXTO DA SESSÃO TUPINIQUIM') ? 'CONTROLLED_STREAM_OK CONTEXTO_TUPINIQUIM_OK' : 'CONTROLLED_STREAM_OK'
  send({ method: 'item/agentMessage/delta', params: { threadId, turnId, itemId: 'item-' + turnIndex, delta } })
  const status = text.includes('TUPINIQUIM_FAIL_THEN_COMPLETE') ? 'failed' : 'completed'
  send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status, error: null } } })
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line)
  if (request.id === undefined) return
  if (request.method === 'initialize') {
    send({ id: request.id, result: { userAgent: 'codex-test' } })
    return
  }
  if (request.method === 'account/read') {
    send({ id: request.id, result: { account: null, requiresOpenaiAuth: false } })
    return
  }
  if (request.method === 'thread/start') {
    send({ id: request.id, result: { thread: { id: 'thread-controlled' }, model: 'codex-test-model' } })
    return
  }
  if (request.method === 'thread/resume') {
    send({ id: request.id, result: { thread: { id: request.params.threadId } } })
    return
  }
  if (request.method === 'turn/start') {
    turnIndex += 1
    const turnId = 'turn-controlled-' + turnIndex
    const text = turnInputText(request.params)
    const threadId = request.params.threadId
    send({ id: request.id, result: { turn: { id: turnId } } })
    if (text.includes('TUPINIQUIM_RETRY_THEN_COMPLETE')) {
      send({ method: 'error', params: { threadId, turnId, willRetry: true, error: { message: 'retry' } } })
      setTimeout(() => emitCompletion(threadId, turnId, text), 80)
      return
    }
    if (text.includes('TUPINIQUIM_FAIL_THEN_COMPLETE')) {
      send({ method: 'error', params: { threadId, turnId, willRetry: false, error: { message: 'fail' } } })
      emitCompletion(threadId, turnId, text)
      return
    }
    if (text.includes('TUPINIQUIM_HOLD_TURN')) {
      setTimeout(() => emitCompletion(threadId, turnId, text), 80)
      return
    }
    emitCompletion(threadId, turnId, text)
    return
  }
  if (request.method === 'turn/interrupt') {
    send({ id: request.id, result: {} })
    return
  }
  send({ id: request.id, error: { code: -32601, message: 'Método não suportado pelo servidor controlado.' } })
})

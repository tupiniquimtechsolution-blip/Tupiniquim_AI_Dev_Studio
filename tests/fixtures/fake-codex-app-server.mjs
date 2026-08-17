import readline from 'node:readline'

let turnIndex = 0

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n')

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
    send({ id: request.id, result: { turn: { id: turnId } } })
    send({ method: 'turn/started', params: { threadId: request.params.threadId, turn: { id: turnId } } })
    send({ method: 'item/agentMessage/delta', params: { threadId: request.params.threadId, turnId, itemId: 'item-' + turnIndex, delta: 'CONTROLLED_STREAM_OK' } })
    send({ method: 'turn/completed', params: { threadId: request.params.threadId, turn: { id: turnId, status: 'completed', error: null } } })
    return
  }
  if (request.method === 'turn/interrupt') {
    send({ id: request.id, result: {} })
    return
  }
  send({ id: request.id, error: { code: -32601, message: 'Método não suportado pelo servidor controlado.' } })
})

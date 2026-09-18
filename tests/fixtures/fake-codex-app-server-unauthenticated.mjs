/**
 * Wave 17 — Issue #25: Codex App Server NÃO AUTENTICADO (E2E).
 *
 * Emula o cenário real do dogfood: CODEX_HOME isolado do Tupiniquim sem
 * autenticação. `account/read` retorna `requiresOpenaiAuth: true`, fazendo o
 * adapter reportar o estado terminal AUTH_REQUIRED (fail-closed).
 *
 * `thread/start`/`turn/start` continuam respondendo — com um marcador
 * EXCLUSIVO — para que QUALQUER envio que vaze da guarda do renderer seja
 * detectável de forma inequívoca no DOM (o marcador nunca deve aparecer).
 * Nenhum segredo, token ou caminho de credencial é emitido.
 */
import readline from 'node:readline'

let turnIndex = 0

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n')

const turnInputText = (params) => {
  const input = params?.input
  if (!Array.isArray(input)) return ''
  return input.map((item) => typeof item?.text === 'string' ? item.text : '').join('\n')
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line)
  if (request.id === undefined) return
  if (request.method === 'initialize') {
    send({ id: request.id, result: { userAgent: 'codex-test-unauth' } })
    return
  }
  if (request.method === 'account/read') {
    // CODEX_HOME isolado sem autenticação: exige auth, nenhuma conta.
    send({ id: request.id, result: { account: null, requiresOpenaiAuth: true } })
    return
  }
  if (request.method === 'thread/start') {
    send({ id: request.id, result: { thread: { id: 'thread-unauth-controlled' }, model: 'codex-unauth-model' } })
    return
  }
  if (request.method === 'thread/resume') {
    send({ id: request.id, result: { thread: { id: request.params.threadId } } })
    return
  }
  if (request.method === 'turn/start') {
    turnIndex += 1
    const turnId = 'turn-unauth-controlled-' + turnIndex
    const threadId = request.params.threadId
    send({ id: request.id, result: { turn: { id: turnId } } })
    send({ method: 'turn/started', params: { threadId, turn: { id: turnId } } })
    // Marcador exclusivo: se chegar ao DOM, um turno vazou do fail-closed.
    send({ method: 'item/agentMessage/delta', params: { threadId, turnId, itemId: 'item-unauth-' + turnIndex, delta: 'UNAUTH_SERVER_REACHED_MARKER' } })
    send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: 'completed', error: null } } })
    return
  }
  if (request.method === 'turn/interrupt') {
    send({ id: request.id, result: {} })
    return
  }
  send({ id: request.id, error: { code: -32601, message: 'Método não suportado pelo servidor controlado.' } })
})

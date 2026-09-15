import { appendFileSync } from 'node:fs'
import readline from 'node:readline'

let turnIndex = 0

/**
 * Flags opcionais do servidor controlado (argv é varrido inteiro porque o
 * processo é iniciado como `codexPath arg0 arg1 ...` e a posição exata dos
 * argumentos extras depende do runner):
 *
 * - `--requires-openai-auth`: simula o runtime ISOLADO do Tupiniquim sem
 *   credenciais (`account/read` → `account: null, requiresOpenaiAuth: true`),
 *   produzindo `AUTH_REQUIRED` sem tocar o perfil normal do Codex e sem
 *   copiar `auth.json`/tokens/cookies/API keys entre homes.
 * - `--method-log=<caminho>`: registra APENAS o nome dos métodos recebidos
 *   (JSONL sanitizado, sem params/segredos), permitindo provar no teste de
 *   integração que `thread/start`/`turn/start` nunca chegam ao protocolo
 *   quando o provider está `AUTH_REQUIRED` (nenhum turno fantasma).
 */
const requiresOpenaiAuth = process.argv.includes('--requires-openai-auth')
const methodLog = process.argv.find((argument) => argument.startsWith('--method-log='))?.slice('--method-log='.length)

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n')

const turnInputText = (params) => {
  const input = params?.input
  if (!Array.isArray(input)) return ''
  return input.map((item) => typeof item?.text === 'string' ? item.text : '').join('\n')
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line)
  if (request.id === undefined) return
  if (methodLog !== undefined && methodLog !== '') appendFileSync(methodLog, `${JSON.stringify({ method: request.method })}\n`)
  if (request.method === 'initialize') {
    send({ id: request.id, result: { userAgent: 'codex-test' } })
    return
  }
  if (request.method === 'account/read') {
    send({ id: request.id, result: { account: null, requiresOpenaiAuth } })
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
    const sawSession = text.includes('CONTEXTO DA SESSÃO TUPINIQUIM')
    const delta = sawSession ? 'CONTROLLED_STREAM_OK CONTEXTO_TUPINIQUIM_OK' : 'CONTROLLED_STREAM_OK'
    send({ id: request.id, result: { turn: { id: turnId } } })
    send({ method: 'turn/started', params: { threadId: request.params.threadId, turn: { id: turnId } } })
    send({ method: 'item/agentMessage/delta', params: { threadId: request.params.threadId, turnId, itemId: 'item-' + turnIndex, delta } })
    send({ method: 'turn/completed', params: { threadId: request.params.threadId, turn: { id: turnId, status: 'completed', error: null } } })
    return
  }
  if (request.method === 'turn/interrupt') {
    send({ id: request.id, result: {} })
    return
  }
  send({ id: request.id, error: { code: -32601, message: 'Método não suportado pelo servidor controlado.' } })
})

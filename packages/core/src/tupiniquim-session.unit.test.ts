import { describe, expect, it } from 'vitest'
import { TupiniquimSessionService } from './tupiniquim-session'

const workspaceA = '/workspace/autorizado-a'
const workspaceB = '/workspace/autorizado-b'

describe('TupiniquimSessionService', () => {
  it('reusa a mesma sessão no mesmo workspace e isola outro workspace', () => {
    const sessions = new TupiniquimSessionService()
    const first = sessions.open(workspaceA)
    sessions.appendTurn({
      role: 'user',
      text: 'contexto do projeto A',
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-ollama-a',
      turnId: 'turn-1'
    })
    sessions.bindProviderThread('ollama', 'thread-ollama-a', 'modelo-a')
    expect(sessions.open(workspaceA).id).toBe(first.id)
    expect(sessions.snapshot()?.turns).toHaveLength(1)

    const second = sessions.open(workspaceB)
    expect(second.id).not.toBe(first.id)
    expect(second.workspaceRoot).toBe(workspaceB)
    expect(sessions.snapshot()).toMatchObject({
      session: { id: second.id, workspaceRoot: workspaceB },
      turns: [],
      providerThreads: [],
      proposalAuthority: null
    })
  })

  it('preserva a conversa na troca de provider e mantém threads distintas', () => {
    const sessions = new TupiniquimSessionService()
    const session = sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'mensagem na sessão Tupiniquim',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-1'
    })
    const expired = sessions.switchProvider('ollama', 'codex-app-server')
    expect(expired).toEqual([])
    expect(sessions.current()?.id).toBe(session.id)
    sessions.bindProviderThread('codex-app-server', 'thread-codex', 'codex-test-model')
    sessions.appendTurn({
      role: 'assistant',
      text: 'resposta do segundo provider',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-codex',
      turnId: 'turn-codex-1'
    })

    const snapshot = sessions.snapshot()
    expect(snapshot?.session.id).toBe(session.id)
    expect(snapshot?.turns.map((turn) => turn.text)).toEqual([
      'mensagem na sessão Tupiniquim',
      'resposta do segundo provider'
    ])
    expect(snapshot?.providerThreads).toEqual([
      { provider: 'ollama', threadId: 'thread-ollama', model: 'qwen-local' },
      { provider: 'codex-app-server', threadId: 'thread-codex', model: 'codex-test-model' }
    ])
    expect(sessions.threadFor('ollama')).toBe('thread-ollama')
    expect(sessions.threadFor('codex-app-server')).toBe('thread-codex')
  })

  it('nunca reutiliza thread de outro provider nem transfere autoridade de proposta', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.grantProposalAuthority('ollama', 'thread-ollama', '11111111-1111-4111-8111-111111111111')
    expect(sessions.resolveChatThread('codex-app-server', 'thread-ollama')).toBeUndefined()
    expect(() => sessions.bindProviderThread('codex-app-server', 'thread-ollama', null)).toThrow('reutilizar')
    expect(() => sessions.assertProposalProvider('codex-app-server')).toThrow('não transfere')
    expect(() => sessions.grantProposalAuthority('codex-app-server', 'thread-codex', '22222222-2222-4222-8222-222222222222')).toThrow('não transfere')

    const expired = sessions.switchProvider('ollama', 'codex-app-server')
    expect(expired).toEqual(['11111111-1111-4111-8111-111111111111'])
    expect(sessions.proposalAuthority()).toBeNull()
    sessions.bindProviderThread('codex-app-server', 'thread-codex', 'codex-test-model')
    expect(sessions.resolveChatThread('codex-app-server', 'thread-ollama')).toBe('thread-codex')
    expect(sessions.resolveChatThread('ollama')).toBe('thread-ollama')
  })

  it('redige segredos no turno público e acumula deltas do assistente', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    const user = sessions.appendTurn({
      role: 'user',
      text: 'token: valor-sensivel e sk-proj-abcdefghijklmnopqrstuv',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-user'
    })
    expect(user.text).toContain('token=[REDACTED]')
    expect(user.text).toContain('[REDACTED]')
    expect(user.text).not.toContain('valor-sensivel')
    expect(user.text).not.toContain('sk-proj-abcdefghijklmnopqrstuv')

    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-assistant',
      text: 'parte-1 '
    })
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-assistant',
      text: 'parte-2'
    })
    sessions.completeTurn('turn-assistant')
    expect(sessions.snapshot()?.turns.map((turn) => turn.text)).toEqual([
      user.text,
      'parte-1 parte-2'
    ])
  })

  it('recusa bind divergente do mesmo provider na mesma sessão', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    expect(() => sessions.bindProviderThread('ollama', 'thread-ollama-outra', 'qwen-local')).toThrow('thread distinta')
    expect(sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local').threadId).toBe('thread-ollama')
  })
})

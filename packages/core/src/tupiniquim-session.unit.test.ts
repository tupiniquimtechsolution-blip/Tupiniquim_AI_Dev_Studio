import { describe, expect, it } from 'vitest'
import { maxTupiniquimSessionContextChars } from '@tupiniquim/contracts'
import { TupiniquimSessionService } from './tupiniquim-session'

const workspaceA = '/workspace/autorizado-a'
const workspaceB = '/workspace/autorizado-b'
const privateMarker = 'TUPINIQUIM_SESSION_PRIVATE_PAYLOAD'

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

    const restored = sessions.open(workspaceA)
    expect(restored.id).toBe(first.id)
    expect(sessions.snapshot()?.session.workspaceRoot).toBe(workspaceA)
    expect(sessions.snapshot()?.turns).toHaveLength(1)
    expect(sessions.snapshot()?.turns[0]?.text).toBe('contexto do projeto A')
    expect(sessions.threadFor('ollama')).toBe('thread-ollama-a')
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

  it('A → B → A devolve a sessão A enquanto o processo vive', () => {
    const sessions = new TupiniquimSessionService()
    const sessionA = sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    sessions.appendTurn({
      role: 'user',
      text: 'Meu projeto usa arquitetura X',
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-a',
      turnId: 'turn-a'
    })
    const sessionB = sessions.open(workspaceB)
    expect(sessionB.id).not.toBe(sessionA.id)
    sessions.bindProviderThread('codex-app-server', 'thread-b', 'codex-test-model')
    sessions.appendTurn({
      role: 'user',
      text: 'conversa isolada do workspace B',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-b',
      turnId: 'turn-b'
    })
    expect(sessions.publicProviderContext()).toContain('conversa isolada do workspace B')
    expect(sessions.publicProviderContext()).not.toContain('arquitetura X')

    const restored = sessions.open(workspaceA)
    expect(restored.id).toBe(sessionA.id)
    expect(sessions.snapshot()?.turns.map((turn) => turn.text)).toEqual(['Meu projeto usa arquitetura X'])
    expect(sessions.threadFor('ollama')).toBe('thread-a')
    expect(sessions.threadFor('codex-app-server')).toBeUndefined()
    expect(sessions.publicProviderContext()).toContain('arquitetura X')
    expect(sessions.publicProviderContext()).not.toContain('conversa isolada do workspace B')
  })

  it('preenche o modelo real do assistente a partir do binding', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: null,
      threadId: 'thread-ollama',
      turnId: 'turn-assistant',
      text: 'resposta sem modelo ainda'
    })
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    expect(sessions.snapshot()?.turns[0]).toMatchObject({
      role: 'assistant',
      model: 'qwen-local',
      provider: 'ollama',
      threadId: 'thread-ollama',
      turnId: 'turn-assistant',
      sessionId: sessions.current()?.id
    })
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: null,
      threadId: 'thread-ollama',
      turnId: 'turn-assistant',
      text: ' e continuação'
    })
    expect(sessions.snapshot()?.turns[0]?.model).toBe('qwen-local')
    expect(sessions.snapshot()?.turns[0]?.text).toContain('continuação')
  })

  it('expõe contexto público redigido, limitado e sem payload privado', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'Meu projeto usa arquitetura X e token: valor-sensivel',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-user'
    })
    sessions.appendTurn({
      role: 'assistant',
      text: 'PROPOSTA DISPONÍVEL PARA REVISÃO\nCREATE src/foo.ts\nHash abcdefabcdef…',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-proposal'
    })
    sessions.appendTurn({
      role: 'error',
      text: 'não deve ir ao provider',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-error'
    })
    const context = sessions.publicProviderContext()
    expect(context).toContain('CONTEXTO DA SESSÃO TUPINIQUIM')
    expect(context).toContain('arquitetura X')
    expect(context).toContain('[ollama / qwen-local] user:')
    expect(context).not.toContain('valor-sensivel')
    expect(context).toContain('token=[REDACTED]')
    expect(context).not.toContain(privateMarker)
    expect(context).not.toContain('não deve ir ao provider')
    expect(JSON.stringify(sessions.snapshot())).not.toContain(privateMarker)

    for (let index = 0; index < 8; index += 1) {
      sessions.appendTurn({
        role: 'user',
        text: `bloco-${String(index)}-${'N'.repeat(1_500)}`,
        provider: 'ollama',
        model: 'qwen-local',
        threadId: 'thread-ollama',
        turnId: `turn-limit-${String(index)}`
      })
    }
    const limited = sessions.publicProviderContext()
    expect(limited).toBeDefined()
    expect(limited?.length).toBeLessThanOrEqual(maxTupiniquimSessionContextChars)
    expect(limited).toContain('bloco-7-')
    expect(limited).not.toContain('bloco-0-')
  })
})

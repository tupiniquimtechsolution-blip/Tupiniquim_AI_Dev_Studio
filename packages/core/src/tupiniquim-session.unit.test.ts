import { describe, expect, it } from 'vitest'
import { maxTupiniquimSessionContextChars, type AIStatus } from '@tupiniquim/contracts'
import { PrivilegedRuntimeGate, TupiniquimSessionService, agentRuntimeBusyMessage, assertIdleForWorkspaceSwitch, workspaceSwitchBusyMessage } from './tupiniquim-session'

const statusFor = (activeThreadId: string | null, activeTurnId: string | null = null): AIStatus => ({
  provider: 'ollama',
  state: 'READY',
  account: 'NONE',
  version: 'local',
  activeThreadId,
  activeTurnId,
  detail: null
})

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
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-assistant')
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

  it('A → B devolve ids de proposta expirada e A restaurada não recupera autoridade', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    const proposalId = '11111111-1111-4111-8111-111111111111'
    sessions.grantProposalAuthority('ollama', 'thread-a', proposalId)
    const expired = sessions.switchWorkspace(workspaceB)
    expect(expired).toEqual([proposalId])
    expect(sessions.proposalAuthority()).toBeNull()
    expect(sessions.current()?.workspaceRoot).toBe(workspaceB)
    const restored = sessions.open(workspaceA)
    expect(restored.workspaceRoot).toBe(workspaceA)
    expect(sessions.proposalAuthority()).toBeNull()
  })

  it('insere o turno de usuário imediatamente antes do assistente do mesmo turnId', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-race',
      text: 'resposta antecipada'
    })
    sessions.appendTurn({
      role: 'user',
      text: 'pergunta que chegou depois',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-race'
    })
    const snapshot = sessions.snapshot()
    expect(snapshot?.turns.map((turn) => turn.role)).toEqual(['user', 'assistant'])
    expect(snapshot?.turns.map((turn) => turn.text)).toEqual([
      'pergunta que chegou depois',
      'resposta antecipada'
    ])
    const context = sessions.publicProviderContext() ?? ''
    expect(context.indexOf('user: pergunta que chegou depois')).toBeGreaterThanOrEqual(0)
    expect(context.indexOf('assistant: resposta antecipada')).toBeGreaterThan(
      context.indexOf('user: pergunta que chegou depois')
    )
  })

  it('entrega somente o delta não visto por provider e não reenvia após acknowledge', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'Meu projeto usa arquitetura X',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-user'
    })
    sessions.appendTurn({
      role: 'assistant',
      text: 'TUPINIQUIM_SESSION_OK',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-assistant'
    })

    expect(sessions.unseenPublicContext('ollama')).toEqual({ text: undefined, turnIds: [] })
    const firstCodex = sessions.unseenPublicContext('codex-app-server')
    expect(firstCodex.text).toContain('arquitetura X')
    expect(firstCodex.text).toContain('TUPINIQUIM_SESSION_OK')
    expect(firstCodex.turnIds).toHaveLength(2)
    const retryBeforeAck = sessions.unseenPublicContext('codex-app-server')
    expect(retryBeforeAck.turnIds).toEqual(firstCodex.turnIds)
    sessions.acknowledgeProviderContext('codex-app-server', firstCodex.turnIds)

    sessions.appendTurn({
      role: 'user',
      text: 'Continue a análise',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-codex',
      turnId: 'turn-codex-user'
    })
    sessions.appendTurn({
      role: 'assistant',
      text: 'CONTEXTO_TUPINIQUIM_OK',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-codex',
      turnId: 'turn-codex-assistant'
    })
    expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })

    const backToOllama = sessions.unseenPublicContext('ollama')
    expect(backToOllama.text).toContain('Continue a análise')
    expect(backToOllama.text).toContain('CONTEXTO_TUPINIQUIM_OK')
    expect(backToOllama.text).not.toContain('arquitetura X')
    expect(sessions.publicProviderContext()).toContain('arquitetura X')
  })

  it('recusa troca de workspace enquanto o runtime está ocupado', () => {
    expect(() => assertIdleForWorkspaceSwitch(true)).toThrow(workspaceSwitchBusyMessage)
    expect(() => assertIdleForWorkspaceSwitch(false)).not.toThrow()
  })

  it('ignora threadId público de outro workspace e zera o status exposto sem binding', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    expect(sessions.scopedStatus(statusFor('thread-a', 'turn-a')).activeThreadId).toBe('thread-a')

    sessions.switchWorkspace(workspaceB)
    expect(sessions.threadFor('ollama')).toBeUndefined()
    expect(sessions.resolveChatThread('ollama', 'thread-a')).toBeUndefined()
    expect(sessions.acceptsProviderEvent('ollama', 'thread-a')).toBe(false)
    expect(sessions.acceptsProviderEvent('ollama', 'thread-nova-b')).toBe(true)
    expect(sessions.scopedStatus(statusFor('thread-a', 'turn-a'))).toMatchObject({
      activeThreadId: null,
      activeTurnId: null
    })

    sessions.switchWorkspace(workspaceA)
    expect(sessions.threadFor('ollama')).toBe('thread-a')
    expect(sessions.resolveChatThread('ollama', 'thread-forjada')).toBe('thread-a')
  })

  it('não reconhece o contexto incremental em ERROR ou CANCELLED e reconhece só no sucesso', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'Meu projeto usa arquitetura X',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-user'
    })
    const pending = sessions.unseenPublicContext('codex-app-server')
    expect(pending.turnIds).toHaveLength(1)

    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-error', pending.turnIds)
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-error', 'FAILED')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })

    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-cancel', pending.turnIds)
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-cancel', 'CANCELLED')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })

    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-ok', pending.turnIds)
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-ok', 'completed')
    expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('reconhece contexto pendente mesmo se TURN_COMPLETED chegar antes do notePending', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'contexto antecipado',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-user'
    })
    const pending = sessions.unseenPublicContext('codex-app-server')
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-race', 'COMPLETED')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-race', pending.turnIds)
    expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('não deixa settlement residual em turnos sem sessionContext', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    for (let index = 0; index < 5; index += 1) {
      const turnId = `turn-local-${String(index)}`
      sessions.notePendingContext('ollama', 'thread-ollama', turnId, [])
      sessions.completeTurn('ollama', 'thread-ollama', turnId, index % 2 === 0 ? 'COMPLETED' : 'FAILED')
    }
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-race-empty', 'SUCCESS')
    sessions.notePendingContext('ollama', 'thread-ollama', 'turn-race-empty', [])
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('isola lifecycle e inProgress quando dois providers reutilizam o mesmo turnId', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'qwen-local')
    sessions.bindProviderThread('codex-app-server', 'thread-b', 'codex-test-model')
    sessions.appendTurn({
      role: 'user',
      text: 'contexto exclusivo de A',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-a',
      turnId: 'turn-user-a'
    })
    const pendingA = sessions.unseenPublicContext('codex-app-server')
    sessions.notePendingContext('codex-app-server', 'thread-b', 'turn-1', pendingA.turnIds)
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-a',
      turnId: 'turn-1',
      text: 'delta-A'
    })
    sessions.applyAssistantDelta({
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-b',
      turnId: 'turn-1',
      text: 'delta-B'
    })
    sessions.notePendingContext('ollama', 'thread-a', 'turn-1', [])
    sessions.completeTurn('ollama', 'thread-a', 'turn-1', 'COMPLETED')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(expect.arrayContaining(pendingA.turnIds))
    sessions.applyAssistantDelta({
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-b',
      turnId: 'turn-1',
      text: '+ainda-B'
    })
    const snapshot = sessions.snapshot()
    expect(snapshot?.turns.some((turn) => turn.provider === 'ollama' && turn.text === 'delta-A')).toBe(true)
    expect(snapshot?.turns.some((turn) => turn.provider === 'codex-app-server' && turn.text === 'delta-B+ainda-B')).toBe(true)
    sessions.completeTurn('codex-app-server', 'thread-b', 'turn-1', 'COMPLETED')
    const unseenAfterAck = sessions.unseenPublicContext('codex-app-server').turnIds
    expect(pendingA.turnIds.every((turnId) => !unseenAfterAck.includes(turnId))).toBe(true)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('recusa send, troca de provider e segundo configure enquanto a troca de workspace está suspensa', async () => {
    const gate = new PrivilegedRuntimeGate()
    let release = (): void => undefined
    const suspended = new Promise<string>((resolve) => { release = () => resolve(workspaceB) })
    gate.beginWorkspaceSwitch()
    const configure = (async (): Promise<string> => {
      try {
        return await suspended
      } finally {
        gate.endWorkspaceSwitch()
      }
    })()
    expect(() => gate.beginSend()).toThrow(agentRuntimeBusyMessage)
    expect(() => gate.beginProviderSelect()).toThrow(agentRuntimeBusyMessage)
    expect(() => gate.beginWorkspaceSwitch()).toThrow(workspaceSwitchBusyMessage)
    release()
    await expect(configure).resolves.toBe(workspaceB)
    expect(gate.locked()).toBe(false)
    expect(() => gate.beginSend()).not.toThrow()
    gate.endSend()
  })

  it('libera o lock de workspace mesmo se configure falhar', () => {
    const gate = new PrivilegedRuntimeGate()
    gate.beginWorkspaceSwitch()
    try {
      throw new Error('stat falhou')
    } catch {
      // expected
    } finally {
      gate.endWorkspaceSwitch()
    }
    expect(gate.locked()).toBe(false)
    expect(() => gate.beginWorkspaceSwitch()).not.toThrow()
    gate.endWorkspaceSwitch()
  })
})

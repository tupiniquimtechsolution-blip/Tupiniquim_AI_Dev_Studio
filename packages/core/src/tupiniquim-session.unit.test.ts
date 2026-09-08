import { describe, expect, it } from 'vitest'
import { maxTupiniquimSessionContextChars, type AIStatus } from '@tupiniquim/contracts'
import { PrivilegedRuntimeGate, TupiniquimSessionService, agentRuntimeBusyMessage, assertIdleForWorkspaceSwitch, shouldCompleteTurnFromError, workspaceSwitchBusyMessage } from './tupiniquim-session'

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

  it('não finaliza lifecycle Codex em ERROR/RETRYING e reconhece só no TURN_COMPLETED', () => {
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
    expect(shouldCompleteTurnFromError('codex-app-server', 'RETRYING')).toBe(false)
    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-retry', pending.turnIds)
    if (shouldCompleteTurnFromError('codex-app-server', 'RETRYING')) {
      sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-retry', 'RETRYING')
    }
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-retry', 'RETRYING')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 1, settledSuccess: 0, settledFailure: 0 })

    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-retry', 'COMPLETED')
    expect(sessions.unseenPublicContext('codex-app-server')).toEqual({ text: undefined, turnIds: [] })
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('Codex ERROR/FAILED depois TURN_COMPLETED/FAILED não reconhece contexto e não deixa resíduo', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'qwen-local')
    sessions.appendTurn({
      role: 'user',
      text: 'contexto para retry Codex',
      provider: 'ollama',
      model: 'qwen-local',
      threadId: 'thread-ollama',
      turnId: 'turn-ollama-user'
    })
    const pending = sessions.unseenPublicContext('codex-app-server')
    expect(shouldCompleteTurnFromError('codex-app-server', 'FAILED')).toBe(false)
    sessions.notePendingContext('codex-app-server', 'thread-codex', 'turn-fail', pending.turnIds)
    if (shouldCompleteTurnFromError('codex-app-server', 'FAILED')) {
      sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-fail', 'FAILED')
    }
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 1, settledSuccess: 0, settledFailure: 0 })

    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-fail', 'FAILED')
    sessions.completeTurn('codex-app-server', 'thread-codex', 'turn-fail', 'FAILED')
    expect(sessions.unseenPublicContext('codex-app-server').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })

  it('Ollama ERROR/FAILED é terminal, não reconhece o delta e zera o resíduo', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('codex-app-server', 'thread-codex', 'codex-test-model')
    sessions.appendTurn({
      role: 'user',
      text: 'contexto para Ollama',
      provider: 'codex-app-server',
      model: 'codex-test-model',
      threadId: 'thread-codex',
      turnId: 'turn-codex-user'
    })
    const pending = sessions.unseenPublicContext('ollama')
    expect(pending.turnIds).toHaveLength(1)
    expect(shouldCompleteTurnFromError('ollama', 'FAILED')).toBe(true)
    sessions.notePendingContext('ollama', 'thread-ollama', 'turn-fail', pending.turnIds)
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-fail', 'FAILED')
    expect(sessions.unseenPublicContext('ollama').turnIds).toEqual(pending.turnIds)
    expect(sessions.lifecycleResidue()).toEqual({ pending: 0, settledSuccess: 0, settledFailure: 0 })
  })
})

describe('TupiniquimSessionService — lifecycle efêmero bounded (Incremento 4/4)', () => {
  const driveTerminalTurn = (sessions: TupiniquimSessionService, index: number, status: string): void => {
    sessions.appendTurn({
      role: 'user',
      text: `pergunta ${String(index)}`,
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-ollama',
      turnId: `turn-${String(index)}`
    })
    sessions.applyAssistantDelta({
      provider: 'ollama',
      model: 'modelo-a',
      threadId: 'thread-ollama',
      turnId: `turn-${String(index)}`,
      text: `resposta ${String(index)}`
    })
    sessions.completeTurn('ollama', 'thread-ollama', `turn-${String(index)}`, status)
  }

  it('settledSuccess/finalizedTurns: 257 entradas → 256, eviction oldest-first, mais recente preservada', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')

    for (let index = 1; index <= 257; index += 1) driveTerminalTurn(sessions, index, 'COMPLETED')

    const lifecycle = sessions.ephemeralLifecycle()
    expect(lifecycle.settledSuccess).toBe(256)
    expect(lifecycle.finalizedTurns).toBe(256)
    expect(lifecycle.settledFailure).toBe(0)

    // Eviction oldest-first determinística: a 1ª entrada saiu, a 2ª ficou.
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-1')).toEqual({
      finalized: false,
      settledSuccess: false,
      settledFailure: false
    })
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-2').finalized).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-2').settledSuccess).toBe(true)
    // A entrada MAIS RECENTE (257ª) permanece retida.
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-257').finalized).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-257').settledSuccess).toBe(true)
  })

  it('settledFailure/finalizedTurns: 257 falhas → 256, eviction oldest-first', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')

    for (let index = 1; index <= 257; index += 1) driveTerminalTurn(sessions, index, 'FAILED')

    const lifecycle = sessions.ephemeralLifecycle()
    expect(lifecycle.settledFailure).toBe(256)
    expect(lifecycle.finalizedTurns).toBe(256)
    expect(lifecycle.settledSuccess).toBe(0)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-1').settledFailure).toBe(false)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-2').settledFailure).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-257').settledFailure).toBe(true)
  })

  it('mixed success/failure: cada set respeita o próprio teto de 256 de forma independente', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')

    // 520 turns terminais: 260 COMPLETED (pares) + 260 FAILED (ímpares) —
    // cada set estoura o próprio teto de 256 de forma independente.
    for (let index = 1; index <= 520; index += 1) {
      driveTerminalTurn(sessions, index, index % 2 === 0 ? 'COMPLETED' : 'FAILED')
    }

    const lifecycle = sessions.ephemeralLifecycle()
    expect(lifecycle.settledSuccess).toBe(256)
    expect(lifecycle.settledFailure).toBe(256)
    // finalizedTurns acumula AMBOS os caminhos: pico 520 → teto 256 com
    // eviction oldest-first (turns 1..264 saem; turn-265 é o primeiro retido).
    expect(lifecycle.finalizedTurns).toBe(256)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-265').finalized).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-264').finalized).toBe(false)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-520').finalized).toBe(true)
    // Sets específicos: pares 2,4,6,8 evictados de settledSuccess (260→256);
    // o par 10 é o primeiro retido. Ímpares 1,3,5,7 evictados de
    // settledFailure; o ímpar 9 é o primeiro retido.
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-8').settledSuccess).toBe(false)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-10').settledSuccess).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-7').settledFailure).toBe(false)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-9').settledFailure).toBe(true)
    // A entrada mais recente de cada caminho permanece.
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-520').settledSuccess).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-519').settledFailure).toBe(true)
  })

  it('turn duplicado retido é idempotente; turn MUITO antigo evictado é reprocessado sem duplicar conversa', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')

    for (let index = 1; index <= 257; index += 1) driveTerminalTurn(sessions, index, 'COMPLETED')

    // Duplicado do turn retido (turn-257): early-return do finalizedTurns —
    // nenhum set muda de tamanho.
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-257', 'COMPLETED')
    expect(sessions.ephemeralLifecycle().settledSuccess).toBe(256)
    expect(sessions.ephemeralLifecycle().finalizedTurns).toBe(256)

    // Turn evictado (turn-1) completado de novo: é reprocessado como novo
    // (re-adiciona o id e evicta o próximo mais antigo), MAS nenhuma conversa
    // é duplicada — o append é keyed por inProgress, que está vazio.
    const turnsBefore = sessions.snapshot()?.turns.length ?? 0
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-1', 'COMPLETED')
    expect(sessions.ephemeralLifecycle().settledSuccess).toBe(256)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-1').settledSuccess).toBe(true)
    expect(sessions.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-2').settledSuccess).toBe(false)
    expect(sessions.snapshot()?.turns.length ?? 0).toBe(turnsBefore)
  })

  it('snapshot durável NUNCA contém os sets efêmeros bounded; hydrate começa com lifecycle vazio', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')

    for (let index = 1; index <= 260; index += 1) driveTerminalTurn(sessions, index, 'COMPLETED')

    const durable = sessions.durableSnapshotFor(workspaceA)
    expect(durable).not.toBeNull()
    const serialized = JSON.stringify(durable)
    // Contrato estrutural: o snapshot durável possui exatamente session,
    // turns, providerBindings e seenByProvider — nenhum lifecycle efêmero.
    expect(Object.keys(durable ?? {}).sort()).toEqual(['providerBindings', 'seenByProvider', 'session', 'turns'])
    expect(serialized).not.toContain('finalizedTurns')
    expect(serialized).not.toContain('settledSuccess')
    expect(serialized).not.toContain('settledFailure')
    expect(serialized).not.toContain('unsuccessfulTurns')
    expect(serialized).not.toContain('pendingByTurn')
    expect(serialized).not.toContain('proposalIds')

    // Retenção durável independente do lifecycle: a janela canônica de 200
    // turns elegíveis continua aplicada.
    expect(durable?.turns.length).toBeLessThanOrEqual(200)

    // Hydrate do mesmo snapshot em outro processo-simulado começa com TODO o
    // lifecycle efêmero vazio.
    const restored = new TupiniquimSessionService()
    const thread = {
      id: 'thread-ollama',
      provider: 'ollama' as const,
      workspaceRoot: workspaceA,
      model: 'modelo-a',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const hydrated = restored.hydrateWorkspace(durable ?? { session: { id: 'x', workspaceRoot: workspaceA, createdAt: '', updatedAt: '' }, turns: [], providerBindings: [], seenByProvider: {} }, [thread], workspaceA)
    expect(hydrated.status).toBe('HYDRATED')
    expect(restored.ephemeralLifecycle()).toEqual({
      authority: null,
      proposalIds: 0,
      inProgress: 0,
      pending: 0,
      settledSuccess: 0,
      settledFailure: 0,
      finalizedTurns: 0,
      unsuccessfulTurns: 0
    })
    expect(restored.turnLifecycleMembership('ollama', 'thread-ollama', 'turn-260').finalized).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { maxDurableTupiniquimTurns, type TupiniquimTurn } from '@tupiniquim/contracts'
import { TupiniquimSessionService } from './tupiniquim-session'

/**
 * Wave 16 — Incremento 3/4: capture durável (durableSnapshotFor /
 * durableConversationForThread) e MODEL PROVENANCE REAL no bind.
 *
 * Invariantes under test:
 * - troca real A → B na mesma thread NUNCA reescreve o model de turns antigos;
 * - assistant em streaming (inProgress) nunca é durável;
 * - assistant FAILED/CANCELLED (parcial) nunca é durável;
 * - nenhum assistant terminal sem user causal entra no snapshot;
 * - retenção de 200 preserva pares user→assistant;
 * - seen é podado para ids retidos.
 */

const workspaceA = 'F:\\CODEX\\workspace-a'
const workspaceB = 'F:\\CODEX\\workspace-b'

const appendUser = (sessions: TupiniquimSessionService, input: { text: string; turnId: string; model?: string | null; threadId?: string }): TupiniquimTurn =>
  sessions.appendTurn({
    role: 'user',
    text: input.text,
    provider: 'ollama',
    model: input.model === undefined ? 'modelo-a' : input.model,
    threadId: input.threadId ?? 'thread-ollama',
    turnId: input.turnId
  })

const appendAssistant = (sessions: TupiniquimSessionService, input: { text: string; turnId: string; model?: string | null }): TupiniquimTurn =>
  sessions.appendTurn({
    role: 'assistant',
    text: input.text,
    provider: 'ollama',
    model: input.model === undefined ? 'modelo-a' : input.model,
    threadId: 'thread-ollama',
    turnId: input.turnId
  })

describe('TupiniquimSessionService — capture durável e provenance real de model', () => {
  it('troca real A → B na mesma thread não reescreve o model dos turns antigos', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    const first = appendUser(sessions, { text: 'primeira pergunta', turnId: 'turn-1' })
    appendAssistant(sessions, { text: 'primeira resposta', turnId: 'turn-1' })

    // Usuário seleciona outro modelo: o bind seguinte troca o model corrente.
    const binding = sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-b')

    expect(binding.model).toBe('modelo-b')
    expect(sessions.modelFor('ollama')).toBe('modelo-b')
    expect(sessions.snapshot()?.turns.map((turn) => turn.model)).toEqual(['modelo-a', 'modelo-a'])
    expect(first.model).toBe('modelo-a')

    // O novo turn recebe exatamente o model efetivo do request (B), nunca A.
    const swapped = appendUser(sessions, { text: 'segunda pergunta', turnId: 'turn-2', model: 'modelo-b' })
    expect(swapped.model).toBe('modelo-b')
  })

  it('back-fill de model null continua válido quando o model fica conhecido pela primeira vez', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', null)
    appendUser(sessions, { text: 'pergunta sem model conhecido', turnId: 'turn-1', model: null })
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    expect(sessions.snapshot()?.turns.map((turn) => turn.model)).toEqual(['modelo-a'])
  })

  it('durableSnapshotFor exclui assistant em streaming, FAILED/CANCELLED e sem user causal', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    appendUser(sessions, { text: 'pergunta estável', turnId: 'turn-1' })
    appendAssistant(sessions, { text: 'resposta estável', turnId: 'turn-1' })
    // Assistant em streaming (deltas parciais): nunca durável.
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2', text: 'parcial ' })
    // Assistant FAILED: texto parcial nunca vira snapshot final.
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3', text: 'falha parcial' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-3', 'FAILED')
    // Turn de erro: role error nunca é durável.
    sessions.appendTurn({ role: 'error', text: 'Falha no provider.', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3' })

    const snapshot = sessions.durableSnapshotFor()
    expect(snapshot).not.toBeNull()
    expect(snapshot?.turns.map((turn) => turn.turnId)).toEqual(['turn-1', 'turn-1'])
    expect(snapshot?.turns.map((turn) => turn.role)).toEqual(['user', 'assistant'])
    expect(snapshot?.providerBindings).toEqual([{ provider: 'ollama', threadId: 'thread-ollama', model: 'modelo-a' }])

    // completion-before-send-return: assistant terminal SEM user causal não
    // entra em nenhum snapshot commitado.
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-4', text: 'resposta órfã' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-4', 'COMPLETED')
    const orphanFree = sessions.durableSnapshotFor()
    expect(orphanFree?.turns.some((turn) => turn.turnId === 'turn-4')).toBe(false)
  })

  it('durableSnapshotFor poda seen para ids retidos e respeita a retenção de 200 com pares preservados', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    for (let index = 0; index < maxDurableTupiniquimTurns + 10; index += 1) {
      const turnId = `turn-${index}`
      appendUser(sessions, { text: `pergunta ${index}`, turnId })
      appendAssistant(sessions, { text: `resposta ${index}`, turnId })
    }
    // User extra no fim: a janela de 200 agora começa num ASSISTANT cujo user
    // causal cai fora — o par tem que ser podado junto no mesmo snapshot.
    appendUser(sessions, { text: 'pergunta extra', turnId: 'turn-extra' })
    const allTurns = sessions.snapshot()?.turns ?? []
    const oldestUserId = allTurns[0]?.id ?? ''
    const lastUserId = allTurns.at(-1)?.id ?? ''
    // seen de outro provider referenciando um turn retido e um podado.
    sessions.acknowledgeProviderContext('codex-app-server', [oldestUserId, lastUserId])

    const snapshot = sessions.durableSnapshotFor()
    expect(snapshot).not.toBeNull()
    // 210 pares + user extra = 421 turns; janela cruza 200 cortando no meio de
    // um par → o assistant órfão de janela é podado: 199 turns retidos.
    expect(snapshot?.turns.length).toBe(maxDurableTupiniquimTurns - 1)
    // Nenhum assistant retido sem o user causal correspondente.
    const usersByTurnKey = new Set(snapshot?.turns.filter((turn) => turn.role === 'user').map((turn) => `${turn.provider}\u001f${turn.threadId}\u001f${turn.turnId}`))
    for (const turn of snapshot?.turns ?? []) {
      if (turn.role !== 'assistant') continue
      expect(usersByTurnKey.has(`${turn.provider}\u001f${turn.threadId}\u001f${turn.turnId}`)).toBe(true)
    }
    // seen podado no mesmo snapshot: somente ids ainda retidos.
    expect(snapshot?.seenByProvider['codex-app-server']).toEqual([lastUserId])
    expect(snapshot?.turns.some((turn) => turn.id === oldestUserId)).toBe(false)
  })

  it('durableConversationForThread devolve somente user/assistant públicos terminais da thread', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    sessions.bindProviderThread('codex-app-server', 'thread-codex', 'codex-test-model')
    appendUser(sessions, { text: 'pergunta ollama', turnId: 'turn-1' })
    appendAssistant(sessions, { text: 'resposta ollama', turnId: 'turn-1' })
    sessions.appendTurn({ role: 'user', text: 'pergunta codex', provider: 'codex-app-server', model: 'codex-test-model', threadId: 'thread-codex', turnId: 'turn-codex' })
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2', text: 'streaming' })
    sessions.appendTurn({ role: 'error', text: 'Falha no provider.', provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3' })

    expect(sessions.durableConversationForThread('thread-ollama')).toEqual([
      { role: 'user', content: 'pergunta ollama' },
      { role: 'assistant', content: 'resposta ollama' }
    ])
    expect(sessions.durableConversationForThread('thread-codex')).toEqual([
      { role: 'user', content: 'pergunta codex' }
    ])
    expect(sessions.durableConversationForThread('thread-desconhecida')).toEqual([])
  })

  it('lifecycle efêmero registra unsuccessfulTurns somente em término não bem-sucedido', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-ollama', 'modelo-a')
    appendUser(sessions, { text: 'pergunta', turnId: 'turn-1' })
    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-1', text: 'ok' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-1', 'COMPLETED')
    expect(sessions.ephemeralLifecycle().unsuccessfulTurns).toBe(0)

    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-2', text: 'vai falhar' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-2', 'RETRYING')
    expect(sessions.ephemeralLifecycle().unsuccessfulTurns).toBe(0)
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-2', 'FAILED')
    expect(sessions.ephemeralLifecycle().unsuccessfulTurns).toBe(1)

    sessions.applyAssistantDelta({ provider: 'ollama', model: 'modelo-a', threadId: 'thread-ollama', turnId: 'turn-3', text: 'vai cancelar' })
    sessions.completeTurn('ollama', 'thread-ollama', 'turn-3', 'CANCELLED')
    expect(sessions.ephemeralLifecycle().unsuccessfulTurns).toBe(2)
  })

  it('durableSnapshotFor captura por workspace mesmo com outro workspace ativo', () => {
    const sessions = new TupiniquimSessionService()
    sessions.open(workspaceA)
    sessions.bindProviderThread('ollama', 'thread-a', 'modelo-a')
    appendUser(sessions, { text: 'conversa do workspace A', turnId: 'turn-1', threadId: 'thread-a' })
    sessions.open(workspaceB)
    sessions.bindProviderThread('codex-app-server', 'thread-b', 'codex-test-model')

    const snapshotA = sessions.durableSnapshotFor(workspaceA)
    expect(snapshotA?.session.workspaceRoot).toBe(workspaceA)
    expect(snapshotA?.turns.map((turn) => turn.text)).toEqual(['conversa do workspace A'])
    expect(snapshotA?.providerBindings).toEqual([{ provider: 'ollama', threadId: 'thread-a', model: 'modelo-a' }])
    expect(sessions.durableSnapshotFor(workspaceB)?.providerBindings).toEqual([
      { provider: 'codex-app-server', threadId: 'thread-b', model: 'codex-test-model' }
    ])
    expect(sessions.durableSnapshotFor('F:\\CODEX\\workspace-inexistente')).toBeNull()
  })
})

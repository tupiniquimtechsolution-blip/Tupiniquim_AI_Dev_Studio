import { describe, expect, it } from 'vitest'
import { aiProviderStates, aiStatusSchema, type AIStatus } from '@tupiniquim/contracts'
import { codexAuthRequiredReason, resolveAgentSendCapability } from './agent-send-capability'

/**
 * Wave 17 — Issue #25: a fronteira de envio do renderer é uma regra pura e
 * fail-closed, testável sem Electron/DOM. O E2E prova o comportamento da UI
 * (botão, Ctrl+Enter, ausência de IPC); este teste prova a regra derivada.
 */
const providerStatus = (overrides: Partial<AIStatus>): AIStatus => aiStatusSchema.parse({
  provider: 'codex-app-server',
  state: 'READY',
  account: 'CHATGPT',
  version: '1.0.0',
  activeThreadId: null,
  activeTurnId: null,
  detail: null,
  ...overrides
})

const ollamaStatus = (overrides: Partial<AIStatus>): AIStatus => providerStatus({ provider: 'ollama', account: 'NONE', ...overrides })

const blockedStates = aiProviderStates.filter((state) => state !== 'READY')

describe('resolveAgentSendCapability — fronteira fail-closed do envio', () => {
  it('libera o envio apenas com o provider READY', () => {
    expect(resolveAgentSendCapability(providerStatus({}), '')).toEqual({ canSend: true, reason: null, requiresAuthentication: false })
    expect(resolveAgentSendCapability(providerStatus({}), 'modelo-irrelevante')).toEqual({ canSend: true, reason: null, requiresAuthentication: false })
  })

  it.each(blockedStates)('bloqueia o envio do Codex no estado %s', (state) => {
    const capability = resolveAgentSendCapability(providerStatus({ state }), '')
    expect(capability.canSend).toBe(false)
    expect(capability.reason).not.toBeNull()
  })

  it.each(blockedStates)('bloqueia o envio do Ollama no estado %s mesmo com modelo selecionado', (state) => {
    const capability = resolveAgentSendCapability(ollamaStatus({ state }), 'tupiniquim-local:latest')
    expect(capability.canSend).toBe(false)
    expect(capability.reason).not.toBeNull()
  })

  it('fail-closed quando o estado do provider ainda não foi observado', () => {
    const capability = resolveAgentSendCapability(null, 'tupiniquim-local:latest')
    expect(capability.canSend).toBe(false)
    expect(capability.reason).not.toBeNull()
    expect(capability.requiresAuthentication).toBe(false)
  })

  it('comunica AUTH_REQUIRED do Codex de forma explícita, sem retry automático', () => {
    const capability = resolveAgentSendCapability(providerStatus({ state: 'AUTH_REQUIRED', account: 'NONE' }), '')
    expect(capability).toEqual({ canSend: false, reason: codexAuthRequiredReason, requiresAuthentication: true })
    expect(codexAuthRequiredReason).toBe('Codex requer autenticação no runtime isolado do Tupiniquim.')
  })

  it('Ollama continua exigindo READY + modelo explicitamente selecionado', () => {
    expect(resolveAgentSendCapability(ollamaStatus({}), '')).toMatchObject({ canSend: false, requiresAuthentication: false })
    expect(resolveAgentSendCapability(ollamaStatus({}), '   ')).toMatchObject({ canSend: false })
    expect(resolveAgentSendCapability(ollamaStatus({}), 'tupiniquim-local:latest')).toMatchObject({ canSend: true, reason: null })
  })

  it('não faz fallback automático entre providers nem sugere outra rota de envio', () => {
    // Codex bloqueado permanece bloqueado mesmo com um modelo Ollama disponível
    // na UI: a regra não conhece o outro provider e nunca troca provider/model.
    const codexBlocked = resolveAgentSendCapability(providerStatus({ state: 'AUTH_REQUIRED', account: 'NONE' }), 'tupiniquim-local:latest')
    expect(codexBlocked.canSend).toBe(false)
    expect(codexBlocked.requiresAuthentication).toBe(true)
    expect(codexBlocked.reason ?? '').not.toMatch(/ollama/iu)

    // Ollama bloqueado permanece bloqueado mesmo com o Codex READY.
    const ollamaBlocked = resolveAgentSendCapability(ollamaStatus({ state: 'DISCONNECTED' }), '')
    expect(ollamaBlocked.canSend).toBe(false)
    expect(ollamaBlocked.reason ?? '').not.toMatch(/codex/iu)
  })

  it('nenhuma mensagem de bloqueio expõe credencial, token ou caminho de segredo', () => {
    for (const state of aiProviderStates) {
      for (const provider of ['codex-app-server', 'ollama'] as const) {
        for (const model of ['', 'tupiniquim-local:latest']) {
          const capability = resolveAgentSendCapability(providerStatus({ provider, state }), model)
          expect(JSON.stringify(capability)).not.toMatch(/auth\.json|credentials?|tokens?|cookies?|api[_-]?key|secret|sk-[A-Za-z0-9_-]{12,}/iu)
        }
      }
    }
  })
})

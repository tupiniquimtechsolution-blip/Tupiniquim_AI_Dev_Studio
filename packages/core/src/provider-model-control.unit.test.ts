import { describe, expect, it } from 'vitest'
import { providerCanSend, recommendProviderSwitch, validateExplicitProviderSelection, type UnifiedProviderState } from './provider-model-control'

const state: UnifiedProviderState = {
  provider: 'ollama',
  state: 'READY',
  selectedModel: 'qwen2.5-coder:3b',
  localModels: [
    { name: 'qwen2.5-coder:3b', provider: 'ollama', available: true, selected: true },
    { name: 'qwen3:8b', provider: 'ollama', available: false, selected: false },
    { name: '@cf/moonshotai/kimi-k2.6', provider: 'cloudflare-workers-ai', available: true, selected: false }
  ]
}

describe('provider/model control', () => {
  it('exige modelo Ollama explícito', () => {
    expect(() => validateExplicitProviderSelection(state, { provider: 'ollama', model: null })).toThrow(/explicit local model/i)
  })

  it('recusa modelo não disponível', () => {
    expect(() => validateExplicitProviderSelection(state, { provider: 'ollama', model: 'qwen3:8b' })).toThrow(/not currently available/i)
  })

  it('aceita seleção explícita disponível', () => {
    expect(validateExplicitProviderSelection(state, { provider: 'ollama', model: 'qwen2.5-coder:3b' })).toEqual({ provider: 'ollama', model: 'qwen2.5-coder:3b' })
  })

  it('mantém Codex sem modelo local acoplado', () => {
    expect(validateExplicitProviderSelection(state, { provider: 'codex-app-server', model: null })).toEqual({ provider: 'codex-app-server', model: null })
  })

  it('aceita Workers AI somente com modelo cloud disponível e explícito', () => {
    expect(validateExplicitProviderSelection(
      { ...state, provider: 'cloudflare-workers-ai', selectedModel: '@cf/moonshotai/kimi-k2.6' },
      { provider: 'cloudflare-workers-ai', model: '@cf/moonshotai/kimi-k2.6' }
    )).toEqual({ provider: 'cloudflare-workers-ai', model: '@cf/moonshotai/kimi-k2.6' })
    expect(providerCanSend({ ...state, provider: 'cloudflare-workers-ai', selectedModel: null })).toBe(false)
  })

  it('bloqueia envio quando runtime/modelo não estão prontos', () => {
    expect(providerCanSend({ ...state, state: 'DISCONNECTED' })).toBe(false)
    expect(providerCanSend({ ...state, selectedModel: null })).toBe(false)
    expect(providerCanSend(state)).toBe(true)
  })

  it('não produz fallback automático', () => {
    expect(() => recommendProviderSwitch()).toThrow(/user selection is required/i)
  })
})

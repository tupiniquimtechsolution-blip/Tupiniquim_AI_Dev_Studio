import { describe, expect, it } from 'vitest'
import {
  executionRuntimeView,
  parseOnboardingPreferences,
  resolveWebRoute,
  routePath,
  serializeOnboardingPreferences,
  studioSuggestions,
  type OnboardingPreferences
} from '../../apps/desktop/src/renderer/src/web/experience'
import { evaluateSend, providerTurnBlockReason } from '../../apps/desktop/src/renderer/src/agentGating'
import type { AIStatus } from '@tupiniquim/contracts'

describe('resolveWebRoute', () => {
  it('mostra a landing pública na raiz para quem nunca entrou', () => {
    expect(resolveWebRoute('/', false)).toBe('landing')
    expect(resolveWebRoute('', false)).toBe('landing')
    expect(resolveWebRoute('/qualquer-coisa', false)).toBe('landing')
  })

  it('volta direto para o Studio na raiz após o usuário entrar (session recovery)', () => {
    expect(resolveWebRoute('/', true)).toBe('studio')
    expect(resolveWebRoute('/desconhecido', true)).toBe('studio')
  })

  it('respeita rotas explícitas independentemente do estado', () => {
    expect(resolveWebRoute('/onboarding', false)).toBe('onboarding')
    expect(resolveWebRoute('/onboarding/', true)).toBe('onboarding')
    expect(resolveWebRoute('/studio', false)).toBe('studio')
    expect(resolveWebRoute('/workbench', true)).toBe('workbench')
    expect(resolveWebRoute('/landing', true)).toBe('landing')
  })

  it('routePath é o inverso de resolveWebRoute para rotas canônicas', () => {
    for (const route of ['onboarding', 'studio', 'workbench'] as const) {
      expect(resolveWebRoute(routePath(route), false)).toBe(route)
    }
    expect(routePath('landing')).toBe('/')
  })
})

describe('onboarding preferences', () => {
  const valid: OnboardingPreferences = {
    intent: 'PROGRAMACAO',
    level: 'AVANCADO',
    interests: ['TypeScript', 'DevOps'],
    execution: 'CLOUD_PLUS_RUNTIME',
    model: '@cf/zai-org/glm-4.7-flash',
    completedAt: '2026-09-30T00:00:00.000Z'
  }

  it('serializa e reparseia sem perdas', () => {
    expect(parseOnboardingPreferences(serializeOnboardingPreferences(valid))).toEqual(valid)
  })

  it('rejeita payloads corrompidos ou com enums inventados (fail-closed)', () => {
    expect(parseOnboardingPreferences(null)).toBeNull()
    expect(parseOnboardingPreferences('not json')).toBeNull()
    expect(parseOnboardingPreferences('{}')).toBeNull()
    expect(parseOnboardingPreferences(JSON.stringify({ ...valid, intent: 'ROOT_ACCESS' }))).toBeNull()
    expect(parseOnboardingPreferences(JSON.stringify({ ...valid, execution: 'BARE_METAL' }))).toBeNull()
    expect(parseOnboardingPreferences(JSON.stringify({ ...valid, interests: [1, 2] }))).toBeNull()
  })

  it('aceita model null (padrão do produto)', () => {
    expect(parseOnboardingPreferences(JSON.stringify({ ...valid, model: null }))?.model).toBeNull()
  })
})

describe('executionRuntimeView', () => {
  it('preserva os quatro estados do Remote Runtime sem fallback silencioso', () => {
    expect(executionRuntimeView('READY')).toMatchObject({ state: 'READY', osCapabilities: true, tone: 'ok' })
    expect(executionRuntimeView('OFFLINE')).toMatchObject({ state: 'OFFLINE', osCapabilities: false, tone: 'warn' })
    expect(executionRuntimeView('MISCONFIGURED')).toMatchObject({ state: 'MISCONFIGURED', osCapabilities: false, tone: 'danger' })
    expect(executionRuntimeView('DISABLED')).toMatchObject({ state: 'DISABLED', osCapabilities: false })
    expect(executionRuntimeView(undefined)).toMatchObject({ state: 'DISABLED', osCapabilities: false })
    expect(executionRuntimeView(null)).toMatchObject({ state: 'DISABLED', osCapabilities: false })
  })

  it('estados sem capacidades de SO explicam o Runtime Local com mensagem específica por estado', () => {
    const offline = executionRuntimeView('OFFLINE')
    const disabled = executionRuntimeView('DISABLED')
    const misconfigured = executionRuntimeView('MISCONFIGURED')
    // Mensagens distintas por estado — nunca um erro genérico idêntico.
    expect(new Set([offline.detail, disabled.detail, misconfigured.detail]).size).toBe(3)
    expect(offline.detail).toContain('gateway não respondeu')
    expect(disabled.detail).toContain('Chat e Workers AI continuam disponíveis')
    expect(misconfigured.detail).toContain('Nenhum fallback silencioso')
    // Nenhum estado revela valores de credencial ou URLs concretas
    // (referenciar o NOME "URL/token" é permitido; o valor, nunca).
    for (const view of [offline, disabled, misconfigured]) {
      expect(view.detail).not.toMatch(/bearer\s|https?:\/\//i)
    }
  })
})

describe('studioSuggestions', () => {
  it('sempre produz sugestões acionáveis com modo e prompt', () => {
    for (const suggestion of studioSuggestions(null)) {
      expect(suggestion.title.length).toBeGreaterThan(0)
      expect(suggestion.prompt.length).toBeGreaterThan(0)
      expect(suggestion.mode.length).toBeGreaterThan(0)
    }
  })

  it('prioriza pesquisa quando a intenção declarada é PESQUISA', () => {
    const prefs: OnboardingPreferences = { intent: 'PESQUISA', level: 'INICIANTE', interests: [], execution: 'CLOUD', model: null, completedAt: '2026-09-30T00:00:00.000Z' }
    expect(studioSuggestions(prefs)[0]?.mode).toBe('RESEARCH')
  })
})

describe('agentGating (regra compartilhada Web/Desktop — Issue #25)', () => {
  const readyWorkersAi: AIStatus = {
    provider: 'cloudflare-workers-ai',
    state: 'READY',
    account: null,
    selectedModel: '@cf/zai-org/glm-4.7-flash',
    activeThreadId: null,
    activeTurnId: null,
    availableProviders: ['cloudflare-workers-ai']
  } as unknown as AIStatus

  it('bloqueia envio provider-backed sem provider READY (fail-closed)', () => {
    const decision = evaluateSend({ status: null, hasWorkspace: true, message: 'olá', isSending: false, selectedModel: '', mode: 'CHAT' })
    expect(decision.allowed).toBe(false)
    expect(decision.blockReason).toContain('Envio bloqueado até READY')
  })

  it('exige modelo explícito para Workers AI', () => {
    expect(providerTurnBlockReason(readyWorkersAi, '')).toContain('Workers AI')
    expect(providerTurnBlockReason(readyWorkersAi, '@cf/zai-org/glm-4.7-flash')).toBeNull()
  })

  it('permite envio READY com workspace, mensagem e modelo', () => {
    const decision = evaluateSend({ status: readyWorkersAi, hasWorkspace: true, message: 'construir app', isSending: false, selectedModel: '@cf/zai-org/glm-4.7-flash', mode: 'CHAT' })
    expect(decision).toEqual({ allowed: true, blockReason: null })
  })

  it('não bloqueia modos independentes de provider por readiness', () => {
    const decision = evaluateSend({ status: null, hasWorkspace: true, message: 'pesquisar x', isSending: false, selectedModel: '', mode: 'RESEARCH' })
    expect(decision.allowed).toBe(true)
  })
})

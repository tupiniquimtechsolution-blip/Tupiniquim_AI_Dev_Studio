export type UnifiedProviderId = 'codex-app-server' | 'ollama' | 'cloudflare-workers-ai'

export interface UnifiedLocalModel {
  name: string
  provider: UnifiedProviderId
  available: boolean
  selected: boolean
}

export interface UnifiedProviderState {
  provider: UnifiedProviderId
  state: 'READY' | 'BUSY' | 'AUTH_REQUIRED' | 'DISCONNECTED' | 'STARTING' | 'ERROR' | 'STOPPED' | 'NOT_INSTALLED'
  selectedModel: string | null
  localModels: UnifiedLocalModel[]
}

export interface UnifiedProviderSelection {
  provider: UnifiedProviderId
  model: string | null
}

export const providerRequiresExplicitModel = (provider: UnifiedProviderId): boolean =>
  provider !== 'codex-app-server'

export const validateExplicitProviderSelection = (
  current: UnifiedProviderState,
  requested: UnifiedProviderSelection
): UnifiedProviderSelection => {
  if (requested.provider === 'codex-app-server') {
    if (requested.model !== null) throw new Error('Codex provider selection must not carry a local model.')
    return { provider: requested.provider, model: null }
  }

  if (requested.model === null || requested.model.trim() === '') {
    if (requested.provider === 'ollama') {
      throw new Error('Ollama selection requires an explicit local model.')
    }
    throw new Error(`${requested.provider} selection requires an explicit model.`)
  }
  const model = current.localModels.find((candidate) =>
    candidate.provider === requested.provider && candidate.name === requested.model
  )
  if (model === undefined || !model.available) {
    throw new Error('Requested provider/model is not currently available on this runtime.')
  }
  return { provider: requested.provider, model: model.name }
}

export const providerCanSend = (state: UnifiedProviderState): boolean => {
  if (state.state !== 'READY') return false
  if (providerRequiresExplicitModel(state.provider)) {
    return state.selectedModel !== null && state.selectedModel.trim() !== ''
  }
  return true
}

export const recommendProviderSwitch = (): never => {
  throw new Error('Automatic provider/model fallback is forbidden; user selection is required.')
}

export type UnifiedProviderId = 'codex-app-server' | 'ollama'

export interface UnifiedLocalModel {
  name: string
  provider: 'ollama'
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

export const validateExplicitProviderSelection = (
  current: UnifiedProviderState,
  requested: UnifiedProviderSelection
): UnifiedProviderSelection => {
  if (requested.provider === 'codex-app-server') {
    if (requested.model !== null) throw new Error('Codex provider selection must not carry a local model.')
    return { provider: requested.provider, model: null }
  }

  if (requested.model === null || requested.model.trim() === '') {
    throw new Error('Ollama selection requires an explicit local model.')
  }
  const model = current.localModels.find((candidate) => candidate.name === requested.model)
  if (model === undefined || !model.available) throw new Error('Requested Ollama model is not currently available.')
  return { provider: 'ollama', model: model.name }
}

export const providerCanSend = (state: UnifiedProviderState): boolean => {
  if (state.state !== 'READY') return false
  if (state.provider === 'ollama') return state.selectedModel !== null && state.selectedModel.trim() !== ''
  return true
}

export const recommendProviderSwitch = (): never => {
  throw new Error('Automatic provider/model fallback is forbidden; user selection is required.')
}

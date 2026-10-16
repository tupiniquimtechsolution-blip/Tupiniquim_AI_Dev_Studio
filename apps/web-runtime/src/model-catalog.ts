export const WEB_PROVIDER = 'cloudflare-workers-ai' as const
export const WEB_RUNTIME = 'workers-ai' as const

export const WEB_MODELS = [
  {
    id: '@cf/zai-org/glm-4.7-flash',
    displayName: 'Zhipu GLM-4.7-Flash',
    capabilities: ['chat', 'plan', 'research', 'coding'],
    default: true
  },
  {
    id: '@cf/google/gemma-4-26b-a4b-it',
    displayName: 'Google Gemma 4 26B A4B IT',
    capabilities: ['chat', 'research', 'coding'],
    default: false
  }
] as const

export type WebModelId = typeof WEB_MODELS[number]['id']

export const WEB_DEFAULT_MODEL: WebModelId =
  WEB_MODELS.find((model) => model.default)?.id ?? WEB_MODELS[0].id

export const isWebModelId = (value: string | null | undefined): value is WebModelId =>
  typeof value === 'string' && WEB_MODELS.some((model) => model.id === value)

export const resolveWebModel = (requested: string | null | undefined): WebModelId =>
  isWebModelId(requested) ? requested : WEB_DEFAULT_MODEL

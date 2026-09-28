export const WEB_PROVIDER = 'cloudflare-workers-ai' as const
export const WEB_RUNTIME = 'workers-ai' as const

export const WEB_MODELS = [
  {
    id: '@cf/moonshotai/kimi-k2.6',
    displayName: 'Moonshot Kimi K2.6',
    capabilities: ['chat', 'plan', 'research', 'coding'],
    default: true
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    displayName: 'Meta Llama 3.3 70B Instruct FP8 Fast',
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

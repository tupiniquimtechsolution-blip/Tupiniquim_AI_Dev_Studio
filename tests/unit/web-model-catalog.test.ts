import { describe, expect, it } from 'vitest'
import { WEB_DEFAULT_MODEL, WEB_MODELS, WEB_PROVIDER, WEB_RUNTIME, isWebModelId, resolveWebModel } from '../../apps/web-runtime/src/model-catalog'

describe('Web Workers AI model catalog', () => {
  it('exposes a stable Web provider/runtime and one explicit default model', () => {
    expect(WEB_PROVIDER).toBe('cloudflare-workers-ai')
    expect(WEB_RUNTIME).toBe('workers-ai')
    expect(WEB_MODELS.filter((model) => model.default)).toHaveLength(1)
    expect(isWebModelId(WEB_DEFAULT_MODEL)).toBe(true)
  })

  it('keeps a compatible requested model and fails closed to the default for unknown client headers', () => {
    const alternate = WEB_MODELS.find((model) => !model.default)?.id
    expect(alternate).toBeDefined()
    expect(resolveWebModel(alternate)).toBe(alternate)
    expect(resolveWebModel('@cf/unknown/not-allowed')).toBe(WEB_DEFAULT_MODEL)
  })

  it('publishes capability metadata for every selectable Web model', () => {
    expect(WEB_MODELS.every((model) => model.capabilities.length > 0)).toBe(true)
    expect(WEB_MODELS.every((model) => model.id.startsWith('@cf/'))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { WebState } from '../../apps/web-runtime/src/web-state'
import { promptTemplateSchema, compiledPromptSchema } from '../../packages/contracts/src/prompt'

const makeStorage = () => {
  const data = new Map<string, unknown>()
  return {
    get: async <T>(key: string): Promise<T | undefined> => structuredClone(data.get(key)) as T | undefined,
    put: async <T>(key: string, value: T): Promise<void> => { data.set(key, structuredClone(value)) },
    delete: async (key: string): Promise<boolean> => data.delete(key)
  }
}

const call = async (state: WebState, action: string, input: unknown = {}) => {
  const response = await state.fetch(new Request('https://state.local/prompt', { method: 'POST', body: JSON.stringify({ action, input }) }))
  return response.json() as Promise<{ ok: boolean; value: unknown; error?: { message: string } }>
}

describe('Persistent Web Prompt Architect', () => {
  it('serializes versions, preserves history after restart, compiles and exports', async () => {
    const storage = makeStorage()
    const state = new WebState({ storage })
    const input = { name: 'Prompt test', content: 'Objetivo: {{objective}}\nRestrições: não sair do escopo.\nAceite: validar.', variables: [{ name: 'objective', description: 'Objetivo', required: true }] }
    const saved = await Promise.all([call(state, 'save', input), call(state, 'save', { ...input, content: input.content + '\nSegunda versão.' })])
    expect(saved.every((item) => item.ok)).toBe(true)
    const [left, right] = saved.map((item) => promptTemplateSchema.parse(item.value))
    expect(left?.version).toBe(1); expect(right?.version).toBe(2)
    expect(left?.id).not.toBe(right?.id)
    const restored = new WebState({ storage })
    expect(promptTemplateSchema.array().parse((await call(restored, 'list')).value)).toHaveLength(2)
    const missing = await call(restored, 'compile', { templateId: right?.id, values: {} })
    expect(missing.ok).toBe(false); expect(missing.error?.message).toContain('obrigatória')
    const compiled = await call(restored, 'compile', { templateId: right?.id, values: { objective: 'Verificar versão' } })
    expect(compiledPromptSchema.parse(compiled.value).content).toContain('Verificar versão')
    expect((await call(restored, 'compile', { templateId: right?.id, values: { objective: 'Validar', other: 'not declared' } })).ok).toBe(false)
    expect((await call(restored, 'compare', { leftId: left?.id, rightId: right?.id })).value).toMatchObject({ added: ['Segunda versão.'] })
    expect((await call(restored, 'export', { templateId: right?.id })).value).toContain('Versão: 2')
  })
})

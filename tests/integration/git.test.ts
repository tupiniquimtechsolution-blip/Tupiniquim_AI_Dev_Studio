import { describe, expect, it } from 'vitest'
import { GitAdapter } from '@tupiniquim/adapters'

describe('GitAdapter', () => {
  it('consulta o status com safe.directory somente para o workspace atual', async () => {
    const status = await new GitAdapter(() => process.cwd()).status()
    expect(status.branch).not.toBe('')
    expect(Array.isArray(status.entries)).toBe(true)
  })
})

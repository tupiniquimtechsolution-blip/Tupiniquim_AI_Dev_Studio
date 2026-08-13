import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPrivateEnvironment } from '@tupiniquim/adapters'

let fixture = ''
afterEach(async () => { if (fixture !== '') await rm(fixture, { recursive: true, force: true }) })

describe('ambiente privado', () => {
  it('carrega somente nomes permitidos e nunca os inclui em estruturas públicas', async () => {
    const temp = process.env.TEMP
    if (temp === undefined) throw new Error('TEMP indisponível.')
    fixture = await mkdtemp(path.join(temp, 'tupiniquim-secrets-'))
    await writeFile(path.join(fixture, '.env.local'), 'OPENAI_API_KEY=dummy-local-value\nUNTRUSTED_SECRET=blocked\n', 'utf8')
    const environment = await loadPrivateEnvironment(fixture)
    expect(environment.OPENAI_API_KEY).toBe('dummy-local-value')
    expect(environment.UNTRUSTED_SECRET).toBeUndefined()
  })
})

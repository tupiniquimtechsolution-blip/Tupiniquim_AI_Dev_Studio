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
    await writeFile(
      path.join(fixture, '.env.local'),
      [
        'OPENAI_API_KEY=dummy-local-value',
        'GOOGLE_TASKS_CLIENT_ID=dummy-client.apps.googleusercontent.com',
        'GOOGLE_TASKS_CLIENT_SECRET=dummy-client-secret',
        'UNTRUSTED_SECRET=blocked',
        ''
      ].join('\n'),
      'utf8'
    )
    const inheritedSecretName = 'TUPINIQUIM_UNTRUSTED_PARENT_SECRET'
    const previousInheritedSecret = process.env[inheritedSecretName]
    process.env[inheritedSecretName] = 'must-not-leak'

    try {
      const environment = await loadPrivateEnvironment(fixture)
      expect(environment.OPENAI_API_KEY).toBe('dummy-local-value')
      expect(environment.GOOGLE_TASKS_CLIENT_ID).toBe('dummy-client.apps.googleusercontent.com')
      expect(environment.GOOGLE_TASKS_CLIENT_SECRET).toBe('dummy-client-secret')
      expect(environment.UNTRUSTED_SECRET).toBeUndefined()
      expect(environment[inheritedSecretName]).toBeUndefined()
    } finally {
      if (previousInheritedSecret === undefined) delete process.env[inheritedSecretName]
      else process.env[inheritedSecretName] = previousInheritedSecret
    }
  })
})

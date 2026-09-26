import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { expect, it } from 'vitest'
import { ProviderPreferenceStore } from './provider-preferences'

it('persists explicit choices across restart and rejects unknown/secret fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'provider-choice-'))
  try {
    const store = new ProviderPreferenceStore(root)
    expect(await store.load()).toEqual({ provider: 'codex-app-server', model: null })
    await Promise.all([
      store.save({ provider: 'ollama', model: 'custom:a' }),
      store.save({ provider: 'ollama', model: 'custom:b' })
    ])
    expect(await new ProviderPreferenceStore(root).load()).toEqual({ provider: 'ollama', model: 'custom:b' })
    await writeFile(path.join(root, 'provider-choice.json'), JSON.stringify({ provider: 'ollama', model: 'a', token: 'not-allowed' }))
    await expect(store.load()).rejects.toThrow('invalida')
  } finally { await rm(root, { recursive: true, force: true }) }
})

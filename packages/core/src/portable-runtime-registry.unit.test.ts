import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inspectPortableLayout, portableRuntimeCanAutodownload, portableRuntimeMayDeleteExistingModels, resolvePortablePath } from './portable-runtime-registry'

describe('Portable Runtime Registry', () => {
  it('resolve somente caminhos relativos dentro da raiz autorizada', () => {
    const root = mkdtempSync(join(tmpdir(), 'tupiniquim-portable-'))
    expect(resolvePortablePath(root, 'models/ollama')).toBe(resolve(root, 'models/ollama'))
    expect(() => resolvePortablePath(root, '../outside')).toThrow(/escapes/i)
    expect(() => resolvePortablePath(root, resolve(root, 'models'))).toThrow(/must be relative/i)
  })

  it('detecta Ollama existente sem instalar ou alterar nada', () => {
    const root = mkdtempSync(join(tmpdir(), 'tupiniquim-portable-'))
    const runtimeDir = join(root, 'runtime', 'ollama')
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(join(runtimeDir, 'ollama.exe'), 'fixture')
    const layout = inspectPortableLayout(root)
    const ollama = layout.runtimes.find((runtime) => runtime.id === 'ollama')
    expect(ollama?.state).toBe('AVAILABLE')
    expect(layout.directories.models).toBe(resolve(root, 'models'))
  })

  it('marca runtime ausente como NOT_INSTALLED em vez de PASS implícito', () => {
    const root = mkdtempSync(join(tmpdir(), 'tupiniquim-portable-'))
    const layout = inspectPortableLayout(root)
    expect(layout.runtimes.find((runtime) => runtime.id === 'ollama')?.state).toBe('NOT_INSTALLED')
  })

  it('proíbe downloads automáticos e remoção silenciosa de modelos', () => {
    expect(portableRuntimeCanAutodownload()).toBe(false)
    expect(portableRuntimeMayDeleteExistingModels()).toBe(false)
  })
})

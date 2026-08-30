import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceAdapter } from '@tupiniquim/adapters'

let fixture = ''

beforeEach(async () => {
  const temp = process.env.TEMP
  if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'F:\\') throw new Error('TEMP de testes precisa estar em F:.')
  fixture = await mkdtemp(path.join(temp, 'tupiniquim-workspace-'))
  await mkdir(path.join(fixture, 'src'))
  await writeFile(path.join(fixture, 'src', 'index.ts'), 'export const value = 1\n', 'utf8')
})
afterEach(async () => { if (fixture !== '') await rm(fixture, { recursive: true, force: true }) })

describe('WorkspaceAdapter', () => {
  it('lista, lê e grava atomicamente com optimistic concurrency', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)
    const tree = await adapter.list('', 3)
    expect(tree[0]?.name).toBe('src')
    const current = await adapter.read('src/index.ts')
    const updated = await adapter.write('src/index.ts', 'export const value = 2\n', current.hash)
    expect(updated.content).toContain('value = 2')
    expect(await readFile(path.join(fixture, 'src', 'index.ts'), 'utf8')).toBe(updated.content)
  })

  it('detecta concorrência externa', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)
    const current = await adapter.read('src/index.ts')
    await writeFile(path.join(fixture, 'src', 'index.ts'), 'mudança externa', 'utf8')
    await expect(adapter.write('src/index.ts', 'minha mudança', current.hash)).rejects.toThrow('alterado externamente')
  })

  it('inspeciona o alvo sem expor conteúdo e exige arquivo regular', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)

    const existing = await adapter.inspectWriteTarget('src/index.ts')
    expect(existing).toEqual({
      exists: true,
      hash: createHash('sha256').update('export const value = 1\n').digest('hex')
    })
    expect(Object.keys(existing).sort()).toEqual(['exists', 'hash'])
    await expect(adapter.inspectWriteTarget('src/ausente.ts')).resolves.toEqual({ exists: false, hash: null })
    await expect(adapter.inspectWriteTarget('src')).rejects.toThrow('arquivo regular')
  })

  it('materializa CREATE e REPLACE nos happy paths', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)

    const created = await adapter.applyWriteEffect('generated/nova.ts', 'export const nova = true\n', 'CREATE', null)
    expect(created.content).toBe('export const nova = true\n')

    const baseline = await adapter.inspectWriteTarget('src/index.ts')
    expect(baseline.exists).toBe(true)
    const replaced = await adapter.applyWriteEffect('src/index.ts', 'export const value = 2\n', 'REPLACE', baseline.hash)
    expect(replaced.content).toBe('export const value = 2\n')
  })

  it('preserva arquivo preexistente quando CREATE é recusado', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)

    await expect(
      adapter.applyWriteEffect('src/index.ts', 'conteúdo que não pode vencer\n', 'CREATE', null)
    ).rejects.toThrow('alvo inexistente')
    await expect(readFile(path.join(fixture, 'src', 'index.ts'), 'utf8')).resolves.toBe('export const value = 1\n')
  })

  it('recusa REPLACE quando o alvo está ausente', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)

    await expect(
      adapter.applyWriteEffect('src/ausente.ts', 'novo conteúdo\n', 'REPLACE', '0'.repeat(64))
    ).rejects.toThrow('arquivo existente')
  })

  it('recusa REPLACE alterado externamente e preserva a versão externa', async () => {
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)
    const baseline = await adapter.inspectWriteTarget('src/index.ts')
    expect(baseline.exists).toBe(true)
    await writeFile(path.join(fixture, 'src', 'index.ts'), 'alteração externa\n', 'utf8')

    await expect(
      adapter.applyWriteEffect('src/index.ts', 'efeito aprovado\n', 'REPLACE', baseline.hash)
    ).rejects.toThrow('alterado externamente')
    await expect(readFile(path.join(fixture, 'src', 'index.ts'), 'utf8')).resolves.toBe('alteração externa\n')
  })

  it('gera contexto limitado somente com metadados do workspace', async () => {
    await writeFile(path.join(fixture, '.env'), '', 'utf8')
    const adapter = new WorkspaceAdapter()
    await adapter.configure(fixture)
    const context = await adapter.context(1, 3)
    expect(context).toMatchObject({ contentPolicy: 'METADATA_ONLY', truncated: true, entries: [{ relativePath: 'src', kind: 'directory' }] })
    expect(JSON.stringify(context)).not.toContain('.env')
    expect(JSON.stringify(context)).not.toContain('export const value')
  })
})

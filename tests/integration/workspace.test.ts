import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceAdapter } from '@tupiniquim/adapters'

let fixture = ''

beforeEach(async () => {
  const temp = process.env.TEMP
  if (temp === undefined || path.parse(temp).root.toUpperCase() !== 'D:\\') throw new Error('TEMP de testes precisa estar em D:.')
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

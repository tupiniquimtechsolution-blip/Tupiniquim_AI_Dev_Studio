import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveConfinedWorkspacePath } from '../../apps/runtime-gateway/src/workspace-path'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }) })
describe('Gateway workspace path confinement', () => {
  it('rejects traversal, Windows device/ADS and external absolute paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gateway-path-')); roots.push(root)
    await fs.mkdir(path.join(root, 'sub'))
    expect(await resolveConfinedWorkspacePath(root, '/workspace/sub/new.txt')).toBe(path.join(root, 'sub', 'new.txt'))
    for (const target of ['../escape', '/tmp/outside', 'C:\\outside', 'file:stream', 'NUL.txt', 'sub/..', 'file.']) {
      await expect(resolveConfinedWorkspacePath(root, target)).rejects.toThrow()
    }
  })
  it('rejects links to directories and files, including dangling links', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'gateway-link-')); roots.push(base)
    const root = path.join(base, 'workspace'); const outside = path.join(base, 'outside')
    await fs.mkdir(root); await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'private.txt'), 'synthetic fixture')
    await fs.symlink(outside, path.join(root, 'escape'), 'junction')
    await fs.symlink(path.join(outside, 'missing.txt'), path.join(root, 'dangling'))
    await expect(resolveConfinedWorkspacePath(root, 'escape/private.txt')).rejects.toThrow('Links')
    await expect(resolveConfinedWorkspacePath(root, 'dangling')).rejects.toThrow('Links')
    expect(await fs.readFile(path.join(outside, 'private.txt'), 'utf8')).toBe('synthetic fixture')
  })
})

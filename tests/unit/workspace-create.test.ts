import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceFile } from '../../apps/runtime-gateway/src/workspace-create'
import { writeWorkspaceFile } from '../../apps/runtime-gateway/src/workspace-write'
import { WorkspaceCreateService } from '../../apps/web-runtime/src/workspace-create'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }) })
const memory = () => {
  const data = new Map<string, unknown>()
  return {
    data,
    get: <T>(key: string): Promise<T | undefined> => Promise.resolve(structuredClone(data.get(key)) as T | undefined),
    put: <T>(key: string, value: T): Promise<void> => { data.set(key, structuredClone(value)); return Promise.resolve() }
  }
}
describe('Reviewed manual CREATE', () => {
  it('serializes writers sharing a baseline and refuses missing or unreviewed replacement', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cas-write-')); roots.push(root)
    await createWorkspaceFile(root, 'file.txt', 'baseline')
    const baseline = createHash('sha256').update('baseline').digest('hex')
    const results = await Promise.allSettled([writeWorkspaceFile(root, 'file.txt', 'first', baseline), writeWorkspaceFile(root, 'file.txt', 'second', baseline)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    await expect(writeWorkspaceFile(root, 'file.txt', 'no baseline')).rejects.toThrow()
    await expect(writeWorkspaceFile(root, 'missing.txt', 'recreate', baseline)).rejects.toThrow()
    expect(await fs.readdir(root)).toEqual(['file.txt'])
  })
  it('publishes one complete file under concurrent creation and never overwrites', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'approved-create-')); roots.push(root)
    const results = await Promise.allSettled([createWorkspaceFile(root, 'new.txt', 'first'), createWorkspaceFile(root, 'new.txt', 'second')])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(['first', 'second']).toContain(await fs.readFile(path.join(root, 'new.txt'), 'utf8'))
    await expect(createWorkspaceFile(root, 'new.txt', 'overwrite')).rejects.toThrow()
    expect(await fs.readdir(root)).toEqual(['new.txt'])
  })
  it('persists the reviewed content, audits approval and rejects replay after restart', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'review-create-')); roots.push(root)
    const storage = memory()
    const review = await new WorkspaceCreateService(storage).prepare({ relativePath: 'approved.txt', content: 'reviewed content' })
    expect(await fs.readdir(root)).toEqual([])
    const restarted = new WorkspaceCreateService(storage)
    const created = await restarted.approve({ reviewId: review.id }, (file, content) => createWorkspaceFile(root, file, content))
    expect(created.hash).toBe(review.payloadHash)
    expect(await fs.readFile(path.join(root, 'approved.txt'), 'utf8')).toBe('reviewed content')
    await expect(new WorkspaceCreateService(storage).approve({ reviewId: review.id }, vi.fn())).rejects.toThrow('já utilizada')
    const approvals = [...storage.data.entries()].filter(([key]) => key.startsWith('create-approval:'))
    expect(approvals).toHaveLength(1)
    expect(approvals[0]?.[1]).toMatchObject({ decision: 'APPROVED', scope: 'ONCE' })
  })
  it('rejects injected approval content and expired reviews without invoking the writer', async () => {
    const storage = memory(); const service = new WorkspaceCreateService(storage)
    const review = await service.prepare({ relativePath: 'file.txt', content: 'safe' })
    const writer = vi.fn()
    await expect(service.approve({ reviewId: review.id, content: 'changed' }, writer)).rejects.toThrow()
    const key = `create-review:${review.id}`
    storage.data.set(key, { ...(storage.data.get(key) as object), expiresAt: new Date(0).toISOString() })
    await expect(service.approve({ reviewId: review.id }, writer)).rejects.toThrow('expirada')
    expect(writer).not.toHaveBeenCalled()
  })
})

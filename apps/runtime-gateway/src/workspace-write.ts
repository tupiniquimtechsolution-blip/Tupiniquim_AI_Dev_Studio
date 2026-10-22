import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createWorkspaceFile } from './workspace-create.ts'
import { resolveConfinedWorkspacePath } from './workspace-path.ts'

const operations = new Map<string, Promise<void>>()
/** Serializes compare-and-write inside the gateway; other host processes remain outside its trust boundary. */
export const writeWorkspaceFile = async (root: string, relativePath: string, content: string, expectedHash?: string): Promise<void> => {
  const target = await resolveConfinedWorkspacePath(root, relativePath)
  const preceding = operations.get(target)
  let release = (): void => undefined
  const pending = new Promise<void>((resolve) => { release = resolve })
  operations.set(target, pending)
  if (preceding !== undefined) await preceding
  try {
    if (expectedHash === undefined) { await createWorkspaceFile(root, relativePath, content); return }
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('Hash esperado inválido.')
    await resolveConfinedWorkspacePath(root, relativePath)
    const current = await fs.readFile(target)
    if (createHash('sha256').update(current).digest('hex') !== expectedHash) throw new Error('STALE_WRITE: arquivo mudou após a leitura.')
    const temporary = path.join(path.dirname(target), `.replace-${randomUUID()}.tmp`)
    try {
      const metadata = await fs.stat(target)
      await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: metadata.mode })
      await resolveConfinedWorkspacePath(root, relativePath)
      await fs.rename(temporary, target)
    } finally { await fs.unlink(temporary).catch(() => undefined) }
  } finally { release(); if (operations.get(target) === pending) operations.delete(target) }
}

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveConfinedWorkspacePath } from './workspace-path.ts'

/** Atomic publication, exclusive target creation; never replaces an existing path. */
export const createWorkspaceFile = async (root: string, relativePath: string, content: string): Promise<void> => {
  const target = await resolveConfinedWorkspacePath(root, relativePath)
  // Require an existing parent, avoiding implicit directory mutations in this effect.
  const parent = await fs.stat(path.dirname(target))
  if (!parent.isDirectory()) throw new Error('Diretório pai inexistente.')
  const temporary = path.join(path.dirname(target), `.create-${randomUUID()}.tmp`)
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    await resolveConfinedWorkspacePath(root, relativePath)
    await fs.link(temporary, target)
  } finally { await fs.unlink(temporary).catch(() => undefined) }
}

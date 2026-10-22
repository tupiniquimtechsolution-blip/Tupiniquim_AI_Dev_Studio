import { promises as fs } from 'node:fs'
import path from 'node:path'

export const resolveConfinedWorkspacePath = async (workspace: string, requested: string): Promise<string> => {
  const root = await fs.realpath(workspace)
  const portable = requested.replace(/\\/g, '/')
  const relative = portable === '/workspace' ? '' : portable.startsWith('/workspace/') ? portable.slice('/workspace/'.length) : portable
  if (relative.includes('\0') || relative.startsWith('/') || relative.includes(':')) throw new Error('Caminho inválido.')
  const parts = relative.split('/').filter((part) => part !== '')
  if (parts.some((part) => part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) throw new Error('Caminho inválido.')
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    try {
      const entry = await fs.lstat(current)
      if (entry.isSymbolicLink()) throw new Error('Links não são permitidos no caminho do workspace.')
      const resolved = await fs.realpath(current)
      const inside = path.relative(root, resolved)
      if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) throw new Error('Caminho fora do workspace.')
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    }
  }
  return current
}

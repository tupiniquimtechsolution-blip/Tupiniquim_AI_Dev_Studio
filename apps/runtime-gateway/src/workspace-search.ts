import { promises as fs } from 'node:fs'
import path from 'node:path'

const ignored = new Set(['node_modules', 'release', 'dist', 'out', 'coverage'])

/** Read only regular, visible files confined to the authorized workspace. */
export const searchWorkspaceFiles = async (workspaceRoot: string, query: string, limit: number): Promise<Array<{ relativePath: string; line: number; preview: string }>> => {
  const root = await fs.realpath(workspaceRoot)
  const max = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100
  const results: Array<{ relativePath: string; line: number; preview: string }> = []
  const confined = async (candidate: string): Promise<string> => {
    const real = await fs.realpath(candidate)
    const relative = path.relative(root, real)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Caminho fora do workspace.')
    return real
  }
  const walk = async (directory: string): Promise<void> => {
    if (results.length >= max) return
    for (const entry of await fs.readdir(await confined(directory), { withFileTypes: true })) {
      if (results.length >= max) return
      if (entry.name.startsWith('.') || ignored.has(entry.name) || entry.isSymbolicLink()) continue
      if (!entry.isDirectory() && !entry.isFile()) continue
      const absolute = await confined(path.join(directory, entry.name))
      if (entry.isDirectory()) { await walk(absolute); continue }
      const info = await fs.stat(absolute)
      if (info.size > 2 * 1024 * 1024) continue
      const content = await fs.readFile(absolute, 'utf8').catch(() => '')
      const lines = content.split(/\r?\n/)
      for (let index = 0; index < lines.length && results.length < max; index += 1) {
        const line = lines[index] ?? ''
        if (line.includes(query)) results.push({ relativePath: path.relative(root, absolute).split(path.sep).join('/'), line: index + 1, preview: line.slice(0, 240) })
      }
    }
  }
  if (query.trim() !== '') await walk(root)
  return results
}

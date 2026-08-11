import path from 'node:path'
import { lstat, realpath } from 'node:fs/promises'

export class PathSecurityError extends Error {
  public readonly code = 'PATH_OUTSIDE_WORKSPACE'
}
export const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

export const resolveLexicalPath = (root: string, relativePath: string): string => {
  if (relativePath.includes('\0') || path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) throw new PathSecurityError('Caminho absoluto ou inválido não é permitido.')
  const candidate = path.resolve(root, relativePath)
  if (!isInside(root, candidate)) throw new PathSecurityError('Caminho fora do workspace.')
  return candidate
}

export const assertRealPathInside = async (root: string, candidate: string): Promise<void> => {
  const realRoot = await realpath(root)
  let existing = candidate
  while (existing !== path.dirname(existing)) {
    try { await lstat(existing); break } catch { existing = path.dirname(existing) }
  }
  const realExisting = await realpath(existing)
  if (!isInside(realRoot, realExisting)) throw new PathSecurityError('Symlink ou junction escapa do workspace.')
}

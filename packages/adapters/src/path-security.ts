import path from 'node:path'
import { lstat, realpath } from 'node:fs/promises'

export class PathSecurityError extends Error {
  public readonly code = 'PATH_OUTSIDE_WORKSPACE'
}
export const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

const hasWindowsDeviceNamespace = (value: string): boolean =>
  /^[\\/]{2}[?.][\\/]/u.test(value) ||
  /^[\\/]{1,2}\?\?[\\/]/u.test(value) ||
  /^[\\/]{1,2}device[\\/]/iu.test(value)

const windowsReservedName = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu

const assertSafeWindowsRelativePath = (relativePath: string): void => {
  if (hasWindowsDeviceNamespace(relativePath)) {
    throw new PathSecurityError('Namespaces e dispositivos do Windows não são permitidos.')
  }

  for (const segment of relativePath.split(/[\\/]/u)) {
    if (segment === '') continue
    if (segment.includes(':')) {
      throw new PathSecurityError('Alternate data streams e dois-pontos não são permitidos.')
    }
    if ([...segment].some((character) => character.charCodeAt(0) <= 0x1f) || /[<>"|?*]/u.test(segment)) {
      throw new PathSecurityError('Caracteres inválidos em nomes do Windows não são permitidos.')
    }
    if (/[. ]$/u.test(segment)) {
      throw new PathSecurityError('Segmentos com ponto ou espaço final não são permitidos.')
    }

    const deviceStem = (segment.split('.')[0] ?? '').replace(/ +$/u, '')
    if (windowsReservedName.test(deviceStem)) {
      throw new PathSecurityError('Nomes reservados de dispositivos do Windows não são permitidos.')
    }
  }
}

export const resolveLexicalPath = (root: string, relativePath: string): string => {
  assertSafeWindowsRelativePath(relativePath)
  if (relativePath.includes('\0') || path.isAbsolute(relativePath) || /^[a-zA-Z]:/u.test(relativePath)) throw new PathSecurityError('Caminho absoluto ou inválido não é permitido.')
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

export const resolveExistingInside = async (root: string, relativePath: string): Promise<string> => {
  const candidate = resolveLexicalPath(root, relativePath)
  await lstat(candidate)
  await assertRealPathInside(root, candidate)
  return candidate
}

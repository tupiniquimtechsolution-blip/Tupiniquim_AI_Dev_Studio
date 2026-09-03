import { readFile } from 'node:fs/promises'
import path from 'node:path'

const allowedSecretNames = new Set(['OPENAI_API_KEY'])

const inheritedEnvironmentNames = [
  'ALLUSERSPROFILE',
  'APPDATA',
  'COMSPEC',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOCALAPPDATA',
  'LOGNAME',
  'NUMBER_OF_PROCESSORS',
  'OS',
  'PATH',
  'PATHEXT',
  'PROCESSOR_ARCHITECTURE',
  'PROGRAMDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'ProgramW6432',
  'SHELL',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USER',
  'USERDOMAIN',
  'USERNAME',
  'USERPROFILE',
  'WINDIR'
] as const

export const createRestrictedEnvironment = (
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {}

  for (const name of inheritedEnvironmentNames) {
    const value = process.env[name]
    if (value !== undefined && value !== '') environment[name] = value
  }

  for (const [name, value] of Object.entries(overrides)) {
    if (value !== undefined) environment[name] = value
  }

  return environment
}

export const loadPrivateEnvironment = async (projectRoot: string): Promise<NodeJS.ProcessEnv> => {
  const environment = createRestrictedEnvironment()
  const file = path.join(projectRoot, '.env.local')
  let source: string

  try {
    source = await readFile(file, 'utf8')
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return environment
    throw cause
  }

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue

    const name = line.slice(0, separator).trim()
    if (!allowedSecretNames.has(name)) continue

    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)

    if (value !== '') environment[name] = value
  }

  return environment
}

export const detectPrivateEnvironmentPresence = async (
  projectRoot: string,
  names: string[]
): Promise<Record<string, boolean>> => {
  const requested = new Set(names)
  const presence = Object.fromEntries(names.map((name) => [name, false]))
  let source: string

  try {
    source = await readFile(path.join(projectRoot, '.env.local'), 'utf8')
  } catch {
    return presence
  }

  for (const rawLine of source.split(/\r?\n/u)) {
    const separator = rawLine.indexOf('=')
    if (separator < 1) continue

    const name = rawLine.slice(0, separator).trim()
    if (!requested.has(name)) continue

    const valuePresent =
      rawLine.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, '') !== ''

    presence[name] = valuePresent
  }

  return presence
}

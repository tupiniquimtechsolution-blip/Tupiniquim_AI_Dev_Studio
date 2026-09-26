import { existsSync } from 'node:fs'
import { isAbsolute, join, normalize, relative, resolve } from 'node:path'

export type PortableRuntimeId = 'ollama' | 'open-generative-ai' | 'openhands' | 'qwen-code' | 'langflow' | 'open-webui'

export interface PortableRuntimeDefinition {
  id: PortableRuntimeId
  label: string
  executableRelativePath: string | null
  dataRelativePath: string | null
  optional: boolean
}

export interface PortableRuntimeStatus {
  id: PortableRuntimeId
  label: string
  available: boolean
  executablePath: string | null
  dataPath: string | null
  state: 'AVAILABLE' | 'NOT_INSTALLED'
}

export interface PortableLayoutStatus {
  root: string
  directories: Record<'runtime' | 'models' | 'data' | 'projects' | 'cache', string>
  runtimes: PortableRuntimeStatus[]
}

export const portableRuntimeCatalog: readonly PortableRuntimeDefinition[] = [
  { id: 'ollama', label: 'Ollama', executableRelativePath: 'runtime/ollama/ollama.exe', dataRelativePath: 'models/ollama', optional: false },
  { id: 'open-generative-ai', label: 'Open Generative AI', executableRelativePath: null, dataRelativePath: 'data/open-generative-ai', optional: true },
  { id: 'openhands', label: 'OpenHands', executableRelativePath: null, dataRelativePath: 'data/openhands', optional: true },
  { id: 'qwen-code', label: 'Qwen Code', executableRelativePath: null, dataRelativePath: 'data/qwen-code', optional: true },
  { id: 'langflow', label: 'Langflow', executableRelativePath: null, dataRelativePath: 'data/langflow', optional: true },
  { id: 'open-webui', label: 'Open WebUI', executableRelativePath: null, dataRelativePath: 'data/open-webui', optional: true }
]

const assertInsideRoot = (root: string, target: string): string => {
  const canonicalRoot = resolve(root)
  const canonicalTarget = resolve(target)
  const rel = relative(canonicalRoot, canonicalTarget)
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error('Portable runtime path escapes the authorized root.')
  }
  return canonicalTarget
}

export const resolvePortablePath = (root: string, relativePath: string): string => {
  if (!isAbsolute(root)) throw new Error('Portable root must be absolute.')
  if (isAbsolute(relativePath)) throw new Error('Portable runtime paths must be relative to the portable root.')
  return assertInsideRoot(root, join(normalize(root), relativePath))
}

export const inspectPortableLayout = (root: string): PortableLayoutStatus => {
  const canonicalRoot = resolve(root)
  if (!isAbsolute(canonicalRoot)) throw new Error('Portable root must be absolute.')
  const directories = {
    runtime: resolvePortablePath(canonicalRoot, 'runtime'),
    models: resolvePortablePath(canonicalRoot, 'models'),
    data: resolvePortablePath(canonicalRoot, 'data'),
    projects: resolvePortablePath(canonicalRoot, 'projects'),
    cache: resolvePortablePath(canonicalRoot, 'cache')
  }
  const runtimes = portableRuntimeCatalog.map((definition): PortableRuntimeStatus => {
    const executablePath = definition.executableRelativePath === null ? null : resolvePortablePath(canonicalRoot, definition.executableRelativePath)
    const dataPath = definition.dataRelativePath === null ? null : resolvePortablePath(canonicalRoot, definition.dataRelativePath)
    const available = executablePath !== null ? existsSync(executablePath) : dataPath !== null && existsSync(dataPath)
    return { id: definition.id, label: definition.label, available, executablePath, dataPath, state: available ? 'AVAILABLE' : 'NOT_INSTALLED' }
  })
  return { root: canonicalRoot, directories, runtimes }
}

export const portableRuntimeCanAutodownload = (): false => false
export const portableRuntimeMayDeleteExistingModels = (): false => false

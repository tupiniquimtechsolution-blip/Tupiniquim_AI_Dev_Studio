import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FileDocument, FileEntry, SearchMatch, WorkspaceContext, WorkspaceContextEntry } from '@tupiniquim/contracts'
import { assertRealPathInside, resolveLexicalPath } from './path-security'

const ignoredDirectories = new Set(['.git', 'node_modules', '.pnpm', 'dist', 'out', 'coverage'])
const maxFileBytes = 10_000_000
const maxContextEntries = 256
const hash = (content: string | Uint8Array): string => createHash('sha256').update(content).digest('hex')
const isMissingPathError = (cause: unknown): boolean =>
  cause instanceof Error && 'code' in cause && cause.code === 'ENOENT'

export class WorkspaceAdapter {
  private root: string | undefined

  public async configure(root: string): Promise<string> {
    const absolute = path.resolve(root)
    const info = await stat(absolute)
    if (!info.isDirectory()) throw new Error('O workspace selecionado não é um diretório.')
    this.root = absolute
    return absolute
  }

  public getRoot(): string {
    if (this.root === undefined) throw new Error('Nenhum workspace foi configurado.')
    return this.root
  }

  private async safePath(relativePath: string): Promise<string> {
    const root = this.getRoot()
    const candidate = resolveLexicalPath(root, relativePath)
    await assertRealPathInside(root, candidate)
    return candidate
  }

  public async validateWriteTarget(relativePath: string): Promise<string> {
    const absolute = await this.safePath(relativePath)
    return path.relative(this.getRoot(), absolute).split(path.sep).join('/')
  }

  public async inspectWriteTarget(relativePath: string): Promise<{ exists: boolean; hash: string | null }> {
    const absolute = await this.safePath(relativePath)
    const info = await lstat(absolute).catch((cause: unknown) => {
      if (isMissingPathError(cause)) return undefined
      throw cause
    })

    if (info === undefined) return { exists: false, hash: null }
    if (!info.isFile()) throw new Error('O alvo de escrita existente deve ser um arquivo regular.')
    if (info.size > maxFileBytes) throw new Error('Alvo de escrita excede o limite de 10 MB.')
    return { exists: true, hash: hash(await readFile(absolute)) }
  }

  public async applyWriteEffect(
    relativePath: string,
    content: string,
    operation: 'CREATE' | 'REPLACE',
    expectedHash: string | null
  ): Promise<FileDocument> {
    const absolute = await this.safePath(relativePath)

    if (operation === 'CREATE') {
      if (expectedHash !== null) throw new Error('CREATE exige expectedHash nulo.')
      const inspected = await this.inspectWriteTarget(relativePath)
      if (inspected.exists) throw new Error('CREATE exige um alvo inexistente.')

      await mkdir(path.dirname(absolute), { recursive: true })
      await assertRealPathInside(this.getRoot(), path.dirname(absolute))
      const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' })
        await link(temporary, absolute)
      } catch (cause) {
        await unlink(temporary).catch(() => undefined)
        throw cause
      }
      await unlink(temporary).catch(() => undefined)
      return this.read(relativePath)
    }

    if (operation !== 'REPLACE') throw new Error('Operação de escrita não suportada.')
    if (!/^[a-f0-9]{64}$/iu.test(expectedHash ?? '')) throw new Error('REPLACE exige um hash baseline SHA-256.')

    const inspected = await this.inspectWriteTarget(relativePath)
    if (!inspected.exists) throw new Error('REPLACE exige um arquivo existente.')
    if (inspected.hash !== expectedHash) throw new Error('Arquivo alterado externamente antes da materialização.')

    const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' })
      const current = await this.inspectWriteTarget(relativePath)
      if (!current.exists || current.hash !== expectedHash) {
        throw new Error('Arquivo alterado externamente antes da materialização.')
      }
      await rename(temporary, absolute)
    } catch (cause) {
      await unlink(temporary).catch(() => undefined)
      throw cause
    }

    return this.read(relativePath)
  }

  public async list(relativePath = '', depth = 4): Promise<FileEntry[]> {
    const absolute = await this.safePath(relativePath)
    const entries = await readdir(absolute, { withFileTypes: true })
    const result: FileEntry[] = []
    for (const entry of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') && entry.name !== '.agent') continue
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
      const childRelative = path.posix.join(relativePath.split(path.sep).join('/'), entry.name)
      const childAbsolute = path.join(absolute, entry.name)
      const info = await stat(childAbsolute)
      const item: FileEntry = { name: entry.name, relativePath: childRelative, kind: entry.isDirectory() ? 'directory' : 'file', size: info.size, modifiedAt: info.mtime.toISOString() }
      if (entry.isDirectory() && depth > 1) item.children = await this.list(childRelative, depth - 1)
      result.push(item)
    }
    return result
  }

  public async context(maxEntries = maxContextEntries, maxDepth = 4): Promise<WorkspaceContext> {
    const limit = Math.min(Math.max(Math.trunc(maxEntries), 1), maxContextEntries)
    const depth = Math.min(Math.max(Math.trunc(maxDepth), 1), 8)
    const entries: WorkspaceContextEntry[] = []
    let truncated = false
    const visit = async (relativePath: string, remainingDepth: number): Promise<void> => {
      if (entries.length >= limit) { truncated = true; return }
      const absolute = await this.safePath(relativePath)
      const children = await readdir(absolute, { withFileTypes: true })
      for (const child of children.sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))) {
        if (entries.length >= limit) { truncated = true; return }
        if (child.name.startsWith('.')) continue
        if (child.isDirectory() && ignoredDirectories.has(child.name)) continue
        const childRelative = path.posix.join(relativePath.split(path.sep).join('/'), child.name)
        const childAbsolute = path.join(absolute, child.name)
        const info = await stat(childAbsolute)
        entries.push({ relativePath: childRelative.replace(/[\r\n\t]/gu, ' ').slice(0, 240), kind: child.isDirectory() ? 'directory' : 'file', size: info.size })
        if (child.isDirectory() && remainingDepth > 1) await visit(childRelative, remainingDepth - 1)
      }
    }
    await visit('', depth)
    return { generatedAt: new Date().toISOString(), entries, truncated, contentPolicy: 'METADATA_ONLY' }
  }

  public async read(relativePath: string): Promise<FileDocument> {
    const absolute = await this.safePath(relativePath)
    const info = await stat(absolute)
    if (!info.isFile()) throw new Error('O caminho não aponta para um arquivo.')
    if (info.size > maxFileBytes) throw new Error('Arquivo excede o limite de 10 MB.')
    const content = await readFile(absolute, 'utf8')
    return { relativePath, content, hash: hash(content), modifiedAt: info.mtime.toISOString() }
  }

  public async write(relativePath: string, content: string, expectedHash?: string): Promise<FileDocument> {
    const absolute = await this.safePath(relativePath)
    if (expectedHash !== undefined) {
      const current = await this.read(relativePath)
      if (current.hash !== expectedHash) throw new Error('Arquivo alterado externamente; recarregue antes de salvar.')
    }
    await mkdir(path.dirname(absolute), { recursive: true })
    const temporary = `${absolute}.tupiniquim-${randomUUID()}.tmp`
    try {
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' })
      await rename(temporary, absolute)
    } catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }
    return this.read(relativePath)
  }

  public async search(query: string, limit = 100): Promise<SearchMatch[]> {
    const root = this.getRoot()
    const matches: SearchMatch[] = []
    const visit = async (directory: string): Promise<void> => {
      if (matches.length >= limit) return
      const entries = await readdir(directory, { withFileTypes: true })
      for (const entry of entries) {
        if (matches.length >= limit) return
        if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue
        const absolute = path.join(directory, entry.name)
        if (entry.isDirectory()) { await visit(absolute); continue }
        const info = await stat(absolute)
        if (info.size > 1_000_000) continue
        const content = await readFile(absolute, 'utf8').catch(() => '')
        const lines = content.split(/\r?\n/)
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index] ?? ''
          if (line.toLocaleLowerCase().includes(query.toLocaleLowerCase())) {
            matches.push({ relativePath: path.relative(root, absolute).split(path.sep).join('/'), line: index + 1, preview: line.trim().slice(0, 240) })
            if (matches.length >= limit) return
          }
        }
      }
    }
    await visit(root)
    return matches
  }
}

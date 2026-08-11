import { z } from 'zod'
import type { Result } from './result'

export const ipcChannels = {
  systemInfo: 'studio:system:info',
  workspacePick: 'studio:workspace:pick',
  workspaceConfigure: 'studio:workspace:configure',
  workspaceList: 'studio:workspace:list',
  workspaceRead: 'studio:workspace:read',
  workspaceWrite: 'studio:workspace:write',
  workspaceSearch: 'studio:workspace:search',
  gitStatus: 'studio:git:status',
  gitDiff: 'studio:git:diff',
  terminalCreate: 'studio:terminal:create',
  terminalWrite: 'studio:terminal:write',
  terminalResize: 'studio:terminal:resize',
  terminalKill: 'studio:terminal:kill',
  terminalData: 'studio:terminal:data'
} as const

export const workspacePathSchema = z.string().max(4096).refine((value) => !value.includes('\0'), 'Caminho inválido')
export const configureWorkspaceInputSchema = z.object({ root: z.string().min(3).max(4096) })
export const listFilesInputSchema = z.object({ relativePath: workspacePathSchema.default(''), depth: z.number().int().min(1).max(8).default(4) })
export const readFileInputSchema = z.object({ relativePath: workspacePathSchema })
export const writeFileInputSchema = z.object({
  relativePath: workspacePathSchema,
  content: z.string().max(10_000_000),
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional()
})
export const searchInputSchema = z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(500).default(100) })
export const terminalCreateInputSchema = z.object({ cwd: workspacePathSchema.default(''), cols: z.number().int().min(20).max(500).default(100), rows: z.number().int().min(5).max(200).default(30) })
export const terminalWriteInputSchema = z.object({ terminalId: z.string().uuid(), data: z.string().max(65_536) })
export const terminalResizeInputSchema = z.object({ terminalId: z.string().uuid(), cols: z.number().int().min(20).max(500), rows: z.number().int().min(5).max(200) })
export const terminalKillInputSchema = z.object({ terminalId: z.string().uuid() })

export interface FileEntry {
  name: string
  relativePath: string
  kind: 'file' | 'directory'
  size: number
  modifiedAt: string
  children?: FileEntry[]
}
export interface FileDocument {
  relativePath: string
  content: string
  hash: string
  modifiedAt: string
}

export interface SearchMatch {
  relativePath: string
  line: number
  preview: string
}

export interface GitStatus {
  branch: string
  upstream?: string
  ahead: number
  behind: number
  entries: Array<{ path: string; index: string; worktree: string }>
}

export interface SystemInfo {
  platform: string
  arch: string
  version: string
  dataRoot: string
  permissionProfile: 'ASSISTED'
}

export interface TerminalDataEvent {
  terminalId: string
  data: string
  exited?: boolean
  exitCode?: number
}

export interface StudioApi {
  system: { info(): Promise<Result<SystemInfo>> }
  workspace: {
    pick(): Promise<Result<string | null>>
    configure(input: z.input<typeof configureWorkspaceInputSchema>): Promise<Result<string>>
    list(input: z.input<typeof listFilesInputSchema>): Promise<Result<FileEntry[]>>
    read(input: z.input<typeof readFileInputSchema>): Promise<Result<FileDocument>>
    write(input: z.input<typeof writeFileInputSchema>): Promise<Result<FileDocument>>
    search(input: z.input<typeof searchInputSchema>): Promise<Result<SearchMatch[]>>
  }
  git: {
    status(): Promise<Result<GitStatus>>
    diff(relativePath?: string): Promise<Result<string>>
  }
  terminal: {
    create(input: z.input<typeof terminalCreateInputSchema>): Promise<Result<{ terminalId: string }>>
    write(input: z.input<typeof terminalWriteInputSchema>): Promise<Result<void>>
    resize(input: z.input<typeof terminalResizeInputSchema>): Promise<Result<void>>
    kill(input: z.input<typeof terminalKillInputSchema>): Promise<Result<void>>
    onData(listener: (event: TerminalDataEvent) => void): () => void
  }
}

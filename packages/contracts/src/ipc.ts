import { z } from 'zod'
import type { Result } from './result'
import type { AIEvent, AIStatus, AIThreadHistory, AgentTurnReference, LocalModel, agentInterruptInputSchema, agentLocalModelSelectInputSchema, agentProviderSelectInputSchema, agentSendInputSchema, agentThreadIdInputSchema } from './ai'
import { approvalScopeSchema, modeSchema, planSchema, type ApprovalDecision, type Execution, type FlightRecorderEvent, type Plan } from './domain'
import type { researchCollectInputSchema, researchSearchInputSchema, technologyResolveInputSchema, ResearchResult, ResearchSource, TechnologyResolution } from './research'
import type { promptCompareInputSchema, promptCompileInputSchema, promptIdInputSchema, promptLintInputSchema, promptSaveInputSchema, CompiledPrompt, PromptComparison, PromptLintIssue, PromptTemplate } from './prompt'
import type { visualAssetAddInputSchema, visualAssetUseInputSchema, visualProviderOpenInputSchema, VisualAsset, VisualProviderStatus } from './visual'
import type { uiProfileImportInputSchema, uiProfileSaveInputSchema, UIProfile } from './settings'

export const ipcChannels = {
  systemInfo: 'studio:system:info',
  workspacePick: 'studio:workspace:pick',
  workspaceConfigure: 'studio:workspace:configure',
  workspaceList: 'studio:workspace:list',
  workspaceRead: 'studio:workspace:read',
  workspaceWrite: 'studio:workspace:write',
  workspaceSearch: 'studio:workspace:search',
  workspaceContext: 'studio:workspace:context',
  gitStatus: 'studio:git:status',
  gitDiff: 'studio:git:diff',
  terminalCreate: 'studio:terminal:create',
  terminalWrite: 'studio:terminal:write',
  terminalResize: 'studio:terminal:resize',
  terminalKill: 'studio:terminal:kill',
  terminalData: 'studio:terminal:data',
  agentStatus: 'studio:agent:status',
  agentProviderSelect: 'studio:agent:provider:select',
  agentLocalModels: 'studio:agent:local-models',
  agentLocalModelSelect: 'studio:agent:local-model:select',
  agentHistory: 'studio:agent:history',
  agentSend: 'studio:agent:send',
  agentInterrupt: 'studio:agent:interrupt',
  agentEvent: 'studio:agent:event',
  planCreate: 'studio:plan:create',
  planUpdate: 'studio:plan:update',
  executionRead: 'studio:execution:read',
  executionStart: 'studio:execution:start',
  executionEvents: 'studio:execution:events',
  approvalDecide: 'studio:approval:decide',
  researchSearch: 'studio:research:search',
  researchCollect: 'studio:research:collect',
  technologyResolve: 'studio:technology:resolve',
  promptSave: 'studio:prompt:save',
  promptList: 'studio:prompt:list',
  promptCompile: 'studio:prompt:compile',
  promptCompare: 'studio:prompt:compare',
  promptLint: 'studio:prompt:lint',
  promptExport: 'studio:prompt:export',
  visualStatus: 'studio:visual:status',
  visualAssetAdd: 'studio:visual:asset:add',
  visualAssetList: 'studio:visual:asset:list',
  visualAssetUse: 'studio:visual:asset:use',
  visualProviderOpen: 'studio:visual:provider:open',
  settingsGet: 'studio:settings:get',
  settingsSave: 'studio:settings:save',
  settingsExport: 'studio:settings:export',
  settingsImport: 'studio:settings:import'
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
export const planCreateInputSchema = z.object({ objective: z.string().trim().min(3).max(100_000), mode: modeSchema })
export const planUpdateInputSchema = z.object({ executionId: z.string().uuid(), plan: planSchema })
export const executionIdInputSchema = z.object({ executionId: z.string().uuid() })
export const approvalDecideInputSchema = z.object({ executionId: z.string().uuid(), stepId: z.string().uuid(), decision: z.enum(['APPROVED', 'DENIED']), scope: approvalScopeSchema })

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

export interface WorkspaceContextEntry {
  relativePath: string
  kind: 'file' | 'directory'
  size: number
}

export interface WorkspaceContext {
  generatedAt: string
  entries: WorkspaceContextEntry[]
  truncated: boolean
  contentPolicy: 'METADATA_ONLY'
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

export interface PlannedExecution {
  plan: Plan
  execution: Execution
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
    context(): Promise<Result<WorkspaceContext>>
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
  agent: {
    status(): Promise<Result<AIStatus>>
    selectProvider(input: z.input<typeof agentProviderSelectInputSchema>): Promise<Result<AIStatus>>
    listLocalModels(): Promise<Result<LocalModel[]>>
    selectLocalModel(input: z.input<typeof agentLocalModelSelectInputSchema>): Promise<Result<AIStatus>>
    history(input: z.input<typeof agentThreadIdInputSchema>): Promise<Result<AIThreadHistory>>
    send(input: z.input<typeof agentSendInputSchema>): Promise<Result<AgentTurnReference>>
    interrupt(input: z.input<typeof agentInterruptInputSchema>): Promise<Result<void>>
    onEvent(listener: (event: AIEvent) => void): () => void
  }
  planning: {
    create(input: z.input<typeof planCreateInputSchema>): Promise<Result<PlannedExecution>>
    update(input: z.input<typeof planUpdateInputSchema>): Promise<Result<Plan>>
    read(input: z.input<typeof executionIdInputSchema>): Promise<Result<PlannedExecution>>
    decide(input: z.input<typeof approvalDecideInputSchema>): Promise<Result<ApprovalDecision>>
    start(input: z.input<typeof executionIdInputSchema>): Promise<Result<Execution>>
    events(input: z.input<typeof executionIdInputSchema>): Promise<Result<FlightRecorderEvent[]>>
  }
  research: {
    search(input: z.input<typeof researchSearchInputSchema>): Promise<Result<ResearchResult>>
    collect(input: z.input<typeof researchCollectInputSchema>): Promise<Result<ResearchSource>>
    resolve(input: z.input<typeof technologyResolveInputSchema>): Promise<Result<TechnologyResolution>>
  }
  prompt: {
    save(input: z.input<typeof promptSaveInputSchema>): Promise<Result<PromptTemplate>>
    list(): Promise<Result<PromptTemplate[]>>
    compile(input: z.input<typeof promptCompileInputSchema>): Promise<Result<CompiledPrompt>>
    compare(input: z.input<typeof promptCompareInputSchema>): Promise<Result<PromptComparison>>
    lint(input: z.input<typeof promptLintInputSchema>): Promise<Result<PromptLintIssue[]>>
    export(input: z.input<typeof promptIdInputSchema>): Promise<Result<string>>
  }
  visual: {
    statuses(): Promise<Result<VisualProviderStatus[]>>
    add(input: z.input<typeof visualAssetAddInputSchema>): Promise<Result<VisualAsset>>
    list(): Promise<Result<VisualAsset[]>>
    use(input: z.input<typeof visualAssetUseInputSchema>): Promise<Result<VisualAsset>>
    open(input: z.input<typeof visualProviderOpenInputSchema>): Promise<Result<void>>
  }
  settings: {
    get(): Promise<Result<UIProfile>>
    save(input: z.input<typeof uiProfileSaveInputSchema>): Promise<Result<UIProfile>>
    export(): Promise<Result<string>>
    import(input: z.input<typeof uiProfileImportInputSchema>): Promise<Result<UIProfile>>
  }
}

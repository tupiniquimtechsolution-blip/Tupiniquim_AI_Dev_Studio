import { z } from 'zod'
import type { Result } from './result'
import type { AIProviderKind } from './ai'

export const toolboxGateIdSchema = z.enum([
  'quality-gates', 'dependency-audit', 'secret-scan', 'security-review', 'privacy-lgpd',
  'accessibility-wcag', 'architecture-review', 'supply-chain', 'release-checklist'
])
export type ToolboxGateId = z.infer<typeof toolboxGateIdSchema>

export const controlCenterIpcChannels = {
  status: 'studio:control-center:status',
  portableInspect: 'studio:control-center:portable:inspect',
  toolboxRun: 'studio:control-center:toolbox:run',
  skills: 'studio:control-center:skills:list',
  skillSetEnabled: 'studio:control-center:skills:set-enabled',
  agentCatalog: 'studio:control-center:agents:catalog',
  agentLoadouts: 'studio:control-center:agents:loadouts',
  agentLoadoutPut: 'studio:control-center:agents:loadout:put'
} as const

export const portableInspectInputSchema = z.object({ root: z.string().trim().min(3).max(4096) })
export const toolboxRunInputSchema = z.object({ gateId: toolboxGateIdSchema })
export const projectIdInputSchema = z.object({ projectId: z.string().trim().min(1).max(200) })
export const skillSetEnabledInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  skillId: z.enum(['tupiniquim-toolbox']),
  enabled: z.boolean(),
  approvedByUser: z.literal(true)
})

export const agentPermissionProfileSchema = z.enum(['READ_ONLY', 'ASSISTED', 'FULL_ACCESS'])
export type AgentPermissionProfile = z.infer<typeof agentPermissionProfileSchema>

export const agentLoadoutPutInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: z.string().trim().min(1).max(200),
  provider: z.enum(['codex-app-server', 'ollama']),
  model: z.string().trim().min(1).max(300).nullable(),
  skillIds: z.array(z.enum(['tupiniquim-toolbox'])).max(20),
  permissionProfile: agentPermissionProfileSchema,
  approvedByUser: z.literal(true)
})

export interface ControlCenterStatus {
  product: 'Tupiniquim Dev AI'
  sections: Array<{ id: string; label: string }>
  policy: {
    explicitProviderSelection: true
    explicitModelSelection: true
    automaticFallback: false
    privilegedActionsDefaultDeny: true
  }
}

export interface PortableRuntimeView {
  root: string
  directories: Record<'runtime' | 'models' | 'data' | 'projects' | 'cache', string>
  runtimes: Array<{ id: string; label: string; available: boolean; state: 'AVAILABLE' | 'NOT_INSTALLED' }>
}

export interface ToolboxGateView {
  gateId: ToolboxGateId
  state: 'PASS' | 'FAIL' | 'NOT_AVAILABLE'
  evidence: string
}

export interface SkillControlView {
  id: 'tupiniquim-toolbox'
  name: 'Tupiniquim Toolbox'
  status: 'APPROVED_INTERNAL'
  enabled: boolean
  runtimeExecutionAuthorized: false
}

export interface AgentCatalogView {
  id: string
  name: string
  capabilities: string[]
  effects: string[]
}

export interface AgentLoadoutView {
  projectId: string
  agentId: string
  provider: AIProviderKind
  model: string | null
  skillIds: string[]
  permissionProfile: AgentPermissionProfile
  runtimeExecutionAuthorized: false
}

export interface ControlCenterDesktopApi {
  status(): Promise<Result<ControlCenterStatus>>
  inspectPortable(input: z.input<typeof portableInspectInputSchema>): Promise<Result<PortableRuntimeView>>
  runToolboxGate(input: z.input<typeof toolboxRunInputSchema>): Promise<Result<ToolboxGateView>>
  listSkills(input: z.input<typeof projectIdInputSchema>): Promise<Result<SkillControlView[]>>
  setSkillEnabled(input: z.input<typeof skillSetEnabledInputSchema>): Promise<Result<SkillControlView>>
  listAgents(): Promise<Result<AgentCatalogView[]>>
  listAgentLoadouts(input: z.input<typeof projectIdInputSchema>): Promise<Result<AgentLoadoutView[]>>
  putAgentLoadout(input: z.input<typeof agentLoadoutPutInputSchema>): Promise<Result<AgentLoadoutView>>
}

import { z } from 'zod'
import { aiProviderKindSchema } from './ai'
import { modeSchema, permissionProfileSchema, riskLevelSchema } from './domain'

export const agentSourceStatuses = ['source-registered', 'existing-runtime-role'] as const
export const agentSourceStatusSchema = z.enum(agentSourceStatuses)
export type AgentSourceStatus = z.infer<typeof agentSourceStatusSchema>

export const agentIdSchema = z.string().trim().regex(/^AGENT-[A-Z0-9-]+$/u).max(100)
export type AgentId = z.infer<typeof agentIdSchema>

export const agentDefinitionSchema = z.object({
  id: agentIdSchema,
  name: z.string().trim().min(1).max(200),
  status: agentSourceStatusSchema,
  modelRequirements: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  providerSelection: z.enum(['user-controlled', 'user-controlled-no-automatic-priority']).optional(),
  sources: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
  capabilities: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
  effects: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  constraints: z.array(z.string().trim().min(1).max(500)).max(100).default([])
}).strict()
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>

const agentRegistryInvariantsSchema = z.object({
  separation: z.literal('agent != model != provider != tool != skill != source_repository'),
  providerSelection: z.literal('user-controlled-no-automatic-priority'),
  defaultActivation: z.literal('on-demand'),
  defaultTrust: z.literal('untrusted-external-source'),
  paidServices: z.literal('NOT_CONFIGURED until explicit approval'),
  projectIsolation: z.literal(true),
  mutationAuthority: z.literal('PolicyEngine + ApprovalStore + AuditLog')
}).strict()

const agentSkillLibrarySchema = z.object({
  strategy: z.literal('global-catalog-project-loadout-agent-loadout-task-activation'),
  allTimeTopCount: z.number().int().min(0).max(500),
  trendingWatchCount: z.number().int().min(0).max(500),
  pinned: z.array(z.string().trim().min(1).max(500)).max(100),
  registeredDesignSources: z.array(z.string().trim().min(1).max(500)).max(100),
  installPolicy: z.literal('metadata-first; audit-and-approve-before-activation'),
  source: z.url().max(4096)
}).strict()

export const agentRegistryDocumentSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  invariants: agentRegistryInvariantsSchema,
  agents: z.array(agentDefinitionSchema).min(1).max(100),
  skillLibrary: agentSkillLibrarySchema,
  referenceLibraries: z.array(z.string().trim().min(1).max(500)).max(100),
  optionalPlatformSources: z.array(z.string().trim().min(1).max(500)).max(100)
}).strict().superRefine((registry, context) => {
  const ids = new Set<string>()
  for (const [index, agent] of registry.agents.entries()) {
    if (ids.has(agent.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['agents', index, 'id'], message: 'Agent id duplicado.' })
    ids.add(agent.id)
  }
})
export type AgentRegistryDocument = z.infer<typeof agentRegistryDocumentSchema>

export const projectAgentLifecycleSchema = z.enum(['APPROVED_FOR_PROJECT', 'DISABLED'])
export type ProjectAgentLifecycle = z.infer<typeof projectAgentLifecycleSchema>

export const projectAgentAssignmentSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  lifecycle: projectAgentLifecycleSchema,
  approvalRef: z.string().trim().min(1).max(500).nullable(),
  skillIds: z.array(z.string().trim().min(1).max(300)).max(200),
  memoryNamespace: z.string().trim().min(1).max(500),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict().superRefine((assignment, context) => {
  if (assignment.lifecycle === 'APPROVED_FOR_PROJECT' && assignment.approvalRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['approvalRef'], message: 'Ativação do Agent no projeto exige referência explícita de aprovação.' })
  }
})
export type ProjectAgentAssignment = z.infer<typeof projectAgentAssignmentSchema>

export const projectAgentTeamSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  agentIds: z.array(agentIdSchema).min(1).max(50),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict().superRefine((team, context) => {
  if (new Set(team.agentIds).size !== team.agentIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['agentIds'], message: 'Uma equipe não pode repetir o mesmo Agent.' })
  }
})
export type ProjectAgentTeam = z.infer<typeof projectAgentTeamSchema>

export const projectAgentThreadBindingSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  provider: aiProviderKindSchema,
  model: z.string().trim().min(1).max(300).nullable(),
  threadId: z.string().trim().min(1).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict()
export type ProjectAgentThreadBinding = z.infer<typeof projectAgentThreadBindingSchema>

export const agentDispatchRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  provider: aiProviderKindSchema,
  model: z.string().trim().min(1).max(300).nullable(),
  message: z.string().trim().min(1).max(100_000),
  mode: modeSchema
}).strict()
export type AgentDispatchRequest = z.infer<typeof agentDispatchRequestSchema>

export const resolvedAgentDispatchSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  provider: aiProviderKindSchema,
  model: z.string().trim().min(1).max(300).nullable(),
  threadId: z.string().trim().min(1).max(200).nullable(),
  message: z.string().trim().min(1).max(100_000),
  mode: modeSchema,
  capabilities: z.array(z.string()),
  skillIds: z.array(z.string()),
  memoryNamespace: z.string().trim().min(1).max(500)
}).strict()
export type ResolvedAgentDispatch = z.infer<typeof resolvedAgentDispatchSchema>

export const agentCapabilityIntentSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  capability: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(4096),
  risk: riskLevelSchema,
  destructive: z.boolean(),
  requiresNetwork: z.boolean(),
  permissionProfile: permissionProfileSchema
}).strict()
export type AgentCapabilityIntent = z.infer<typeof agentCapabilityIntentSchema>

export const agentCapabilityGateResultSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  capability: z.string().trim().min(1).max(200),
  canonicalCapability: z.string().trim().min(1).max(200).nullable(),
  declaredByAgent: z.boolean(),
  policyAllowed: z.boolean(),
  requiresApproval: z.boolean(),
  runtimeExecutionAuthorized: z.literal(false),
  reason: z.string().trim().min(1).max(1000)
}).strict()
export type AgentCapabilityGateResult = z.infer<typeof agentCapabilityGateResultSchema>

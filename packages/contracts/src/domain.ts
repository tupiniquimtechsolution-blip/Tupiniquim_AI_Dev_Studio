import { z } from 'zod'

export const modes = ['CHAT', 'PLAN', 'RESEARCH', 'EXECUTE', 'REVIEW', 'DEBUG', 'PROMPT', 'VISUAL'] as const
export const modeSchema = z.enum(modes)
export type Mode = z.infer<typeof modeSchema>

export const jobStates = [
  'REQUEST',
  'UNDERSTANDING',
  'RESEARCH',
  'PLAN',
  'WAITING_APPROVAL',
  'EXECUTION',
  'VALIDATION',
  'REVIEW',
  'COMPLETED',
  'BLOCKED',
  'FAILED',
  'ROLLBACK',
  'CANCELLED',
  'NEEDS_USER_INPUT'
] as const
export const jobStateSchema = z.enum(jobStates)
export type JobState = z.infer<typeof jobStateSchema>

export const permissionProfiles = ['SAFE', 'ASSISTED', 'AUTONOMOUS', 'FULL_ACCESS'] as const
export const permissionProfileSchema = z.enum(permissionProfiles)
export type PermissionProfile = z.infer<typeof permissionProfileSchema>

export const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export const riskLevelSchema = z.enum(riskLevels)
export type RiskLevel = z.infer<typeof riskLevelSchema>

export const approvalScopes = ['ONCE', 'TASK', 'SESSION', 'PROJECT'] as const
export const approvalScopeSchema = z.enum(approvalScopes)
export type ApprovalScope = z.infer<typeof approvalScopeSchema>

export const effectCapabilities = ['workspace.write', 'terminal.command', 'git.stage', 'git.commit', 'git.push'] as const
export const effectCapabilitySchema = z.enum(effectCapabilities)
export type EffectCapability = z.infer<typeof effectCapabilitySchema>

export const effectOperations = ['CREATE', 'REPLACE', 'DELETE', 'RUN', 'STAGE', 'COMMIT', 'PUSH'] as const
export const effectOperationSchema = z.enum(effectOperations)
export type EffectOperation = z.infer<typeof effectOperationSchema>

const validEffectOperation: Record<EffectCapability, readonly EffectOperation[]> = {
  'workspace.write': ['CREATE', 'REPLACE', 'DELETE'],
  'terminal.command': ['RUN'],
  'git.stage': ['STAGE'],
  'git.commit': ['COMMIT'],
  'git.push': ['PUSH']
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const agentProposalEffectSourceSchema = z.object({
  kind: z.literal('AGENT_PROPOSAL'),
  provider: z.enum(['codex-app-server', 'ollama']),
  threadId: z.string().min(1).max(200),
  turnId: z.string().min(1).max(200),
  toolCallId: z.string().uuid(),
  proposalId: z.string().uuid(),
  tool: z.literal('workspace.write')
})
export type AgentProposalEffectSource = z.infer<typeof agentProposalEffectSourceSchema>

export const actionManifestSchema = z.object({
  id: z.string().uuid(),
  capability: effectCapabilitySchema,
  operation: effectOperationSchema,
  target: z.string().min(1).max(4096),
  payloadHash: sha256Schema,
  risk: riskLevelSchema,
  expectedTargetHash: sha256Schema.nullable().optional(),
  source: agentProposalEffectSourceSchema.optional()
}).superRefine((effect, context) => {
  if (!validEffectOperation[effect.capability].includes(effect.operation)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['operation'], message: 'Operação incompatível com a capacidade do efeito.' })
  }
  if (effect.source !== undefined && effect.capability !== 'workspace.write') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['source'], message: 'Proposta de agente só pode originar efeito workspace.write.' })
  }
  if (effect.source !== undefined && effect.operation !== 'CREATE' && effect.operation !== 'REPLACE') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['operation'], message: 'Proposta de agente só pode criar ou substituir arquivo.' })
  }
  if (effect.source !== undefined && effect.operation === 'CREATE' && effect.expectedTargetHash !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expectedTargetHash'], message: 'CREATE de agente exige baseline inexistente.' })
  }
  if (effect.source !== undefined && effect.operation === 'REPLACE' && typeof effect.expectedTargetHash !== 'string') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expectedTargetHash'], message: 'REPLACE de agente exige hash SHA-256 do baseline.' })
  }
})
export type ActionManifest = z.infer<typeof actionManifestSchema>

export const planStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED']),
  risk: riskLevelSchema,
  requiresApproval: z.boolean(),
  effects: z.array(actionManifestSchema).max(64).default([])
})
export type PlanStep = z.infer<typeof planStepSchema>

export const planSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  objective: z.string().min(1),
  steps: z.array(planStepSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type Plan = z.infer<typeof planSchema>

export const executionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  mode: modeSchema,
  state: jobStateSchema,
  permissionProfile: permissionProfileSchema,
  workspaceRoot: z.string().min(3),
  activeStepId: z.string().uuid().nullable(),
  threadId: z.string().nullable(),
  approvalIds: z.array(z.string().uuid()),
  completedEffectIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type Execution = z.infer<typeof executionSchema>

export const approvalDecisionSchema = z.object({
  id: z.string().uuid(),
  executionId: z.string().uuid(),
  stepId: z.string().uuid(),
  action: z.string().min(1).max(500),
  target: z.string().min(1).max(4096),
  risk: riskLevelSchema,
  effectsHash: z.string().regex(/^[a-f0-9]{64}$/),
  scope: approvalScopeSchema,
  decision: z.enum(['APPROVED', 'DENIED']),
  decidedAt: z.string().datetime()
})
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

export interface FlightRecorderEvent {
  id: string
  at: string
  state: JobState
  category: 'STATE' | 'TOOL' | 'APPROVAL' | 'TEST' | 'GIT' | 'SYSTEM'
  title: string
  detail?: string
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
}

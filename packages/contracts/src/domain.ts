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

export const planStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED']),
  risk: riskLevelSchema,
  requiresApproval: z.boolean()
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

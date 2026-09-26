import { z } from 'zod'
import type { Result } from './result'

export const controlCenterProjectKeySchema = z.string().trim().min(1).max(4096)
export const controlCenterSkillIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._/-]{1,119}$/)

export const controlCenterSkillEnablementSchema = z.enum([
  'BUILT_IN',
  'GATED',
  'REFERENCE_ONLY',
  'EXPERIMENTAL'
])

export const controlCenterSkillDescriptorSchema = z.object({
  id: controlCenterSkillIdSchema,
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(1200),
  source: z.string().min(1).max(500),
  enablement: controlCenterSkillEnablementSchema,
  tags: z.array(z.string().min(1).max(80)).max(30),
  gateNote: z.string().max(1000).optional()
})
export type ControlCenterSkillDescriptor = z.infer<typeof controlCenterSkillDescriptorSchema>

export const controlCenterCapabilityKindSchema = z.enum([
  'AGENT_RUNTIME',
  'MODEL_RUNTIME',
  'TOOL',
  'SERVICE',
  'MEDIA',
  'REFERENCE'
])

export const controlCenterAvailabilitySchema = z.enum([
  'AVAILABLE',
  'NOT_INSTALLED',
  'EXTERNAL_CONFIG',
  'EXPERIMENTAL'
])

export const controlCenterCapabilityDescriptorSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._/-]{1,119}$/),
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(1200),
  kind: controlCenterCapabilityKindSchema,
  source: z.string().min(1).max(500),
  availability: controlCenterAvailabilitySchema,
  selectionPolicy: z.literal('USER_EXPLICIT'),
  detectedBy: z.array(z.string().min(1).max(300)).max(20),
  portablePath: z.string().max(500).optional(),
  notes: z.array(z.string().min(1).max(500)).max(20).default([])
})
export type ControlCenterCapabilityDescriptor = z.infer<typeof controlCenterCapabilityDescriptorSchema>

export const portableLayoutSchema = z.object({
  root: z.string().min(1).max(4096),
  runtime: z.string().min(1).max(4096),
  models: z.string().min(1).max(4096),
  data: z.string().min(1).max(4096),
  projects: z.string().min(1).max(4096),
  cache: z.string().min(1).max(4096),
  tools: z.string().min(1).max(4096),
  skills: z.string().min(1).max(4096),
  rootSource: z.enum(['ENVIRONMENT', 'PACKAGED_EXECUTABLE', 'DEVELOPMENT_CWD'])
})
export type PortableLayout = z.infer<typeof portableLayoutSchema>

export const verificationProfileIdSchema = z.enum([
  'QUALITY',
  'SECURITY',
  'FULL',
  'WINDOWS_RELEASE'
])
export type VerificationProfileId = z.infer<typeof verificationProfileIdSchema>

export const verificationProfileSchema = z.object({
  id: verificationProfileIdSchema,
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  scripts: z.array(z.string().min(1).max(120)).min(1).max(20),
  mutatesSource: z.literal(false)
})
export type VerificationProfile = z.infer<typeof verificationProfileSchema>

export const verificationStepSchema = z.object({
  script: z.string().min(1).max(120),
  status: z.enum(['PASS', 'FAIL', 'SKIPPED']),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative(),
  outputTail: z.string().max(16_000)
})
export type VerificationStep = z.infer<typeof verificationStepSchema>

export const verificationRunSchema = z.object({
  id: z.string().uuid(),
  profileId: verificationProfileIdSchema,
  projectKeyHash: z.string().regex(/^[a-f0-9]{64}$/),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.enum(['PASS', 'FAIL', 'PARTIAL']),
  steps: z.array(verificationStepSchema).max(20)
})
export type VerificationRun = z.infer<typeof verificationRunSchema>

export const projectSkillStateSchema = z.object({
  projectKeyHash: z.string().regex(/^[a-f0-9]{64}$/),
  enabledSkillIds: z.array(controlCenterSkillIdSchema).max(200),
  updatedAt: z.string().datetime()
})
export type ProjectSkillState = z.infer<typeof projectSkillStateSchema>

export const controlCenterSnapshotSchema = z.object({
  portableLayout: portableLayoutSchema,
  skills: z.array(controlCenterSkillDescriptorSchema),
  enabledSkillIds: z.array(controlCenterSkillIdSchema),
  capabilities: z.array(controlCenterCapabilityDescriptorSchema),
  verificationProfiles: z.array(verificationProfileSchema),
  policy: z.object({
    providerSelection: z.literal('USER_EXPLICIT'),
    modelSelection: z.literal('USER_EXPLICIT'),
    skillSelection: z.literal('USER_EXPLICIT'),
    destructiveActionsRequireApproval: z.literal(true),
    externalSourcesRequireGate: z.literal(true)
  })
})
export type ControlCenterSnapshot = z.infer<typeof controlCenterSnapshotSchema>

export const controlCenterSnapshotInputSchema = z.object({
  projectKey: controlCenterProjectKeySchema.optional()
})

export const controlCenterSkillToggleInputSchema = z.object({
  projectKey: controlCenterProjectKeySchema,
  skillId: controlCenterSkillIdSchema,
  enabled: z.boolean()
})

export const controlCenterVerificationRunInputSchema = z.object({
  projectRoot: z.string().trim().min(1).max(4096),
  profileId: verificationProfileIdSchema
})

export const controlCenterIpcChannels = {
  snapshot: 'studio:control-center:snapshot',
  skillToggle: 'studio:control-center:skill:toggle',
  verificationRun: 'studio:control-center:verification:run'
} as const

export interface ControlCenterDesktopApi {
  snapshot(input?: z.input<typeof controlCenterSnapshotInputSchema>): Promise<Result<ControlCenterSnapshot>>
  setSkill(input: z.input<typeof controlCenterSkillToggleInputSchema>): Promise<Result<ProjectSkillState>>
  runVerification(input: z.input<typeof controlCenterVerificationRunInputSchema>): Promise<Result<VerificationRun>>
}

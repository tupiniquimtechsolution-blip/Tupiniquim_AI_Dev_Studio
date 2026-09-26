import { z } from 'zod'

export const registryKinds = [
  'KNOWLEDGE_SOURCE',
  'TECHNOLOGY',
  'TOOL',
  'MCP_SERVER',
  'SKILL',
  'PUBLIC_API',
  'PLATFORM'
] as const
export const registryKindSchema = z.enum(registryKinds)
export type RegistryKind = z.infer<typeof registryKindSchema>

export const registryStatuses = ['DISCOVERED', 'VERIFIED', 'APPROVED', 'REJECTED', 'DEPRECATED'] as const
export const registryStatusSchema = z.enum(registryStatuses)
export type RegistryStatus = z.infer<typeof registryStatusSchema>

export const registryLicenseStates = ['KNOWN', 'UNKNOWN', 'RESTRICTED'] as const
export const registryLicenseStateSchema = z.enum(registryLicenseStates)
export type RegistryLicenseState = z.infer<typeof registryLicenseStateSchema>

export const registryCostStates = ['FREE', 'FREE_LOCAL', 'FREE_ACCOUNT', 'FREEMIUM', 'PAID_DEPENDENCY', 'PAID', 'UNKNOWN'] as const
export const registryCostStateSchema = z.enum(registryCostStates)
export type RegistryCostState = z.infer<typeof registryCostStateSchema>

export const registryTrustStates = ['EXTERNAL_UNTRUSTED', 'CURATED_METADATA', 'VERIFIED_EVIDENCE'] as const
export const registryTrustStateSchema = z.enum(registryTrustStates)
export type RegistryTrustState = z.infer<typeof registryTrustStateSchema>

export const registryScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GLOBAL') }),
  z.object({ kind: z.literal('PROJECT'), projectId: z.string().trim().min(1).max(200) })
])
export type RegistryScope = z.infer<typeof registryScopeSchema>

export const registryProvenanceSchema = z.object({
  sourceUrl: z.url().max(4096),
  retrievedAt: z.string().datetime(),
  sourceRef: z.string().trim().min(1).max(300).optional(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  notes: z.array(z.string().trim().min(1).max(500)).max(50).default([])
})
export type RegistryProvenance = z.infer<typeof registryProvenanceSchema>

export const registryEntrySchema = z.object({
  id: z.string().uuid(),
  kind: registryKindSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4_000),
  scope: registryScopeSchema,
  status: registryStatusSchema,
  trust: registryTrustStateSchema,
  license: registryLicenseStateSchema,
  cost: registryCostStateSchema,
  dependencies: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  permissions: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  citations: z.array(z.url().max(4096)).max(100).default([]),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  provenance: registryProvenanceSchema
})
export type RegistryEntry = z.infer<typeof registryEntrySchema>

export const registryDiscoveryInputSchema = z.object({
  kind: registryKindSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4_000),
  scope: registryScopeSchema.default({ kind: 'GLOBAL' }),
  license: registryLicenseStateSchema.default('UNKNOWN'),
  cost: registryCostStateSchema.default('UNKNOWN'),
  dependencies: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  permissions: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  citations: z.array(z.url().max(4096)).max(100).default([]),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  provenance: z.object({
    sourceUrl: z.url().max(4096),
    sourceRef: z.string().trim().min(1).max(300).optional(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
    notes: z.array(z.string().trim().min(1).max(500)).max(50).default([])
  })
})
export type RegistryDiscoveryInput = z.input<typeof registryDiscoveryInputSchema>

export const registryGateAssessmentSchema = z.object({
  entryId: z.string().uuid(),
  kind: registryKindSchema,
  projectId: z.string().trim().min(1).max(200),
  visibleToProject: z.boolean(),
  eligibleForApproval: z.boolean(),
  adoptionReady: z.boolean(),
  runtimeExecutionAuthorized: z.literal(false),
  requiresHumanApproval: z.literal(true),
  blockers: z.array(z.string())
})
export type RegistryGateAssessment = z.infer<typeof registryGateAssessmentSchema>

export const skillGateAssessmentSchema = z.object({
  skillId: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  visibleToProject: z.boolean(),
  eligibleForApproval: z.boolean(),
  adoptionReady: z.boolean(),
  runtimeExecutionAuthorized: z.literal(false),
  requiresHumanApproval: z.literal(true),
  blockers: z.array(z.string())
})
export type SkillGateAssessment = z.infer<typeof skillGateAssessmentSchema>

export const skillsSnapshotItemSchema = z.object({
  rank: z.number().int().positive().max(500),
  id: z.string().trim().min(1).max(300),
  slug: z.string().default(''),
  name: z.string().trim().min(1).max(300),
  source: z.string().trim().min(1).max(500),
  installs: z.number().int().nonnegative(),
  sourceType: z.string().trim().min(1).max(100),
  installUrl: z.string().trim().min(1).max(4096),
  url: z.string().trim().min(1).max(4096),
  pinned: z.boolean().default(false)
})
export type SkillsSnapshotItem = z.infer<typeof skillsSnapshotItemSchema>

export const skillsSnapshotSchema = z.object({
  schemaVersion: z.string().trim().min(1).max(50),
  source: z.url().max(4096),
  endpoint: z.string().trim().min(1).max(500),
  view: z.enum(['all-time', 'trending', 'hot']),
  requested: z.number().int().min(1).max(500),
  returned: z.number().int().min(1).max(500),
  generatedAt: z.string().datetime(),
  pinned: z.array(z.string().trim().min(1).max(300)),
  policy: z.string().trim().min(1).max(500),
  skills: z.array(skillsSnapshotItemSchema).min(1).max(500)
})
export type SkillsSnapshot = z.infer<typeof skillsSnapshotSchema>

export const skillCardSchema = z.object({
  id: z.string().trim().min(1).max(300),
  name: z.string().trim().min(1).max(300),
  source: z.string().trim().min(1).max(500),
  rank: z.number().int().positive().max(500),
  installs: z.number().int().nonnegative(),
  sourceType: z.string().trim().min(1).max(100),
  installUrl: z.string().trim().min(1).max(4096),
  skillsUrl: z.string().trim().min(1).max(4096),
  auditStatus: z.enum(['UNREVIEWED', 'REVIEWED', 'BLOCKED']),
  risk: z.enum(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH']),
  costClass: registryCostStateSchema,
  permissions: z.array(z.string().trim().min(1).max(200)),
  recommendedAgents: z.array(z.string().trim().min(1).max(200)),
  enabledProjects: z.array(z.string().trim().min(1).max(200)),
  versionRef: z.string().trim().min(1).max(300).optional(),
  lastSyncedAt: z.string().datetime(),
  pinned: z.boolean()
})
export type SkillCard = z.infer<typeof skillCardSchema>

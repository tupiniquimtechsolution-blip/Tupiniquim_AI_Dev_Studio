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

export const registryCostStates = ['FREE', 'FREEMIUM', 'PAID', 'UNKNOWN'] as const
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

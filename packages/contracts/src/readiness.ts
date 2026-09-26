import { z } from 'zod'

export const readinessStatuses = ['CLOUD_PASS', 'WINDOWS_DEFERRED', 'NOT_APPLICABLE', 'BLOCKED'] as const
export const readinessStatusSchema = z.enum(readinessStatuses)
export type ReadinessStatus = z.infer<typeof readinessStatusSchema>

export const evidenceKinds = ['UNIT', 'INTEGRATION', 'SECURITY', 'DOGFOOD', 'BUILD', 'CLOUDFLARE_DRY_RUN', 'WINDOWS_REAL', 'MANUAL'] as const
export const evidenceKindSchema = z.enum(evidenceKinds)
export type EvidenceKind = z.infer<typeof evidenceKindSchema>

export const readinessEvidenceSchema = z.object({
  kind: evidenceKindSchema,
  ref: z.string().trim().min(1).max(500),
  detail: z.string().trim().min(1).max(2_000)
})
export type ReadinessEvidence = z.infer<typeof readinessEvidenceSchema>

export const readinessCheckSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  status: readinessStatusSchema,
  platforms: z.array(z.enum(['WEB', 'DESKTOP', 'MOBILE'])).min(1),
  evidence: z.array(readinessEvidenceSchema).max(100).default([]),
  reason: z.string().trim().min(1).max(2_000)
})
export type ReadinessCheck = z.infer<typeof readinessCheckSchema>

export const readinessReportSchema = z.object({
  wave: z.literal('MW3'),
  generatedAt: z.string().datetime(),
  cloudGreenEligible: z.boolean(),
  releaseGreenEligible: z.boolean(),
  blocked: z.array(z.string()),
  windowsDeferred: z.array(z.string()),
  checks: z.array(readinessCheckSchema).min(1)
})
export type ReadinessReport = z.infer<typeof readinessReportSchema>

export const dogfoodScenarioIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] as const
export const dogfoodScenarioIdSchema = z.enum(dogfoodScenarioIds)
export type DogfoodScenarioId = z.infer<typeof dogfoodScenarioIdSchema>

export const dogfoodScenarioResultSchema = z.object({
  id: dogfoodScenarioIdSchema,
  title: z.string().trim().min(1).max(500),
  status: readinessStatusSchema,
  evidence: z.array(readinessEvidenceSchema).min(1),
  windowsDependencies: z.array(z.string().trim().min(1).max(200)).default([])
})
export type DogfoodScenarioResult = z.infer<typeof dogfoodScenarioResultSchema>

export const engineeringPlaybookSourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceUrl: z.url().max(4096),
  sourceRef: z.string().trim().min(1).max(300),
  role: z.literal('ENGINEERING_PLAYBOOK_SOURCE'),
  authoritative: z.literal(false),
  runtimeDependency: z.literal(false),
  autoInstallAllowed: z.literal(false),
  adoptedPractices: z.array(z.string().trim().min(1).max(300)),
  rejectedOrDeferredPractices: z.array(z.string().trim().min(1).max(300))
})
export type EngineeringPlaybookSource = z.infer<typeof engineeringPlaybookSourceSchema>

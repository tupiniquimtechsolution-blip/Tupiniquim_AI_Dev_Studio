import { z } from 'zod'
import { agentIdSchema } from './agent-runtime'
import { permissionProfileSchema, riskLevelSchema } from './domain'

export const mw5SourceIds = ['OPEN_GENERATIVE_AI', 'GEMINI_VIDEO_PRESETS', 'POCKET_TTS', 'OPENREPLY', 'KIMI_K3_C'] as const
export const mw5SourceIdSchema = z.enum(mw5SourceIds)
export type Mw5SourceId = z.infer<typeof mw5SourceIdSchema>

export const mw5Operations = ['IMAGE_GENERATE', 'IMAGE_EDIT', 'VIDEO_GENERATE', 'TTS_GENERATE', 'VOICE_CLONE', 'SOCIAL_COMMENT_TO_DM'] as const
export const mw5OperationSchema = z.enum(mw5Operations)
export type Mw5Operation = z.infer<typeof mw5OperationSchema>

export const mw5SourceStates = ['REGISTERED_SOURCE', 'READY', 'NOT_CONFIGURED', 'WINDOWS_DEFERRED', 'EXPERIMENTAL'] as const
export const mw5SourceStateSchema = z.enum(mw5SourceStates)
export type Mw5SourceState = z.infer<typeof mw5SourceStateSchema>

export const mw5SourceDefinitionSchema = z.object({
  id: mw5SourceIdSchema,
  sourceRef: z.string().trim().min(1).max(500),
  kind: z.enum(['MEDIA', 'VOICE', 'SOCIAL', 'EXPERIMENTAL']),
  operations: z.array(mw5OperationSchema).max(20),
  state: mw5SourceStateSchema,
  runtimeClass: z.enum(['CLOUD_CONTROL_PLANE', 'LOCAL_RUNTIME', 'EXTERNAL_SERVICE', 'EXPERIMENTAL']),
  officialApiOnly: z.boolean(),
  requiresConsent: z.boolean(),
  detail: z.string().trim().min(1).max(1000)
}).strict()
export type Mw5SourceDefinition = z.infer<typeof mw5SourceDefinitionSchema>

export const mw5PresetAliasSchema = z.enum(['/reveal', '/teardown', '/explodedview'])
export type Mw5PresetAlias = z.infer<typeof mw5PresetAliasSchema>

export const mw5CapabilityIntentSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  operation: mw5OperationSchema,
  sourceId: mw5SourceIdSchema,
  provider: z.string().trim().min(1).max(300).nullable(),
  model: z.string().trim().min(1).max(300).nullable(),
  target: z.string().trim().min(1).max(4096),
  risk: riskLevelSchema,
  destructive: z.boolean(),
  requiresNetwork: z.boolean(),
  permissionProfile: permissionProfileSchema,
  presetAlias: mw5PresetAliasSchema.nullable(),
  consentRef: z.string().uuid().nullable(),
  inputProvenanceRef: z.string().trim().min(1).max(1000).nullable(),
  officialApiConfirmed: z.boolean()
}).strict()
export type Mw5CapabilityIntent = z.infer<typeof mw5CapabilityIntentSchema>

export const mw5CapabilityDecisionSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  operation: mw5OperationSchema,
  sourceId: mw5SourceIdSchema,
  sourceState: mw5SourceStateSchema,
  effect: z.enum(['asset:create', 'asset:edit', 'network:external-write']).nullable(),
  canonicalCapability: z.enum(['asset.create', 'asset.edit', 'network.external-write']).nullable(),
  declaredByAgent: z.boolean(),
  sourceDeclaredByAgent: z.boolean(),
  policyAllowed: z.boolean(),
  consentValidated: z.boolean(),
  provenanceValidated: z.boolean(),
  officialApiValidated: z.boolean(),
  requiresApproval: z.boolean(),
  runtimeExecutionAuthorized: z.literal(false),
  reason: z.string().trim().min(1).max(1600)
}).strict()
export type Mw5CapabilityDecision = z.infer<typeof mw5CapabilityDecisionSchema>

export const mw5AssetProvenanceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  agentId: agentIdSchema,
  sourceId: mw5SourceIdSchema,
  operation: mw5OperationSchema,
  provider: z.string().trim().min(1).max(300).nullable(),
  model: z.string().trim().min(1).max(300).nullable(),
  presetAlias: mw5PresetAliasSchema.nullable(),
  inputAssetRefs: z.array(z.string().trim().min(1).max(1000)).max(50),
  outputAssetRef: z.string().trim().min(1).max(1000),
  licenseRef: z.string().trim().min(1).max(1000).nullable(),
  createdAt: z.string().datetime()
}).strict()
export type Mw5AssetProvenance = z.infer<typeof mw5AssetProvenanceSchema>

export const mw5VoiceConsentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  subjectRef: z.string().trim().min(1).max(500),
  scope: z.literal('VOICE_CLONE'),
  evidenceRef: z.string().trim().min(1).max(1000),
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable()
}).strict()
export type Mw5VoiceConsent = z.infer<typeof mw5VoiceConsentSchema>

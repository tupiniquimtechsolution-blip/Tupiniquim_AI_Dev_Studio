import { z } from 'zod'

export const knowledgeTrustStates = ['EXTERNAL_UNTRUSTED', 'CURATED_PROJECT_KNOWLEDGE'] as const
export const knowledgeTrustStateSchema = z.enum(knowledgeTrustStates)
export type KnowledgeTrustState = z.infer<typeof knowledgeTrustStateSchema>

export const knowledgeIngestInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  sourceUrl: z.url().max(4096),
  sourceId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(200_000),
  trust: knowledgeTrustStateSchema.default('EXTERNAL_UNTRUSTED')
})
export type KnowledgeIngestInput = z.infer<typeof knowledgeIngestInputSchema>

export const knowledgeCitationSchema = z.object({
  sourceId: z.string().uuid().optional(),
  url: z.url().max(4096),
  title: z.string().trim().min(1).max(500)
})
export type KnowledgeCitation = z.infer<typeof knowledgeCitationSchema>

export const knowledgeChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  text: z.string().min(1).max(20_000),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  trust: knowledgeTrustStateSchema,
  citation: knowledgeCitationSchema
})
export type KnowledgeChunk = z.infer<typeof knowledgeChunkSchema>

export const knowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  sourceUrl: z.url().max(4096),
  sourceId: z.string().uuid().optional(),
  trust: knowledgeTrustStateSchema,
  createdAt: z.string().datetime(),
  chunks: z.array(knowledgeChunkSchema).min(1)
})
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>

export const knowledgeQueryInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  query: z.string().trim().min(2).max(2_000),
  limit: z.number().int().min(1).max(20).default(5)
})
export type KnowledgeQueryInput = z.infer<typeof knowledgeQueryInputSchema>

export const knowledgeHitSchema = z.object({
  chunk: knowledgeChunkSchema,
  score: z.number().int().min(1)
})
export type KnowledgeHit = z.infer<typeof knowledgeHitSchema>

export const knowledgeQueryResultSchema = z.object({
  projectId: z.string().trim().min(1).max(200),
  query: z.string(),
  hits: z.array(knowledgeHitSchema),
  citations: z.array(knowledgeCitationSchema),
  crossProjectExcluded: z.literal(true)
})
export type KnowledgeQueryResult = z.infer<typeof knowledgeQueryResultSchema>

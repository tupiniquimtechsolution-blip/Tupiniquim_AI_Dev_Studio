import { z } from 'zod'

export const targetPlatforms = ['WEB', 'DESKTOP', 'MOBILE'] as const
export const targetPlatformSchema = z.enum(targetPlatforms)
export type TargetPlatform = z.infer<typeof targetPlatformSchema>

export const researchSearchInputSchema = z.object({ query: z.string().trim().min(2).max(500), maxResults: z.number().int().min(1).max(20).default(8) })
export const researchCollectInputSchema = z.object({ url: z.url().max(4096) })

export const researchSourceSchema = z.object({
  id: z.string().uuid(),
  url: z.url(),
  title: z.string(),
  snippet: z.string(),
  retrievedAt: z.string().datetime(),
  origin: z.enum(['SEARCH', 'DIRECT']),
  trust: z.literal('EXTERNAL_UNTRUSTED'),
  license: z.enum(['KNOWN', 'UNKNOWN', 'RESTRICTED']),
  promptInjectionSignals: z.array(z.string())
})
export type ResearchSource = z.infer<typeof researchSourceSchema>

export const researchResultSchema = z.object({ query: z.string(), sources: z.array(researchSourceSchema), cached: z.boolean() })
export type ResearchResult = z.infer<typeof researchResultSchema>

export const technologyResolveInputSchema = z.object({
  requirements: z.string().trim().min(3).max(20_000),
  platforms: z.array(targetPlatformSchema).min(1),
  availableTools: z.array(z.string().min(1).max(100)).max(100).default([])
})

export const technologyCandidateSchema = z.object({
  name: z.string(),
  platform: targetPlatformSchema,
  score: z.number().min(0).max(100),
  rationale: z.array(z.string()),
  constraints: z.array(z.string()),
  sourceUrls: z.array(z.url())
})
export type TechnologyCandidate = z.infer<typeof technologyCandidateSchema>

export const technologyResolutionSchema = z.object({
  id: z.string().uuid(),
  requirements: z.string(),
  generatedAt: z.string().datetime(),
  recommendations: z.array(technologyCandidateSchema),
  knowledgePack: z.object({ title: z.string(), summary: z.string(), citations: z.array(z.url()) })
})
export type TechnologyResolution = z.infer<typeof technologyResolutionSchema>

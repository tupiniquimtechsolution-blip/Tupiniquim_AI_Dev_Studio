import { z } from 'zod'

export const promptVariableSchema = z.object({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), description: z.string().max(500), required: z.boolean(), defaultValue: z.string().max(20_000).optional() })
export type PromptVariable = z.infer<typeof promptVariableSchema>

export const promptTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
  content: z.string().min(1).max(200_000),
  variables: z.array(promptVariableSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type PromptTemplate = z.infer<typeof promptTemplateSchema>

export const promptSaveInputSchema = z.object({ name: z.string().trim().min(1).max(120), content: z.string().min(1).max(200_000), variables: z.array(promptVariableSchema).max(100).default([]) })
export const promptCompileInputSchema = z.object({ templateId: z.string().uuid(), values: z.record(z.string(), z.string().max(100_000)) })
export const promptCompareInputSchema = z.object({ leftId: z.string().uuid(), rightId: z.string().uuid() })
export const promptIdInputSchema = z.object({ templateId: z.string().uuid() })
export const promptLintInputSchema = z.object({ content: z.string().min(1).max(200_000) })

export const promptLintIssueSchema = z.object({ severity: z.enum(['INFO', 'WARNING', 'ERROR']), code: z.string(), message: z.string() })
export type PromptLintIssue = z.infer<typeof promptLintIssueSchema>

export const compiledPromptSchema = z.object({ templateId: z.string().uuid(), version: z.number().int().positive(), content: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/), compiledAt: z.string().datetime(), lint: z.array(promptLintIssueSchema) })
export type CompiledPrompt = z.infer<typeof compiledPromptSchema>

export interface PromptComparison { left: PromptTemplate; right: PromptTemplate; added: string[]; removed: string[] }

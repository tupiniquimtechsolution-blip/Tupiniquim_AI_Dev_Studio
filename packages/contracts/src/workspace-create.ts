import { z } from 'zod'

export const workspaceCreateInputSchema = z.object({
  relativePath: z.string().min(1).max(500).refine((value) => !/[\\:\0]/.test(value) && !value.startsWith('/') && !value.split('/').some((part) => part === '' || part === '.' || part === '..'), 'Use um caminho relativo válido.'),
  content: z.string().max(1_000_000)
}).strict()
export const workspaceCreateApprovalSchema = z.object({ reviewId: z.string().uuid() }).strict()
export interface WorkspaceCreateReview {
  id: string
  relativePath: string
  content: string
  payloadHash: string
  expiresAt: string
}

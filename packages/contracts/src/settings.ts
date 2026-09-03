import { z } from 'zod'

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const uiProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  density: z.enum(['COMPACT', 'COMFORTABLE']),
  theme: z.object({ background: colorSchema, surface: colorSchema, raised: colorSchema, text: colorSchema, muted: colorSchema, accent: colorSchema, info: colorSchema, warning: colorSchema, danger: colorSchema }),
  layout: z.object({ explorerWidth: z.number().min(0).max(480), agentWidth: z.number().min(0).max(560), deckHeight: z.number().min(0).max(500) }),
  updatedAt: z.string().datetime()
})
export type UIProfile = z.infer<typeof uiProfileSchema>

export const uiProfileSaveInputSchema = z.object({ profile: uiProfileSchema })
export const uiProfileImportInputSchema = z.object({ serialized: z.string().min(2).max(100_000) })

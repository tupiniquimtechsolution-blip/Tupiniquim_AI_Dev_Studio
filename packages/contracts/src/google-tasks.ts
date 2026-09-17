import { z } from 'zod'

export const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks' as const
export const GOOGLE_TASKS_READONLY_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly' as const

export const googleTaskOpaqueIdSchema = z.string().trim().min(1).max(2048)
export const googleTaskTitleSchema = z.string().trim().min(1).max(1024)

export const googleTaskListSchema = z.object({
  id: googleTaskOpaqueIdSchema,
  title: z.string().max(1024),
  updated: z.string().optional()
})

export const googleTaskSchema = z.object({
  id: googleTaskOpaqueIdSchema,
  title: z.string().max(1024),
  notes: z.string().optional(),
  status: z.enum(['needsAction', 'completed']),
  due: z.string().optional(),
  completed: z.string().optional(),
  updated: z.string().optional(),
  parent: z.string().optional(),
  position: z.string().optional(),
  hidden: z.boolean().optional(),
  deleted: z.boolean().optional()
})

export type GoogleTaskList = z.infer<typeof googleTaskListSchema>
export type GoogleTask = z.infer<typeof googleTaskSchema>

export const googleTaskListsInputSchema = z.object({
  maxResults: z.number().int().min(1).max(100).default(100)
})

export const googleTasksListInputSchema = z.object({
  taskListId: googleTaskOpaqueIdSchema,
  showCompleted: z.boolean().default(true),
  showHidden: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(100).default(100)
})

export const googleTaskCreateInputSchema = z.object({
  taskListId: googleTaskOpaqueIdSchema,
  title: googleTaskTitleSchema,
  notes: z.string().max(8192).optional(),
  due: z.string().datetime({ offset: true }).optional()
})

export const googleTaskUpdateInputSchema = z.object({
  taskListId: googleTaskOpaqueIdSchema,
  taskId: googleTaskOpaqueIdSchema,
  title: googleTaskTitleSchema.optional(),
  notes: z.string().max(8192).nullable().optional(),
  due: z.string().datetime({ offset: true }).nullable().optional()
}).refine((value) => value.title !== undefined || value.notes !== undefined || value.due !== undefined, {
  message: 'Informe pelo menos um campo para atualizar.'
})

export const googleTaskCompleteInputSchema = z.object({
  taskListId: googleTaskOpaqueIdSchema,
  taskId: googleTaskOpaqueIdSchema
})

export const googleTaskDeleteInputSchema = googleTaskCompleteInputSchema

export interface GoogleTasksOAuthTokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt: string
  tokenType: 'Bearer'
  scope: string[]
}

export interface GoogleTasksConnectionStatus {
  configured: boolean
  authenticated: boolean
  secureStorageAvailable: boolean
  scope: typeof GOOGLE_TASKS_SCOPE
}

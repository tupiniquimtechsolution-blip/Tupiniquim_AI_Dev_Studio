import { z } from 'zod'
import { modeSchema } from './domain'

export const aiProviderStates = ['DISCONNECTED', 'STARTING', 'READY', 'BUSY', 'AUTH_REQUIRED', 'NOT_INSTALLED', 'ERROR', 'STOPPED'] as const
export const aiProviderStateSchema = z.enum(aiProviderStates)
export type AIProviderState = z.infer<typeof aiProviderStateSchema>

export const aiProviderKinds = ['codex-app-server', 'ollama'] as const
export const aiProviderKindSchema = z.enum(aiProviderKinds)
export type AIProviderKind = z.infer<typeof aiProviderKindSchema>

export const aiAccountKinds = ['API_KEY', 'CHATGPT', 'AMAZON_BEDROCK', 'NONE'] as const
export const aiAccountKindSchema = z.enum(aiAccountKinds)
export type AIAccountKind = z.infer<typeof aiAccountKindSchema>

export const aiStatusSchema = z.object({
  provider: aiProviderKindSchema,
  state: aiProviderStateSchema,
  account: aiAccountKindSchema,
  version: z.string().nullable(),
  activeThreadId: z.string().nullable(),
  activeTurnId: z.string().nullable(),
  detail: z.string().nullable()
})
export type AIStatus = z.infer<typeof aiStatusSchema>

export const localModelSchema = z.object({
  name: z.string().min(1).max(300),
  model: z.string().min(1).max(300),
  modifiedAt: z.string().nullable(),
  size: z.number().nonnegative().nullable()
})
export type LocalModel = z.infer<typeof localModelSchema>

export const agentProviderSelectInputSchema = z.object({ provider: aiProviderKindSchema })
export const agentLocalModelSelectInputSchema = z.object({ model: z.string().trim().min(1).max(300) })

export const agentSendInputSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  mode: modeSchema,
  threadId: z.string().min(1).max(200).optional(),
  workspaceContext: z.string().max(20_000).optional()
})

export const agentInterruptInputSchema = z.object({
  threadId: z.string().min(1).max(200),
  turnId: z.string().min(1).max(200)
})

export const agentThreadIdInputSchema = z.object({ threadId: z.string().min(1).max(200) })

export const agentTurnReferenceSchema = z.object({
  threadId: z.string().min(1).max(200),
  turnId: z.string().min(1).max(200)
})
export type AgentTurnReference = z.infer<typeof agentTurnReferenceSchema>

export const aiThreadSchema = z.object({
  id: z.string().min(1).max(200),
  provider: aiProviderKindSchema,
  workspaceRoot: z.string().min(3).max(4096),
  model: z.string().min(1).max(300).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type AIThread = z.infer<typeof aiThreadSchema>

export const aiTurnSchema = z.object({
  id: z.string().min(1).max(200),
  threadId: z.string().min(1).max(200),
  mode: modeSchema,
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime()
})
export type AITurn = z.infer<typeof aiTurnSchema>

export const aiEventKinds = ['STATUS', 'THREAD_STARTED', 'TURN_STARTED', 'MESSAGE_DELTA', 'TURN_COMPLETED', 'APPROVAL_REQUIRED', 'WARNING', 'ERROR'] as const
export const aiEventSchema = z.object({
  id: z.string().uuid(),
  at: z.string().datetime(),
  kind: z.enum(aiEventKinds),
  threadId: z.string().optional(),
  turnId: z.string().optional(),
  text: z.string().optional(),
  status: z.string().optional(),
  detail: z.string().optional()
})
export type AIEvent = z.infer<typeof aiEventSchema>

export const aiThreadHistorySchema = z.object({
  thread: aiThreadSchema.nullable(),
  turns: z.array(aiTurnSchema),
  events: z.array(aiEventSchema)
})
export type AIThreadHistory = z.infer<typeof aiThreadHistorySchema>

export interface AIProvider {
  connect(): Promise<AIStatus>
  status(): AIStatus
  send(input: z.input<typeof agentSendInputSchema>): Promise<AgentTurnReference>
  interrupt(input: z.input<typeof agentInterruptInputSchema>): Promise<void>
  close(): Promise<void>
}

import { z } from 'zod'
import { modeSchema } from './domain'

export const aiProviderStates = ['DISCONNECTED', 'STARTING', 'READY', 'BUSY', 'AUTH_REQUIRED', 'ERROR', 'STOPPED'] as const
export const aiProviderStateSchema = z.enum(aiProviderStates)
export type AIProviderState = z.infer<typeof aiProviderStateSchema>

export const aiAccountKinds = ['API_KEY', 'CHATGPT', 'AMAZON_BEDROCK', 'NONE'] as const
export const aiAccountKindSchema = z.enum(aiAccountKinds)
export type AIAccountKind = z.infer<typeof aiAccountKindSchema>

export const aiStatusSchema = z.object({
  provider: z.literal('codex-app-server'),
  state: aiProviderStateSchema,
  account: aiAccountKindSchema,
  version: z.string().nullable(),
  activeThreadId: z.string().nullable(),
  activeTurnId: z.string().nullable(),
  detail: z.string().nullable()
})
export type AIStatus = z.infer<typeof aiStatusSchema>

export const agentSendInputSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  mode: modeSchema,
  threadId: z.string().min(1).max(200).optional()
})

export const agentInterruptInputSchema = z.object({
  threadId: z.string().min(1).max(200),
  turnId: z.string().min(1).max(200)
})

export interface AgentTurnReference {
  threadId: string
  turnId: string
}

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

export interface AIProvider {
  connect(): Promise<AIStatus>
  status(): AIStatus
  send(input: z.input<typeof agentSendInputSchema>): Promise<AgentTurnReference>
  interrupt(input: z.input<typeof agentInterruptInputSchema>): Promise<void>
  close(): Promise<void>
}

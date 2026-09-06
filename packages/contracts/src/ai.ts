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

export const agentProposalContextSchema = z.object({
  executionId: z.string().uuid(),
  stepId: z.string().uuid()
})
export type AgentProposalContext = z.infer<typeof agentProposalContextSchema>

const agentSendInputFields = {
  message: z.string().trim().min(1).max(100_000),
  mode: modeSchema,
  threadId: z.string().min(1).max(200).optional(),
  workspaceContext: z.string().max(20_000).optional(),
  proposalContext: agentProposalContextSchema.optional()
}

export const agentSendInputSchema = z.object(agentSendInputFields).superRefine((input, context) => {
  if (input.proposalContext !== undefined && input.threadId !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['threadId'], message: 'Uma proposta é privilegiada; o runtime cria ou continua a thread da execução e o renderer não pode escolher threadId.' })
  }
})

/**
 * Internal input used only by the privileged main process when forwarding a
 * validated AgentSendInput to a provider. Unlike the public AgentSendInput,
 * it may carry a `threadId` derived from the execution already bound by the
 * runtime. The renderer never receives this type and cannot use it as authority.
 */
export const providerSendInputSchema = z.object(agentSendInputFields)
export type ProviderSendInput = z.infer<typeof providerSendInputSchema>

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
  send(input: z.input<typeof providerSendInputSchema>): Promise<AgentTurnReference>
  interrupt(input: z.input<typeof agentInterruptInputSchema>): Promise<void>
  close(): Promise<void>
}

// ── Provider-neutral tool call envelope ──────────────────────────────────────
// Every provider adapter (Ollama, Codex, future LLMs) translates its raw
// tool_call format into this envelope. The runtime derives all privileged
// fields (provider, executionId, stepId, risk, approval, workspace, provenance)
// from context; the model may only supply business arguments.

export const toolCallKinds = ['workspace.write'] as const
export const toolCallKindSchema = z.enum(toolCallKinds)
export type ToolCallKind = z.infer<typeof toolCallKindSchema>

export const normalizedToolCallEnvelopeSchema = z.object({
  /** Stable identifier for this specific tool call, generated by the adapter. */
  callId: z.string().uuid(),
  /** The provider that produced this call (derived by adapter, not the model). */
  provider: aiProviderKindSchema,
  /** Thread this call belongs to. */
  threadId: z.string().min(1).max(200),
  /** Turn within the thread. */
  turnId: z.string().min(1).max(200),
  /** Semantic kind of the tool call. */
  tool: toolCallKindSchema,
  /** Business arguments supplied by the model (e.g. relativePath, content, operation). */
  arguments: z.record(z.string(), z.unknown())
})
export type NormalizedToolCallEnvelope = z.infer<typeof normalizedToolCallEnvelopeSchema>

// ── Shared business-argument validation for workspace.write ────────────────
// Every provider adapter normalizes raw tool calls into the envelope above;
// the privileged runtime validates business arguments against this schema
// *before* the proposal service. Provider-specific adapters never carry this
// responsibility.

const maxWorkspaceWriteContentChars = 10_000_000
export const workspaceWriteArgsSchema = z.object({
  relativePath: z.string().min(1).max(4_096).refine((v) => !v.includes('\0'), 'Caminho inválido.'),
  content: z.string().max(maxWorkspaceWriteContentChars),
  operation: z.enum(['CREATE', 'REPLACE'])
}).strict()
export type WorkspaceWriteArgs = z.infer<typeof workspaceWriteArgsSchema>

// ── Proposal status (public, UI-facing) ─────────────────────────────────────
export const proposalStatusValues = ['PENDING_REVIEW', 'APPROVED', 'DENIED', 'MATERIALIZED', 'FAILED', 'EXPIRED'] as const
export const proposalStatusSchema = z.enum(proposalStatusValues)
export type ProposalStatus = z.infer<typeof proposalStatusSchema>

// ── Tupiniquim Session (provider-neutral conversation ownership) ────────────
// Tupiniquim Session != Provider Thread. The session belongs to the workspace
// and survives provider/model switches. Each turn records the provider/thread
// used for that turn; threads are never reused across providers.

export const tupiniquimTurnRoles = ['user', 'assistant', 'error', 'system'] as const
export const tupiniquimTurnRoleSchema = z.enum(tupiniquimTurnRoles)
export type TupiniquimTurnRole = z.infer<typeof tupiniquimTurnRoleSchema>

export const tupiniquimSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceRoot: z.string().min(3).max(4096),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type TupiniquimSession = z.infer<typeof tupiniquimSessionSchema>

export const tupiniquimTurnSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: tupiniquimTurnRoleSchema,
  text: z.string().max(100_000),
  provider: aiProviderKindSchema.nullable(),
  model: z.string().min(1).max(300).nullable(),
  threadId: z.string().min(1).max(200).nullable(),
  turnId: z.string().min(1).max(200).nullable(),
  createdAt: z.string().datetime()
})
export type TupiniquimTurn = z.infer<typeof tupiniquimTurnSchema>

export const tupiniquimProviderBindingSchema = z.object({
  provider: aiProviderKindSchema,
  threadId: z.string().min(1).max(200),
  model: z.string().min(1).max(300).nullable()
})
export type TupiniquimProviderBinding = z.infer<typeof tupiniquimProviderBindingSchema>

export const tupiniquimProposalAuthoritySchema = z.object({
  provider: aiProviderKindSchema,
  threadId: z.string().min(1).max(200),
  proposalIds: z.array(z.string().uuid())
})
export type TupiniquimProposalAuthority = z.infer<typeof tupiniquimProposalAuthoritySchema>

export const tupiniquimConversationSchema = z.object({
  session: tupiniquimSessionSchema,
  turns: z.array(tupiniquimTurnSchema),
  providerThreads: z.array(tupiniquimProviderBindingSchema),
  proposalAuthority: tupiniquimProposalAuthoritySchema.nullable()
})
export type TupiniquimConversation = z.infer<typeof tupiniquimConversationSchema>

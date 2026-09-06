import {
  agentSendInputSchema,
  providerSendInputSchema,
  type AgentProposalContext,
  type ProviderSendInput
} from '@tupiniquim/contracts'
import type { PlannedExecution } from './plan-approval'

export interface AgentSendRouterDependencies {
  readExecution(context: AgentProposalContext): Promise<PlannedExecution>
  getWorkspaceRoot(): string
}

/**
 * Validates public renderer input and derives the thread the provider must
 * use. For proposal flow the public renderer never chooses a thread: when the
 * execution is not yet bound the runtime lets the provider create one; when the
 * execution already has a bound thread, the privileged main process reuses it.
 *
 * The public AgentSendInput rejects `proposalContext + threadId`; this guard is
 * re-checked here so an internal caller bypassing the IPC schema still cannot
 * bind an execution to an arbitrary thread.
 */
export const prepareProviderSendInput = async (
  rawInput: unknown,
  dependencies: AgentSendRouterDependencies
): Promise<ProviderSendInput> => {
  const input = agentSendInputSchema.parse(rawInput)
  if (input.proposalContext === undefined) {
    return providerSendInputSchema.parse(input)
  }

  if (input.mode !== 'PLAN') throw new Error('Propostas automáticas de escrita só podem ser solicitadas no modo PLAN.')
  const { execution, plan } = await dependencies.readExecution(input.proposalContext)
  if (execution.workspaceRoot !== dependencies.getWorkspaceRoot()) {
    throw new Error('A execução não pertence ao workspace autorizado.')
  }
  if (execution.state !== 'WAITING_APPROVAL') throw new Error('A execução não está aguardando aprovação e não aceita nova proposta.')
  const targetStep = plan.steps.find((step) => step.id === input.proposalContext?.stepId)
  if (targetStep === undefined || !targetStep.requiresApproval) throw new Error('O passo selecionado não aceita proposta mutável.')

  return providerSendInputSchema.parse({
    ...input,
    threadId: execution.threadId ?? undefined
  })
}

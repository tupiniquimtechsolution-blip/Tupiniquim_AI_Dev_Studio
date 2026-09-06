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
  getBoundProviderThread?: () => string | undefined
}

/**
 * Validates public renderer input and derives the thread the provider must
 * use. For proposal flow the public renderer never chooses a thread. The
 * privileged runtime reuses, in order: the execution's bound thread, then the
 * Tupiniquim Session thread for the current provider. Only when neither exists
 * may the provider create a new thread.
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

  const boundProviderThread = dependencies.getBoundProviderThread?.()
  const trustedThread = execution.threadId ?? boundProviderThread ?? undefined
  return providerSendInputSchema.parse({
    ...input,
    ...(trustedThread === undefined ? {} : { threadId: trustedThread })
  })
}

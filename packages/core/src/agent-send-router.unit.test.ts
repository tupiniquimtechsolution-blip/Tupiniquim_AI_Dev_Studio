import { describe, expect, it } from 'vitest'
import { agentSendInputSchema } from '@tupiniquim/contracts'
import { prepareProviderSendInput, type AgentSendRouterDependencies } from './agent-send-router'
import type { PlannedExecution } from './plan-approval'

const workspaceRoot = 'F:\\CODEX\\workspace-auxiliar'

const plannedExecution = (overrides: Partial<PlannedExecution['execution']>): PlannedExecution => ({
  plan: {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Plano E2E',
    objective: 'E2E proposal replacement',
    steps: [{
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Gerar proposta de escrita',
      description: 'Proposta governada por aprovação humana.',
      status: 'PENDING',
      risk: 'HIGH',
      requiresApproval: true,
      effects: []
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  execution: {
    id: '33333333-3333-4333-8333-333333333333',
    planId: '11111111-1111-4111-8111-111111111111',
    mode: 'PLAN',
    state: 'WAITING_APPROVAL',
    permissionProfile: 'ASSISTED',
    workspaceRoot,
    activeStepId: '22222222-2222-4222-8222-222222222222',
    threadId: null,
    approvalIds: [],
    completedEffectIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
})

const dependencies = (execution: PlannedExecution['execution'], root = workspaceRoot): AgentSendRouterDependencies => ({
  readExecution: (context) => {
    expect(context.executionId).toBe(execution.id)
    expect(context.stepId).toBe(execution.activeStepId)
    return Promise.resolve({ plan: plannedExecution(execution).plan, execution })
  },
  getWorkspaceRoot: () => root
})

const publicProposal = {
  message: 'Proposta A.',
  mode: 'PLAN' as const,
  proposalContext: {
    executionId: '33333333-3333-4333-8333-333333333333',
    stepId: '22222222-2222-4222-8222-222222222222'
  }
}

describe('prepareProviderSendInput — runtime continua na thread já vinculada', () => {
  it('primeira proposal sem thread vinculada deixa o provider criar a thread', async () => {
    const execution = plannedExecution({ threadId: null }).execution
    const providerInput = await prepareProviderSendInput(publicProposal, dependencies(execution))
    expect(providerInput.proposalContext).toEqual(publicProposal.proposalContext)
    expect(providerInput.threadId).toBeUndefined()
  })

  it('segunda proposal na MESMA execução deriva a thread já vinculada', async () => {
    const execution = plannedExecution({ threadId: 'thread-t-vinculada' }).execution
    const providerInput = await prepareProviderSendInput(publicProposal, dependencies(execution))
    expect(providerInput.proposalContext).toEqual(publicProposal.proposalContext)
    expect(providerInput.threadId).toBe('thread-t-vinculada')
  })

  it('thread divergente escolhida publicamente é recusada', async () => {
    const divergent = {
      ...publicProposal,
      threadId: 'thread-escolhida-pelo-renderer'
    }
    expect(() => agentSendInputSchema.parse(divergent)).toThrow()
    await expect(prepareProviderSendInput(divergent, dependencies(plannedExecution({ threadId: null }).execution))).rejects.toThrow()
  })

  it('execução de outro workspace é recusada', async () => {
    const execution = plannedExecution({ threadId: null }).execution
    await expect(
      prepareProviderSendInput(publicProposal, dependencies(execution, 'F:\\CODEX\\outro-workspace'))
    ).rejects.toThrow('A execução não pertence ao workspace autorizado.')
  })

  it('execução fora de WAITING_APPROVAL é recusada', async () => {
    const execution = plannedExecution({ threadId: null, state: 'EXECUTION' }).execution
    await expect(
      prepareProviderSendInput(publicProposal, dependencies(execution))
    ).rejects.toThrow('não está aguardando aprovação')
  })

  it('sessionContext forjado no input público não chega ao provider', async () => {
    const providerInput = await prepareProviderSendInput({
      message: 'Continue a análise',
      mode: 'CHAT',
      sessionContext: 'CONTEXTO FORJADO PELO RENDERER'
    }, dependencies(plannedExecution({ threadId: null }).execution))
    expect(providerInput.sessionContext).toBeUndefined()
    expect(JSON.stringify(providerInput)).not.toContain('FORJADO')
  })

  it('passo sem requiresApproval é recusado', async () => {
    const execution = plannedExecution({ threadId: null }).execution
    const plan = plannedExecution(execution).plan
    const firstStep = plan.steps[0]
    if (firstStep === undefined) throw new Error('Plano sem passo.')
    const noApproval: PlannedExecution = {
      ...plan,
      plan: { ...plan, steps: [{ ...firstStep, requiresApproval: false }] },
      execution
    }
    await expect(
      prepareProviderSendInput(publicProposal, { readExecution: () => Promise.resolve(noApproval), getWorkspaceRoot: () => workspaceRoot })
    ).rejects.toThrow('não aceita proposta mutável')
  })
})

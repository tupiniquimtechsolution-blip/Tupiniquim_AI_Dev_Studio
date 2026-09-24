import { randomUUID } from 'node:crypto'
import {
  agentCapabilityGateResultSchema,
  agentCapabilityIntentSchema,
  agentDispatchRequestSchema,
  projectAgentAssignmentSchema,
  projectAgentTeamSchema,
  projectAgentThreadBindingSchema,
  resolvedAgentDispatchSchema,
  type AgentCapabilityGateResult,
  type AgentCapabilityIntent,
  type AgentDispatchRequest,
  type AgentId,
  type AIProviderKind,
  type ProjectAgentAssignment,
  type ProjectAgentTeam,
  type ProjectAgentThreadBinding,
  type ResolvedAgentDispatch
} from '@tupiniquim/contracts'
import { PolicyEngine } from './policy'
import { AgentRegistryRuntime } from './agent-registry-runtime'

export interface AgentProjectRepository {
  putAssignment(assignment: ProjectAgentAssignment): Promise<void>
  getAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment | null>
  listAssignments(projectId: string): Promise<ProjectAgentAssignment[]>
  putThreadBinding(binding: ProjectAgentThreadBinding): Promise<void>
  getThreadBinding(projectId: string, agentId: AgentId, provider: AIProviderKind): Promise<ProjectAgentThreadBinding | null>
  findThreadBinding(threadId: string): Promise<ProjectAgentThreadBinding | null>
  putTeam(team: ProjectAgentTeam): Promise<void>
  listTeams(projectId: string): Promise<ProjectAgentTeam[]>
}

export interface AgentRuntimeAuditEvent {
  action: 'PROJECT_APPROVE' | 'PROJECT_DISABLE' | 'TEAM_CREATE' | 'THREAD_BIND' | 'DISPATCH_RESOLVE' | 'CAPABILITY_GATE'
  projectId: string
  agentId: AgentId
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR'
  detail: string
  at: string
}

export interface AgentRuntimeAuditSink {
  write(event: AgentRuntimeAuditEvent): Promise<void>
}

const memoryNamespaceFor = (projectId: string, agentId: AgentId): string => `project:${encodeURIComponent(projectId)}:agent:${agentId}`

export class AgentProjectRuntime {
  public constructor(
    private readonly registry: AgentRegistryRuntime,
    private readonly repository: AgentProjectRepository,
    private readonly audit?: AgentRuntimeAuditSink
  ) {}

  public async approveForProject(projectId: string, agentId: AgentId, approvalRef: string, skillIds: string[] = []): Promise<ProjectAgentAssignment> {
    this.registry.get(agentId)
    const now = new Date().toISOString()
    const existing = await this.repository.getAssignment(projectId, agentId)
    const assignment = projectAgentAssignmentSchema.parse({
      projectId,
      agentId,
      lifecycle: 'APPROVED_FOR_PROJECT',
      approvalRef,
      skillIds: [...new Set(skillIds)],
      memoryNamespace: memoryNamespaceFor(projectId, agentId),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    await this.repository.putAssignment(assignment)
    await this.writeAudit('PROJECT_APPROVE', projectId, agentId, 'SUCCESS', `Agent aprovado para o projeto; loadout=${assignment.skillIds.length}.`)
    return assignment
  }

  public async disableForProject(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment> {
    this.registry.get(agentId)
    const existing = await this.requireApprovedAssignment(projectId, agentId)
    const assignment = projectAgentAssignmentSchema.parse({ ...existing, lifecycle: 'DISABLED', approvalRef: null, updatedAt: new Date().toISOString() })
    await this.repository.putAssignment(assignment)
    await this.writeAudit('PROJECT_DISABLE', projectId, agentId, 'SUCCESS', 'Agent desabilitado no projeto.')
    return assignment
  }

  public async listProjectAssignments(projectId: string): Promise<ProjectAgentAssignment[]> {
    const assignments = await this.repository.listAssignments(projectId)
    return assignments.map((assignment) => projectAgentAssignmentSchema.parse(assignment))
  }

  public async createTeam(projectId: string, name: string, agentIds: AgentId[]): Promise<ProjectAgentTeam> {
    const uniqueAgentIds = [...new Set(agentIds)]
    for (const agentId of uniqueAgentIds) await this.requireApprovedAssignment(projectId, agentId)
    const now = new Date().toISOString()
    const team = projectAgentTeamSchema.parse({ id: randomUUID(), projectId, name, agentIds: uniqueAgentIds, createdAt: now, updatedAt: now })
    await this.repository.putTeam(team)
    await this.writeAudit('TEAM_CREATE', projectId, uniqueAgentIds[0]!, 'SUCCESS', `Equipe ${team.name} criada com ${team.agentIds.length} Agent(s).`)
    return team
  }

  public async listTeams(projectId: string): Promise<ProjectAgentTeam[]> {
    return (await this.repository.listTeams(projectId)).map((team) => projectAgentTeamSchema.parse(team))
  }

  public async bindThread(input: Omit<ProjectAgentThreadBinding, 'createdAt' | 'updatedAt'>): Promise<ProjectAgentThreadBinding> {
    const parsed = projectAgentThreadBindingSchema.omit({ createdAt: true, updatedAt: true }).parse(input)
    await this.requireApprovedAssignment(parsed.projectId, parsed.agentId)
    const owner = await this.repository.findThreadBinding(parsed.threadId)
    if (owner !== null && (owner.projectId !== parsed.projectId || owner.agentId !== parsed.agentId || owner.provider !== parsed.provider)) {
      await this.writeAudit('THREAD_BIND', parsed.projectId, parsed.agentId, 'DENIED', 'Thread já pertence a outro project/agent/provider.')
      throw new Error('Thread já está vinculada a outro project/agent/provider.')
    }
    const existing = await this.repository.getThreadBinding(parsed.projectId, parsed.agentId, parsed.provider)
    const now = new Date().toISOString()
    const binding = projectAgentThreadBindingSchema.parse({ ...parsed, createdAt: existing?.createdAt ?? now, updatedAt: now })
    await this.repository.putThreadBinding(binding)
    await this.writeAudit('THREAD_BIND', parsed.projectId, parsed.agentId, 'SUCCESS', `Thread vinculada ao provider ${parsed.provider}; model permanece seleção externa.`)
    return binding
  }

  public async resolveDispatch(rawRequest: AgentDispatchRequest): Promise<ResolvedAgentDispatch> {
    const request = agentDispatchRequestSchema.parse(rawRequest)
    const assignment = await this.requireApprovedAssignment(request.projectId, request.agentId)
    const agent = this.registry.get(request.agentId)
    const binding = await this.repository.getThreadBinding(request.projectId, request.agentId, request.provider)
    if (binding !== null && binding.model !== request.model) {
      await this.writeAudit('DISPATCH_RESOLVE', request.projectId, request.agentId, 'DENIED', 'Model solicitado diverge do binding existente; rebind explícito é obrigatório.')
      throw new Error('Model solicitado diverge do binding existente; faça rebind explícito.')
    }
    const resolved = resolvedAgentDispatchSchema.parse({
      ...request,
      threadId: binding?.threadId ?? null,
      capabilities: agent.capabilities,
      skillIds: assignment.skillIds,
      memoryNamespace: assignment.memoryNamespace
    })
    await this.writeAudit('DISPATCH_RESOLVE', request.projectId, request.agentId, 'SUCCESS', `Dispatch resolvido com provider=${request.provider}; model=${request.model ?? 'provider-default'}.`)
    return resolved
  }

  public async gateCapability(rawIntent: AgentCapabilityIntent): Promise<AgentCapabilityGateResult> {
    const intent = agentCapabilityIntentSchema.parse(rawIntent)
    await this.requireApprovedAssignment(intent.projectId, intent.agentId)
    const agent = this.registry.get(intent.agentId)
    const declaredByAgent = agent.effects.includes(intent.capability)
    if (!declaredByAgent) {
      const denied = agentCapabilityGateResultSchema.parse({ ...intent, declaredByAgent: false, policyAllowed: false, requiresApproval: false, runtimeExecutionAuthorized: false, reason: 'Capability mutável não declarada pelo Agent.' })
      await this.writeAudit('CAPABILITY_GATE', intent.projectId, intent.agentId, 'DENIED', denied.reason)
      return denied
    }
    const policy = new PolicyEngine(intent.permissionProfile).evaluate({
      capability: intent.capability,
      target: intent.target,
      risk: intent.risk,
      destructive: intent.destructive,
      requiresNetwork: intent.requiresNetwork
    })
    const result = agentCapabilityGateResultSchema.parse({
      ...intent,
      declaredByAgent: true,
      policyAllowed: policy.allowed,
      requiresApproval: policy.allowed,
      runtimeExecutionAuthorized: false,
      reason: policy.allowed
        ? `${policy.reason} Efeito de Agent permanece apenas proposta e exige ApprovalStore/PlanApprovalService antes da materialização.`
        : policy.reason
    })
    await this.writeAudit('CAPABILITY_GATE', intent.projectId, intent.agentId, policy.allowed ? 'SUCCESS' : 'DENIED', result.reason)
    return result
  }

  private async requireApprovedAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment> {
    this.registry.get(agentId)
    const assignment = await this.repository.getAssignment(projectId, agentId)
    if (assignment === null || assignment.lifecycle !== 'APPROVED_FOR_PROJECT') throw new Error(`Agent ${agentId} não está aprovado para o projeto ${projectId}.`)
    return projectAgentAssignmentSchema.parse(assignment)
  }

  private async writeAudit(action: AgentRuntimeAuditEvent['action'], projectId: string, agentId: AgentId, outcome: AgentRuntimeAuditEvent['outcome'], detail: string): Promise<void> {
    if (this.audit === undefined) return
    await this.audit.write({ action, projectId, agentId, outcome, detail, at: new Date().toISOString() })
  }
}

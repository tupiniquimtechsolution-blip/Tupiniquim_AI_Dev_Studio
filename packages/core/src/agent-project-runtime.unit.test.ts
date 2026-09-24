import { describe, expect, it } from 'vitest'
import type { AgentId, AIProviderKind, ProjectAgentAssignment, ProjectAgentTeam, ProjectAgentThreadBinding } from '@tupiniquim/contracts'
import { AgentProjectRuntime, type AgentProjectRepository, type AgentRuntimeAuditEvent, type AgentRuntimeAuditSink } from './agent-project-runtime'
import { AgentRegistryRuntime } from './agent-registry-runtime'

const registryFixture = () => new AgentRegistryRuntime({
  schemaVersion: '1.1.0',
  updatedAt: '2026-09-24',
  invariants: {
    separation: 'agent != model != provider != tool != skill != source_repository',
    providerSelection: 'user-controlled-no-automatic-priority',
    defaultActivation: 'on-demand',
    defaultTrust: 'untrusted-external-source',
    paidServices: 'NOT_CONFIGURED until explicit approval',
    projectIsolation: true,
    mutationAuthority: 'PolicyEngine + ApprovalStore + AuditLog'
  },
  agents: [
    {
      id: 'AGENT-CODER',
      name: 'Coding Worker',
      status: 'existing-runtime-role',
      providerSelection: 'user-controlled',
      sources: ['internal:Tupiniquim-AI-Dev-Studio'],
      capabilities: ['code', 'test'],
      effects: ['workspace:write', 'process:execute'],
      constraints: ['workspace-only']
    },
    {
      id: 'AGENT-RESEARCH',
      name: 'Researcher',
      status: 'source-registered',
      sources: ['internal:research'],
      capabilities: ['web-research'],
      effects: [],
      constraints: []
    }
  ],
  skillLibrary: {
    strategy: 'global-catalog-project-loadout-agent-loadout-task-activation',
    allTimeTopCount: 500,
    trendingWatchCount: 500,
    pinned: [],
    registeredDesignSources: [],
    installPolicy: 'metadata-first; audit-and-approve-before-activation',
    source: 'https://skills.sh'
  },
  referenceLibraries: [],
  optionalPlatformSources: []
})

class MemoryAgentProjectRepository implements AgentProjectRepository {
  private readonly assignments = new Map<string, ProjectAgentAssignment>()
  private readonly bindings = new Map<string, ProjectAgentThreadBinding>()
  private readonly teams = new Map<string, ProjectAgentTeam>()

  public putAssignment(assignment: ProjectAgentAssignment): Promise<void> { this.assignments.set(`${assignment.projectId}:${assignment.agentId}`, assignment); return Promise.resolve() }
  public getAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment | null> { return Promise.resolve(this.assignments.get(`${projectId}:${agentId}`) ?? null) }
  public listAssignments(projectId: string): Promise<ProjectAgentAssignment[]> { return Promise.resolve([...this.assignments.values()].filter((item) => item.projectId === projectId)) }
  public putThreadBinding(binding: ProjectAgentThreadBinding): Promise<void> { this.bindings.set(`${binding.projectId}:${binding.agentId}:${binding.provider}`, binding); return Promise.resolve() }
  public getThreadBinding(projectId: string, agentId: AgentId, provider: AIProviderKind): Promise<ProjectAgentThreadBinding | null> { return Promise.resolve(this.bindings.get(`${projectId}:${agentId}:${provider}`) ?? null) }
  public findThreadBinding(threadId: string): Promise<ProjectAgentThreadBinding | null> { return Promise.resolve([...this.bindings.values()].find((item) => item.threadId === threadId) ?? null) }
  public putTeam(team: ProjectAgentTeam): Promise<void> { this.teams.set(team.id, team); return Promise.resolve() }
  public listTeams(projectId: string): Promise<ProjectAgentTeam[]> { return Promise.resolve([...this.teams.values()].filter((item) => item.projectId === projectId)) }
}

class MemoryAudit implements AgentRuntimeAuditSink {
  public readonly events: AgentRuntimeAuditEvent[] = []
  public write(event: AgentRuntimeAuditEvent): Promise<void> { this.events.push(event); return Promise.resolve() }
}

describe('AgentProjectRuntime', () => {
  it('aprova Agent por projeto com loadout e memory namespace isolados', async () => {
    const repository = new MemoryAgentProjectRepository()
    const runtime = new AgentProjectRuntime(registryFixture(), repository)
    const a = await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a', ['skill-1'])
    const b = await runtime.approveForProject('project-b', 'AGENT-CODER', 'approval-b', ['skill-2'])
    expect(a.memoryNamespace).not.toBe(b.memoryNamespace)
    expect((await runtime.listProjectAssignments('project-a'))[0]?.skillIds).toEqual(['skill-1'])
    expect((await runtime.listProjectAssignments('project-b'))[0]?.skillIds).toEqual(['skill-2'])
  })

  it('mantém provider/model fora do Agent e exige rebind explícito ao trocar model', async () => {
    const repository = new MemoryAgentProjectRepository()
    const runtime = new AgentProjectRuntime(registryFixture(), repository)
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    await runtime.bindThread({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen-a', threadId: 'thread-a' })
    const dispatch = await runtime.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen-a', message: 'teste', mode: 'CHAT' })
    expect(dispatch.threadId).toBe('thread-a')
    await expect(runtime.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen-b', message: 'teste', mode: 'CHAT' })).rejects.toThrow('rebind explícito')
  })

  it('bloqueia thread compartilhada entre projetos', async () => {
    const repository = new MemoryAgentProjectRepository()
    const runtime = new AgentProjectRuntime(registryFixture(), repository)
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    await runtime.approveForProject('project-b', 'AGENT-CODER', 'approval-b')
    await runtime.bindThread({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen', threadId: 'shared-thread' })
    await expect(runtime.bindThread({ projectId: 'project-b', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen', threadId: 'shared-thread' })).rejects.toThrow('outro project/agent/provider')
  })

  it('capability mutável declarada continua sem autoridade direta e exige approval', async () => {
    const repository = new MemoryAgentProjectRepository()
    const audit = new MemoryAudit()
    const runtime = new AgentProjectRuntime(registryFixture(), repository, audit)
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    const gate = await runtime.gateCapability({
      projectId: 'project-a',
      agentId: 'AGENT-CODER',
      capability: 'workspace:write',
      target: 'src/app.ts',
      risk: 'HIGH',
      destructive: true,
      requiresNetwork: false,
      permissionProfile: 'FULL_ACCESS'
    })
    expect(gate.policyAllowed).toBe(true)
    expect(gate.requiresApproval).toBe(true)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
    expect(audit.events.some((event) => event.action === 'CAPABILITY_GATE')).toBe(true)
  })

  it('nega capability não declarada pelo Agent', async () => {
    const repository = new MemoryAgentProjectRepository()
    const runtime = new AgentProjectRuntime(registryFixture(), repository)
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    const gate = await runtime.gateCapability({
      projectId: 'project-a',
      agentId: 'AGENT-CODER',
      capability: 'network:external-write',
      target: 'https://example.com',
      risk: 'HIGH',
      destructive: true,
      requiresNetwork: true,
      permissionProfile: 'FULL_ACCESS'
    })
    expect(gate.declaredByAgent).toBe(false)
    expect(gate.policyAllowed).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
  })

  it('equipes só aceitam Agents aprovados no mesmo projeto', async () => {
    const repository = new MemoryAgentProjectRepository()
    const runtime = new AgentProjectRuntime(registryFixture(), repository)
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    await runtime.approveForProject('project-a', 'AGENT-RESEARCH', 'approval-r')
    const team = await runtime.createTeam('project-a', 'Core', ['AGENT-CODER', 'AGENT-RESEARCH'])
    expect(team.agentIds).toHaveLength(2)
    await expect(runtime.createTeam('project-b', 'Leak', ['AGENT-CODER'])).rejects.toThrow('não está aprovado')
  })
})

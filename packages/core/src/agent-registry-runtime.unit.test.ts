import { describe, expect, it } from 'vitest'
import { AgentRegistryRuntime } from './agent-registry-runtime'

const baseRegistry = () => ({
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
  agents: [{
    id: 'AGENT-CODER',
    name: 'Coding Worker',
    status: 'existing-runtime-role',
    modelRequirements: ['coding'],
    providerSelection: 'user-controlled',
    sources: ['internal:Tupiniquim-AI-Dev-Studio'],
    capabilities: ['code', 'test'],
    effects: ['workspace:write'],
    constraints: ['workspace-only']
  }],
  skillLibrary: {
    strategy: 'global-catalog-project-loadout-agent-loadout-task-activation',
    allTimeTopCount: 500,
    trendingWatchCount: 500,
    pinned: ['vercel-labs/skills/find-skills'],
    registeredDesignSources: [],
    installPolicy: 'metadata-first; audit-and-approve-before-activation',
    source: 'https://skills.sh'
  },
  referenceLibraries: [],
  optionalPlatformSources: []
})

describe('AgentRegistryRuntime', () => {
  it('materializa registry versionado e expõe definição sem selecionar provider/model', () => {
    const runtime = new AgentRegistryRuntime(baseRegistry())
    const agent = runtime.get('AGENT-CODER')
    expect(runtime.schemaVersion()).toBe('1.1.0')
    expect(agent.capabilities).toContain('code')
    expect(agent).not.toHaveProperty('provider')
    expect(agent).not.toHaveProperty('model')
  })

  it('falha fechado para id duplicado', () => {
    const registry = baseRegistry()
    registry.agents.push({ ...registry.agents[0]! })
    expect(() => new AgentRegistryRuntime(registry)).toThrow()
  })

  it('rejeita provider/model injetados dentro da definição do Agent', () => {
    const registry = baseRegistry() as ReturnType<typeof baseRegistry> & { agents: Array<Record<string, unknown>> }
    registry.agents[0] = { ...registry.agents[0], provider: 'ollama', model: 'qwen' }
    expect(() => new AgentRegistryRuntime(registry)).toThrow()
  })
})

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore, AgentRuntimeAuditAdapter, AuditLog } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime } from '@tupiniquim/core'

let dataRoot = ''

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(tmpdir(), 'mw4-dogfood-'))
})

afterEach(async () => {
  if (dataRoot !== '') await rm(dataRoot, { recursive: true, force: true })
})

describe('MW4 dogfood — Agent Registry → Project → Team → Thread → Dispatch → Gate → Restart', () => {
  it('executa o fluxo cloud-safe sem conceder autoridade implícita', async () => {
    const canonicalRaw = await readFile(path.join(process.cwd(), '.agent', 'AGENT_REGISTRY.json'), 'utf8')
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const audit = new AgentRuntimeAuditAdapter(new AuditLog(dataRoot))
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot), audit)

    expect(registry.snapshot().invariants.providerSelection).toBe('user-controlled-no-automatic-priority')
    expect(registry.get('AGENT-CODER')).not.toHaveProperty('provider')
    expect(registry.get('AGENT-CODER')).not.toHaveProperty('model')

    const coderA = await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval:coder-a', ['skill:repo-review'])
    const researchA = await runtime.approveForProject('project-a', 'AGENT-RESEARCH', 'approval:research-a', ['skill:citation-first'])
    const coderB = await runtime.approveForProject('project-b', 'AGENT-CODER', 'approval:coder-b', ['skill:isolated-b'])
    expect(coderA.memoryNamespace).not.toBe(coderB.memoryNamespace)
    expect(researchA.projectId).toBe('project-a')

    const team = await runtime.createTeam('project-a', 'Studio Core', ['AGENT-CODER', 'AGENT-RESEARCH'])
    expect(team.agentIds).toEqual(['AGENT-CODER', 'AGENT-RESEARCH'])

    await runtime.bindThread({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', threadId: 'mw4-thread-a' })
    const dispatch = await runtime.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', message: 'Continue a implementação.', mode: 'CHAT' })
    expect(dispatch.threadId).toBe('mw4-thread-a')
    expect(dispatch.skillIds).toEqual(['skill:repo-review'])

    const gate = await runtime.gateCapability({ projectId: 'project-a', agentId: 'AGENT-CODER', capability: 'workspace:write', target: 'src/mw4.ts', risk: 'HIGH', destructive: true, requiresNetwork: false, permissionProfile: 'AUTONOMOUS' })
    expect(gate.declaredByAgent).toBe(true)
    expect(gate.policyAllowed).toBe(true)
    expect(gate.requiresApproval).toBe(true)
    expect(gate.runtimeExecutionAuthorized).toBe(false)

    const researchMutation = await runtime.gateCapability({ projectId: 'project-a', agentId: 'AGENT-RESEARCH', capability: 'workspace:write', target: 'research.md', risk: 'HIGH', destructive: true, requiresNetwork: false, permissionProfile: 'FULL_ACCESS' })
    expect(researchMutation.declaredByAgent).toBe(false)
    expect(researchMutation.runtimeExecutionAuthorized).toBe(false)

    await expect(runtime.bindThread({ projectId: 'project-b', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', threadId: 'mw4-thread-a' })).rejects.toThrow('outro project/agent/provider')

    const restarted = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot), audit)
    const resumed = await restarted.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', message: 'Retome após restart.', mode: 'CHAT' })
    expect(resumed.threadId).toBe('mw4-thread-a')
    expect((await restarted.listProjectAssignments('project-b'))[0]?.skillIds).toEqual(['skill:isolated-b'])
    expect((await restarted.listProjectAssignments('project-a')).map((item) => item.projectId).every((id) => id === 'project-a')).toBe(true)
  })
})

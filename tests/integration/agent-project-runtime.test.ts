import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore, AgentRuntimeAuditAdapter, AuditLog } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime } from '@tupiniquim/core'

let dataRoot = ''

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(tmpdir(), 'mw4-agent-runtime-'))
})

afterEach(async () => {
  if (dataRoot !== '') await rm(dataRoot, { recursive: true, force: true })
})

const loadCanonicalRegistry = async (): Promise<AgentRegistryRuntime> => {
  const raw = await readFile(path.join(process.cwd(), '.agent', 'AGENT_REGISTRY.json'), 'utf8')
  return AgentRegistryRuntime.fromJson(raw)
}

describe('MW4 Agent Registry durable project/thread runtime', () => {
  it('carrega registry canônico, persiste project/team/thread e recupera após restart', async () => {
    const registry = await loadCanonicalRegistry()
    expect(registry.list().length).toBeGreaterThanOrEqual(10)

    const store = new AgentProjectJsonStore(dataRoot)
    const audit = new AgentRuntimeAuditAdapter(new AuditLog(dataRoot))
    const runtime = new AgentProjectRuntime(registry, store, audit)

    const projectA = await runtime.approveForProject('project-a', 'AGENT-CODER', 'human-approval:project-a', ['skill-a'])
    const projectB = await runtime.approveForProject('project-b', 'AGENT-CODER', 'human-approval:project-b', ['skill-b'])
    await runtime.approveForProject('project-a', 'AGENT-RESEARCH', 'human-approval:research-a')
    const team = await runtime.createTeam('project-a', 'Core Team', ['AGENT-CODER', 'AGENT-RESEARCH'])

    expect(projectA.memoryNamespace).not.toBe(projectB.memoryNamespace)
    expect(team.projectId).toBe('project-a')

    await runtime.bindThread({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', threadId: 'thread-a' })
    const firstDispatch = await runtime.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', message: 'Continue o projeto.', mode: 'CHAT' })
    expect(firstDispatch.threadId).toBe('thread-a')
    expect(firstDispatch.skillIds).toEqual(['skill-a'])

    const gate = await runtime.gateCapability({
      projectId: 'project-a',
      agentId: 'AGENT-CODER',
      capability: 'workspace:write',
      target: 'src/app.ts',
      risk: 'HIGH',
      destructive: true,
      requiresNetwork: false,
      permissionProfile: 'AUTONOMOUS'
    })
    expect(gate.requiresApproval).toBe(true)
    expect(gate.runtimeExecutionAuthorized).toBe(false)

    const restarted = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot), audit)
    const resumed = await restarted.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', message: 'Retome.', mode: 'CHAT' })
    expect(resumed.threadId).toBe('thread-a')
    expect((await restarted.listTeams('project-a'))[0]?.agentIds).toEqual(['AGENT-CODER', 'AGENT-RESEARCH'])
    expect((await restarted.listProjectAssignments('project-b'))[0]?.skillIds).toEqual(['skill-b'])

    await expect(restarted.bindThread({ projectId: 'project-b', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen2.5-coder:3b', threadId: 'thread-a' })).rejects.toThrow('outro project/agent/provider')

    const auditLog = await readFile(path.join(dataRoot, 'logs', 'audit.jsonl'), 'utf8')
    expect(auditLog).toContain('agent-runtime.project_approve')
    expect(auditLog).toContain('agent-runtime.capability_gate')
  })
})

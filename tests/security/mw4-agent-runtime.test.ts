import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime } from '@tupiniquim/core'

let dataRoot = ''
let canonicalRaw = ''

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(tmpdir(), 'mw4-security-'))
  canonicalRaw = await readFile(path.join(process.cwd(), '.agent', 'AGENT_REGISTRY.json'), 'utf8')
})

afterEach(async () => {
  if (dataRoot !== '') await rm(dataRoot, { recursive: true, force: true })
})

describe('MW4 Agent Runtime security boundaries', () => {
  it('rejeita provider/model injetados na definição canônica do Agent', () => {
    const registry = JSON.parse(canonicalRaw) as { agents: Array<Record<string, unknown>> }
    registry.agents[0] = { ...registry.agents[0], provider: 'ollama', model: 'shadow-model' }
    expect(() => new AgentRegistryRuntime(registry)).toThrow()
  })

  it('bloqueia cross-project thread reuse', async () => {
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot))
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    await runtime.approveForProject('project-b', 'AGENT-CODER', 'approval-b')
    await runtime.bindThread({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen', threadId: 'thread-shared' })
    await expect(runtime.bindThread({ projectId: 'project-b', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen', threadId: 'thread-shared' })).rejects.toThrow('outro project/agent/provider')
  })

  it('não transforma FULL_ACCESS em autoridade de efeito do Agent', async () => {
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot))
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    const gate = await runtime.gateCapability({ projectId: 'project-a', agentId: 'AGENT-CODER', capability: 'workspace:write', target: 'src/app.ts', risk: 'HIGH', destructive: true, requiresNetwork: false, permissionProfile: 'FULL_ACCESS' })
    expect(gate.canonicalCapability).toBe('workspace.write')
    expect(gate.policyAllowed).toBe(true)
    expect(gate.requiresApproval).toBe(true)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
  })

  it('capability ausente no Agent permanece negada mesmo em FULL_ACCESS', async () => {
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot))
    await runtime.approveForProject('project-a', 'AGENT-RESEARCH', 'approval-r')
    const gate = await runtime.gateCapability({ projectId: 'project-a', agentId: 'AGENT-RESEARCH', capability: 'network:external-write', target: 'https://example.com', risk: 'HIGH', destructive: true, requiresNetwork: true, permissionProfile: 'FULL_ACCESS' })
    expect(gate.declaredByAgent).toBe(false)
    expect(gate.policyAllowed).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
  })

  it('efeito MW5 declarado permanece metadata-only sem materializador MW4', async () => {
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot))
    await runtime.approveForProject('project-a', 'AGENT-ILLUSTRATOR', 'approval-illustrator')
    const gate = await runtime.gateCapability({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', capability: 'asset:create', target: 'assets/example.png', risk: 'HIGH', destructive: true, requiresNetwork: false, permissionProfile: 'FULL_ACCESS' })
    expect(gate.declaredByAgent).toBe(true)
    expect(gate.canonicalCapability).toBeNull()
    expect(gate.policyAllowed).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
  })

  it('Agent desabilitado não pode resolver novo dispatch', async () => {
    const registry = AgentRegistryRuntime.fromJson(canonicalRaw)
    const runtime = new AgentProjectRuntime(registry, new AgentProjectJsonStore(dataRoot))
    await runtime.approveForProject('project-a', 'AGENT-CODER', 'approval-a')
    await runtime.disableForProject('project-a', 'AGENT-CODER')
    await expect(runtime.resolveDispatch({ projectId: 'project-a', agentId: 'AGENT-CODER', provider: 'ollama', model: 'qwen', message: 'não execute', mode: 'CHAT' })).rejects.toThrow('não está aprovado')
  })
})

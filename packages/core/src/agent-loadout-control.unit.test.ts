import { describe, expect, it } from 'vitest'
import { AgentLoadoutStore, validateAgentLoadout, type AgentLoadoutDependencies } from './agent-loadout-control'

const deps: AgentLoadoutDependencies = {
  isSkillEnabled: (projectId, skillId) => projectId === 'project-a' && skillId === 'skill-approved',
  isModelAvailable: (provider, model) => provider === 'codex-app-server' ? model === null : model === 'qwen2.5-coder:3b'
}

describe('Agent loadouts', () => {
  it('exige modelo explícito para Ollama', () => {
    expect(() => validateAgentLoadout({ projectId: 'project-a', agentId: 'dev', provider: 'ollama', model: null, skillIds: [], permissionProfile: 'ASSISTED' }, deps)).toThrow(/explicit model/i)
  })

  it('não permite skill não habilitada no projeto', () => {
    expect(() => validateAgentLoadout({ projectId: 'project-a', agentId: 'dev', provider: 'ollama', model: 'qwen2.5-coder:3b', skillIds: ['skill-denied'], permissionProfile: 'ASSISTED' }, deps)).toThrow(/not enabled/i)
  })

  it('mantém provider/model/skills separados e explícitos', () => {
    expect(validateAgentLoadout({ projectId: 'project-a', agentId: 'dev', provider: 'ollama', model: 'qwen2.5-coder:3b', skillIds: ['skill-approved', 'skill-approved'], permissionProfile: 'ASSISTED' }, deps)).toEqual({
      projectId: 'project-a', agentId: 'dev', provider: 'ollama', model: 'qwen2.5-coder:3b', skillIds: ['skill-approved'], permissionProfile: 'ASSISTED'
    })
  })

  it('exige aprovação explícita para alterar loadout', () => {
    const store = new AgentLoadoutStore()
    expect(() => store.put({ projectId: 'project-a', agentId: 'dev', provider: 'codex-app-server', model: null, skillIds: [], permissionProfile: 'READ_ONLY' }, deps, false)).toThrow(/explicit user approval/i)
  })

  it('isola loadouts por projeto', () => {
    const store = new AgentLoadoutStore()
    store.put({ projectId: 'project-a', agentId: 'dev', provider: 'codex-app-server', model: null, skillIds: [], permissionProfile: 'READ_ONLY' }, deps, true)
    expect(store.list('project-a')).toHaveLength(1)
    expect(store.list('project-b')).toHaveLength(0)
  })
})

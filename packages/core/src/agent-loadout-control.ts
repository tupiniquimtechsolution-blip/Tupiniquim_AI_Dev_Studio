import type { UnifiedProviderId } from './provider-model-control'

export interface AgentLoadout {
  projectId: string
  agentId: string
  provider: UnifiedProviderId
  model: string | null
  skillIds: string[]
  permissionProfile: 'READ_ONLY' | 'ASSISTED' | 'FULL_ACCESS'
}

export interface AgentLoadoutDependencies {
  isSkillEnabled(projectId: string, skillId: string): boolean
  isModelAvailable(provider: UnifiedProviderId, model: string | null): boolean
}

export const validateAgentLoadout = (loadout: AgentLoadout, deps: AgentLoadoutDependencies): AgentLoadout => {
  if (loadout.projectId.trim() === '' || loadout.agentId.trim() === '') throw new Error('Agent loadout requires projectId and agentId.')
  if (loadout.provider === 'ollama' && (loadout.model === null || loadout.model.trim() === '')) {
    throw new Error('Ollama agent loadout requires an explicit model.')
  }
  if (loadout.provider === 'codex-app-server' && loadout.model !== null) {
    throw new Error('Codex agent loadout must not embed a local model.')
  }
  if (!deps.isModelAvailable(loadout.provider, loadout.model)) throw new Error('Selected provider/model is not currently available.')

  const uniqueSkillIds = [...new Set(loadout.skillIds)]
  for (const skillId of uniqueSkillIds) {
    if (!deps.isSkillEnabled(loadout.projectId, skillId)) throw new Error(`Skill is not enabled for project: ${skillId}`)
  }

  return { ...loadout, skillIds: uniqueSkillIds }
}

export class AgentLoadoutStore {
  private readonly loadouts = new Map<string, AgentLoadout>()

  public put(loadout: AgentLoadout, deps: AgentLoadoutDependencies, approvedByUser: boolean): AgentLoadout {
    if (!approvedByUser) throw new Error('Agent loadout changes require explicit user approval.')
    const validated = validateAgentLoadout(loadout, deps)
    this.loadouts.set(`${validated.projectId}:${validated.agentId}`, validated)
    return validated
  }

  public get(projectId: string, agentId: string): AgentLoadout | null {
    return this.loadouts.get(`${projectId}:${agentId}`) ?? null
  }

  public list(projectId: string): AgentLoadout[] {
    return [...this.loadouts.values()].filter((loadout) => loadout.projectId === projectId)
  }
}

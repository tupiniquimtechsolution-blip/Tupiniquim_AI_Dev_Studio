import type { RegistryEntry } from '@tupiniquim/contracts'
import { assessSkillGate } from './registry-catalog'

export interface ProjectSkillEnablement {
  projectId: string
  skillId: string
  enabled: boolean
}

export class SkillProjectControl {
  private readonly enabledByProject = new Map<string, Set<string>>()

  public enable(entry: RegistryEntry, projectId: string, approvedByUser: boolean): ProjectSkillEnablement {
    const assessment = assessSkillGate(entry, projectId)
    if (!approvedByUser) throw new Error('Skill enablement requires explicit user approval.')
    if (!assessment.adoptionReady) {
      throw new Error(`Skill is not adoption-ready: ${assessment.blockers.join(', ') || 'STATUS_NOT_APPROVED'}`)
    }
    const enabled = this.enabledByProject.get(projectId) ?? new Set<string>()
    enabled.add(entry.id)
    this.enabledByProject.set(projectId, enabled)
    return { projectId, skillId: entry.id, enabled: true }
  }

  public disable(skillId: string, projectId: string): ProjectSkillEnablement {
    const enabled = this.enabledByProject.get(projectId)
    enabled?.delete(skillId)
    return { projectId, skillId, enabled: false }
  }

  public isEnabled(skillId: string, projectId: string): boolean {
    return this.enabledByProject.get(projectId)?.has(skillId) ?? false
  }

  public listEnabled(projectId: string): string[] {
    return [...(this.enabledByProject.get(projectId) ?? new Set<string>())].sort()
  }
}

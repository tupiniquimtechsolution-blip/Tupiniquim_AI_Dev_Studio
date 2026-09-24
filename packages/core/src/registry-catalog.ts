import {
  registryEntrySchema,
  skillGateAssessmentSchema,
  type RegistryEntry,
  type SkillGateAssessment
} from '@tupiniquim/contracts'

export const isRegistryEntryVisibleToProject = (entry: RegistryEntry, projectId: string): boolean =>
  entry.scope.kind === 'GLOBAL' || entry.scope.projectId === projectId

export class RegistryCatalog {
  private readonly entries: RegistryEntry[]

  public constructor(entries: RegistryEntry[]) {
    this.entries = entries.map((entry) => registryEntrySchema.parse(entry))
  }

  public listForProject(projectId: string): RegistryEntry[] {
    return this.entries.filter((entry) => isRegistryEntryVisibleToProject(entry, projectId))
  }

  public findForProject(id: string, projectId: string): RegistryEntry | null {
    return this.entries.find((entry) => entry.id === id && isRegistryEntryVisibleToProject(entry, projectId)) ?? null
  }
}

export const assessSkillGate = (input: RegistryEntry, projectId: string): SkillGateAssessment => {
  const entry = registryEntrySchema.parse(input)
  const blockers: string[] = []
  const visibleToProject = isRegistryEntryVisibleToProject(entry, projectId)

  if (entry.kind !== 'SKILL') blockers.push('ENTRY_NOT_SKILL')
  if (!visibleToProject) blockers.push('PROJECT_SCOPE_MISMATCH')
  if (entry.license !== 'KNOWN') blockers.push('LICENSE_NOT_KNOWN')
  if (entry.cost === 'UNKNOWN') blockers.push('COST_NOT_DECLARED')
  if (entry.trust === 'EXTERNAL_UNTRUSTED') blockers.push('PROVENANCE_NOT_CURATED')
  if (entry.status === 'DISCOVERED') blockers.push('STATUS_NOT_VERIFIED')
  if (entry.status === 'REJECTED') blockers.push('STATUS_REJECTED')
  if (entry.status === 'DEPRECATED') blockers.push('STATUS_DEPRECATED')

  const eligibleForApproval = blockers.length === 0
  const adoptionReady = eligibleForApproval && entry.status === 'APPROVED'

  return skillGateAssessmentSchema.parse({
    skillId: entry.id,
    projectId,
    visibleToProject,
    eligibleForApproval,
    adoptionReady,
    runtimeExecutionAuthorized: false,
    requiresHumanApproval: true,
    blockers
  })
}

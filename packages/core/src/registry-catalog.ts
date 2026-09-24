import { randomUUID } from 'node:crypto'
import {
  registryDiscoveryInputSchema,
  registryEntrySchema,
  registryGateAssessmentSchema,
  skillGateAssessmentSchema,
  type RegistryDiscoveryInput,
  type RegistryEntry,
  type RegistryGateAssessment,
  type RegistryKind,
  type SkillGateAssessment
} from '@tupiniquim/contracts'

const executableKinds = new Set<RegistryKind>(['TOOL', 'MCP_SERVER', 'SKILL', 'PUBLIC_API', 'PLATFORM'])

export const isRegistryEntryVisibleToProject = (entry: RegistryEntry, projectId: string): boolean =>
  entry.scope.kind === 'GLOBAL' || entry.scope.projectId === projectId

export class RegistryCatalog {
  private readonly entries: RegistryEntry[]

  public constructor(entries: RegistryEntry[] = []) {
    this.entries = entries.map((entry) => registryEntrySchema.parse(entry))
  }

  public discover(input: RegistryDiscoveryInput): RegistryEntry {
    const parsed = registryDiscoveryInputSchema.parse(input)
    const entry = registryEntrySchema.parse({
      ...parsed,
      id: randomUUID(),
      status: 'DISCOVERED',
      trust: 'EXTERNAL_UNTRUSTED',
      provenance: {
        ...parsed.provenance,
        retrievedAt: new Date().toISOString()
      }
    })
    this.entries.push(entry)
    return entry
  }

  public listForProject(projectId: string): RegistryEntry[] {
    return this.entries.filter((entry) => isRegistryEntryVisibleToProject(entry, projectId))
  }

  public listByKindForProject(kind: RegistryKind, projectId: string): RegistryEntry[] {
    return this.listForProject(projectId).filter((entry) => entry.kind === kind)
  }

  public findForProject(id: string, projectId: string): RegistryEntry | null {
    return this.entries.find((entry) => entry.id === id && isRegistryEntryVisibleToProject(entry, projectId)) ?? null
  }
}

export const assessRegistryGate = (input: RegistryEntry, projectId: string): RegistryGateAssessment => {
  const entry = registryEntrySchema.parse(input)
  const blockers: string[] = []
  const visibleToProject = isRegistryEntryVisibleToProject(entry, projectId)
  const executable = executableKinds.has(entry.kind)

  if (!visibleToProject) blockers.push('PROJECT_SCOPE_MISMATCH')
  if (entry.status === 'DISCOVERED') blockers.push('STATUS_NOT_VERIFIED')
  if (entry.status === 'REJECTED') blockers.push('STATUS_REJECTED')
  if (entry.status === 'DEPRECATED') blockers.push('STATUS_DEPRECATED')
  if (entry.trust === 'EXTERNAL_UNTRUSTED') blockers.push('PROVENANCE_NOT_CURATED')
  if (entry.citations.length === 0) blockers.push('CITATIONS_REQUIRED')

  if (executable) {
    if (entry.license !== 'KNOWN') blockers.push('LICENSE_NOT_KNOWN')
    if (entry.cost === 'UNKNOWN') blockers.push('COST_NOT_DECLARED')
    if (entry.metadata.dependenciesReviewed !== 'true') blockers.push('DEPENDENCIES_NOT_REVIEWED')
    if (entry.metadata.permissionsReviewed !== 'true') blockers.push('PERMISSIONS_NOT_REVIEWED')
    if (entry.provenance.sourceRef === undefined && entry.provenance.sourceHash === undefined) blockers.push('PROVENANCE_NOT_PINNED')
  }

  const eligibleForApproval = blockers.length === 0
  const adoptionReady = eligibleForApproval && entry.status === 'APPROVED'

  return registryGateAssessmentSchema.parse({
    entryId: entry.id,
    kind: entry.kind,
    projectId,
    visibleToProject,
    eligibleForApproval,
    adoptionReady,
    runtimeExecutionAuthorized: false,
    requiresHumanApproval: true,
    blockers
  })
}

export const assessSkillGate = (input: RegistryEntry, projectId: string): SkillGateAssessment => {
  const entry = registryEntrySchema.parse(input)
  const generic = assessRegistryGate(entry, projectId)
  const blockers = [...generic.blockers]
  if (entry.kind !== 'SKILL') blockers.unshift('ENTRY_NOT_SKILL')
  const eligibleForApproval = blockers.length === 0

  return skillGateAssessmentSchema.parse({
    skillId: entry.id,
    projectId,
    visibleToProject: generic.visibleToProject,
    eligibleForApproval,
    adoptionReady: eligibleForApproval && entry.status === 'APPROVED',
    runtimeExecutionAuthorized: false,
    requiresHumanApproval: true,
    blockers
  })
}

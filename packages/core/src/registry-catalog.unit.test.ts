import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { registryEntrySchema, type RegistryEntry } from '@tupiniquim/contracts'
import { assessRegistryGate, assessSkillGate, RegistryCatalog } from './registry-catalog'

const makeEntry = (overrides: Partial<RegistryEntry> = {}): RegistryEntry => registryEntrySchema.parse({
  id: randomUUID(),
  kind: 'SKILL',
  name: 'Skill de teste',
  description: 'Metadados de skill usados para provar isolamento e gate.',
  scope: { kind: 'GLOBAL' },
  status: 'VERIFIED',
  trust: 'CURATED_METADATA',
  license: 'KNOWN',
  cost: 'FREE',
  dependencies: [],
  permissions: [],
  citations: ['https://example.com/skill'],
  tags: ['test'],
  metadata: { dependenciesReviewed: 'true', permissionsReviewed: 'true' },
  provenance: {
    sourceUrl: 'https://example.com/skill',
    retrievedAt: new Date().toISOString(),
    sourceRef: 'v1'
  },
  ...overrides
})

describe('RegistryCatalog', () => {
  it('isola entries PROJECT e mantém entries GLOBAL visíveis', () => {
    const global = makeEntry({ name: 'Global' })
    const projectA = makeEntry({ name: 'Projeto A', scope: { kind: 'PROJECT', projectId: 'project-a' } })
    const projectB = makeEntry({ name: 'Projeto B', scope: { kind: 'PROJECT', projectId: 'project-b' } })
    const catalog = new RegistryCatalog([global, projectA, projectB])

    expect(catalog.listForProject('project-a').map((entry) => entry.name)).toEqual(['Global', 'Projeto A'])
    expect(catalog.listForProject('project-b').map((entry) => entry.name)).toEqual(['Global', 'Projeto B'])
    expect(catalog.findForProject(projectA.id, 'project-b')).toBeNull()
  })

  it('toda descoberta nasce não confiável e não aprovada, inclusive API/MCP/tool/technology', () => {
    const catalog = new RegistryCatalog()
    const kinds = ['PUBLIC_API', 'MCP_SERVER', 'TOOL', 'TECHNOLOGY'] as const

    const entries = kinds.map((kind) => catalog.discover({
      kind,
      name: `${kind} descoberta`,
      description: 'Entrada descoberta para prova de lifecycle seguro.',
      provenance: { sourceUrl: 'https://example.com/source', sourceRef: 'discovery-v1' }
    }))

    expect(entries.every((entry) => entry.status === 'DISCOVERED')).toBe(true)
    expect(entries.every((entry) => entry.trust === 'EXTERNAL_UNTRUSTED')).toBe(true)
    expect(catalog.listByKindForProject('PUBLIC_API', 'project-a')).toHaveLength(1)
    expect(assessRegistryGate(entries[0]!, 'project-a').runtimeExecutionAuthorized).toBe(false)
  })
})

describe('assessRegistryGate', () => {
  it('bloqueia capability executável sem revisão explícita de dependências/permissões', () => {
    const assessment = assessRegistryGate(makeEntry({
      kind: 'TOOL',
      metadata: {},
      status: 'VERIFIED'
    }), 'project-a')

    expect(assessment.blockers).toEqual(expect.arrayContaining([
      'DEPENDENCIES_NOT_REVIEWED',
      'PERMISSIONS_NOT_REVIEWED'
    ]))
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })

  it('uma PUBLIC_API aprovada ainda não ganha autorização de execução', () => {
    const assessment = assessRegistryGate(makeEntry({
      kind: 'PUBLIC_API',
      status: 'APPROVED'
    }), 'project-a')

    expect(assessment.blockers).toEqual([])
    expect(assessment.adoptionReady).toBe(true)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
    expect(assessment.requiresHumanApproval).toBe(true)
  })
})

describe('assessSkillGate', () => {
  it('não transforma descoberta em aprovação nem execução', () => {
    const assessment = assessSkillGate(makeEntry({ status: 'DISCOVERED' }), 'project-a')

    expect(assessment.blockers).toContain('STATUS_NOT_VERIFIED')
    expect(assessment.eligibleForApproval).toBe(false)
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  it('permite revisão de metadata verificada sem autorizar adoção ou runtime', () => {
    const assessment = assessSkillGate(makeEntry({ status: 'VERIFIED' }), 'project-a')

    expect(assessment.blockers).toEqual([])
    expect(assessment.eligibleForApproval).toBe(true)
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })

  it('marca adoção pronta somente após APPROVED, mas execução continua fora da MW2', () => {
    const assessment = assessSkillGate(makeEntry({ status: 'APPROVED' }), 'project-a')

    expect(assessment.eligibleForApproval).toBe(true)
    expect(assessment.adoptionReady).toBe(true)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })

  it('bloqueia skill fora do projeto e metadata de licença/custo/provenance incerta', () => {
    const assessment = assessSkillGate(makeEntry({
      scope: { kind: 'PROJECT', projectId: 'project-a' },
      license: 'UNKNOWN',
      cost: 'UNKNOWN',
      trust: 'EXTERNAL_UNTRUSTED',
      metadata: {}
    }), 'project-b')

    expect(assessment.blockers).toEqual(expect.arrayContaining([
      'PROJECT_SCOPE_MISMATCH',
      'LICENSE_NOT_KNOWN',
      'COST_NOT_DECLARED',
      'PROVENANCE_NOT_CURATED',
      'DEPENDENCIES_NOT_REVIEWED',
      'PERMISSIONS_NOT_REVIEWED'
    ]))
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })

  it('recusa usar uma PUBLIC_API como skill executável', () => {
    const assessment = assessSkillGate(makeEntry({ kind: 'PUBLIC_API', status: 'APPROVED' }), 'project-a')

    expect(assessment.blockers).toContain('ENTRY_NOT_SKILL')
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })
})

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { registryEntrySchema, type RegistryEntry } from '@tupiniquim/contracts'
import { assessSkillGate, RegistryCatalog } from './registry-catalog'

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
  metadata: {},
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
      trust: 'EXTERNAL_UNTRUSTED'
    }), 'project-b')

    expect(assessment.blockers).toEqual(expect.arrayContaining([
      'PROJECT_SCOPE_MISMATCH',
      'LICENSE_NOT_KNOWN',
      'COST_NOT_DECLARED',
      'PROVENANCE_NOT_CURATED'
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

import { describe, expect, it } from 'vitest'
import { assessRegistryGate, assessSkillGate, RegistryCatalog } from './registry-catalog'
import { createMw2ReferenceEntries } from './mw2-reference-catalog'

describe('MW2 reference catalog', () => {
  it('mantém Public APIs como catálogo de descoberta e nunca como allowlist automática', () => {
    const entries = createMw2ReferenceEntries('2026-09-24T00:00:00.000Z')
    const publicApis = entries.find((entry) => entry.name === 'Public APIs Catalog')
    if (publicApis === undefined) throw new Error('Public APIs Catalog ausente.')

    expect(publicApis.kind).toBe('KNOWLEDGE_SOURCE')
    expect(publicApis.status).toBe('APPROVED')
    expect(publicApis.metadata.automaticAllowlist).toBe('false')
    expect(assessRegistryGate(publicApis, 'project-a').runtimeExecutionAuthorized).toBe(false)
  })

  it('mantém Supabase como candidate e não adoção global', () => {
    const entries = createMw2ReferenceEntries('2026-09-24T00:00:00.000Z')
    const supabase = entries.find((entry) => entry.name === 'Supabase')
    if (supabase === undefined) throw new Error('Supabase ausente.')

    expect(supabase.kind).toBe('PLATFORM')
    expect(supabase.metadata.candidateOnly).toBe('true')
    expect(supabase.metadata.automaticAdoption).toBe('false')
    const gate = assessRegistryGate(supabase, 'project-a')
    expect(gate.adoptionReady).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
  })

  it('expõe design skills e find-skills pinned para descoberta, não execução', () => {
    const catalog = new RegistryCatalog(createMw2ReferenceEntries('2026-09-24T00:00:00.000Z'))
    const skills = catalog.listByKindForProject('SKILL', 'project-a')

    expect(skills.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'UI UX Pro Max',
      'Emil Design Engineering',
      'Taste Skill',
      'Find Skills'
    ]))
    const pinned = skills.find((entry) => entry.metadata.skillId === 'vercel-labs/skills/find-skills')
    if (pinned === undefined) throw new Error('Find Skills pinned ausente.')
    const gate = assessSkillGate(pinned, 'project-a')
    expect(pinned.metadata.pinned).toBe('true')
    expect(gate.adoptionReady).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
    expect(gate.blockers).toEqual(expect.arrayContaining([
      'LICENSE_NOT_KNOWN',
      'COST_NOT_DECLARED',
      'DEPENDENCIES_NOT_REVIEWED',
      'PERMISSIONS_NOT_REVIEWED'
    ]))
  })
})

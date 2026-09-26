import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { registryEntrySchema, type RegistryEntry } from '@tupiniquim/contracts'
import { SkillProjectControl } from './skill-project-control'

const makeSkill = (overrides: Partial<RegistryEntry> = {}): RegistryEntry => registryEntrySchema.parse({
  id: randomUUID(),
  kind: 'SKILL',
  name: 'Skill aprovada',
  description: 'Skill para teste de enablement por projeto.',
  scope: { kind: 'GLOBAL' },
  status: 'APPROVED',
  trust: 'CURATED_METADATA',
  license: 'KNOWN',
  cost: 'FREE',
  dependencies: [],
  permissions: [],
  citations: ['https://example.com/skill'],
  tags: ['test'],
  metadata: { dependenciesReviewed: 'true', permissionsReviewed: 'true' },
  provenance: { sourceUrl: 'https://example.com/skill', retrievedAt: new Date().toISOString(), sourceRef: 'v1' },
  ...overrides
})

describe('SkillProjectControl', () => {
  it('exige aprovação explícita do usuário', () => {
    const control = new SkillProjectControl()
    expect(() => control.enable(makeSkill(), 'project-a', false)).toThrow(/explicit user approval/i)
  })

  it('recusa skill descoberta, mesmo se o usuário tentar habilitar', () => {
    const control = new SkillProjectControl()
    expect(() => control.enable(makeSkill({ status: 'DISCOVERED' }), 'project-a', true)).toThrow(/not adoption-ready/i)
  })

  it('habilita skill aprovada somente no projeto selecionado', () => {
    const control = new SkillProjectControl()
    const skill = makeSkill()
    control.enable(skill, 'project-a', true)
    expect(control.isEnabled(skill.id, 'project-a')).toBe(true)
    expect(control.isEnabled(skill.id, 'project-b')).toBe(false)
  })

  it('desabilita explicitamente sem afetar outro projeto', () => {
    const control = new SkillProjectControl()
    const skill = makeSkill()
    control.enable(skill, 'project-a', true)
    control.enable(skill, 'project-b', true)
    control.disable(skill.id, 'project-a')
    expect(control.isEnabled(skill.id, 'project-a')).toBe(false)
    expect(control.isEnabled(skill.id, 'project-b')).toBe(true)
  })
})

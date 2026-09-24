import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { technologyResolutionSchema } from '@tupiniquim/contracts'
import { RegistryCatalog, assessRegistryGate } from './registry-catalog'
import { registerTechnologyResolution } from './technology-registry'

describe('Technology Registry integration', () => {
  it('registra recomendações como descoberta PROJECT sem adoção automática', () => {
    const resolution = technologyResolutionSchema.parse({
      id: randomUUID(),
      requirements: 'Aplicação web interativa',
      generatedAt: new Date().toISOString(),
      recommendations: [{
        name: 'React + Vite',
        platform: 'WEB',
        score: 90,
        rationale: ['Ecossistema amplo.'],
        constraints: ['SSR exige camada adicional.'],
        sourceUrls: ['https://react.dev/', 'https://vite.dev/']
      }],
      knowledgePack: {
        title: 'Technology Resolution',
        summary: 'WEB: React + Vite (90)',
        citations: ['https://react.dev/', 'https://vite.dev/']
      }
    })
    const catalog = new RegistryCatalog()

    const [entry] = registerTechnologyResolution(catalog, 'project-a', resolution)
    if (entry === undefined) throw new Error('Technology entry não criada.')

    expect(entry.kind).toBe('TECHNOLOGY')
    expect(entry.scope).toEqual({ kind: 'PROJECT', projectId: 'project-a' })
    expect(entry.status).toBe('DISCOVERED')
    expect(entry.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(entry.metadata.automaticAdoption).toBe('false')
    expect(catalog.listForProject('project-b')).toEqual([])
    expect(assessRegistryGate(entry, 'project-a').runtimeExecutionAuthorized).toBe(false)
  })

  it('recusa recomendação sem provenance real', () => {
    const resolution = technologyResolutionSchema.parse({
      id: randomUUID(),
      requirements: 'Teste',
      generatedAt: new Date().toISOString(),
      recommendations: [{
        name: 'Sem fonte',
        platform: 'WEB',
        score: 50,
        rationale: ['Sem fonte.'],
        constraints: [],
        sourceUrls: []
      }],
      knowledgePack: { title: 'Technology Resolution', summary: 'Sem fonte', citations: [] }
    })

    expect(() => registerTechnologyResolution(new RegistryCatalog(), 'project-a', resolution)).toThrow('sem source URL')
  })
})

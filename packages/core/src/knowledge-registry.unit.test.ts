import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { KnowledgeRegistry } from './knowledge-registry'

describe('KnowledgeRegistry', () => {
  it('isola documentos e resultados por projectId', () => {
    const registry = new KnowledgeRegistry()
    registry.ingest({
      projectId: 'project-a',
      title: 'Documento A',
      sourceUrl: 'https://example.com/a',
      sourceId: randomUUID(),
      text: 'Supabase pode ser candidato de plataforma para o projeto A.',
      trust: 'CURATED_PROJECT_KNOWLEDGE'
    })
    registry.ingest({
      projectId: 'project-b',
      title: 'Documento B',
      sourceUrl: 'https://example.com/b',
      sourceId: randomUUID(),
      text: 'O projeto B possui conteúdo privado exclusivo sobre Supabase.',
      trust: 'CURATED_PROJECT_KNOWLEDGE'
    })

    const resultA = registry.query({ projectId: 'project-a', query: 'Supabase projeto', limit: 5 })
    const resultB = registry.query({ projectId: 'project-b', query: 'Supabase projeto', limit: 5 })

    expect(resultA.crossProjectExcluded).toBe(true)
    expect(resultA.hits).toHaveLength(1)
    expect(resultA.hits[0]?.chunk.projectId).toBe('project-a')
    expect(JSON.stringify(resultA)).not.toContain('privado exclusivo')
    expect(resultB.hits).toHaveLength(1)
    expect(resultB.hits[0]?.chunk.projectId).toBe('project-b')
  })

  it('retorna citations da própria fonte e não inventa hit sem sobreposição lexical', () => {
    const registry = new KnowledgeRegistry()
    const sourceId = randomUUID()
    registry.ingest({
      projectId: 'project-a',
      title: 'Research source',
      sourceUrl: 'https://example.com/research',
      sourceId,
      text: 'Research Agent preserva provenance citations e conteúdo externo não confiável.'
    })

    const hit = registry.query({ projectId: 'project-a', query: 'Research citations', limit: 3 })
    const miss = registry.query({ projectId: 'project-a', query: 'inexistente zebra', limit: 3 })

    expect(hit.hits).toHaveLength(1)
    expect(hit.citations).toEqual([{ sourceId, url: 'https://example.com/research', title: 'Research source' }])
    expect(hit.hits[0]?.chunk.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(miss.hits).toEqual([])
    expect(miss.citations).toEqual([])
  })

  it('gera hash de conteúdo e separa chunks sem remover provenance', () => {
    const registry = new KnowledgeRegistry()
    const document = registry.ingest({
      projectId: 'project-a',
      title: 'Documento grande',
      sourceUrl: 'https://example.com/large',
      text: `${'alpha '.repeat(900)}\n\n${'beta '.repeat(900)}`
    })

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(document.chunks.every((chunk) => /^[a-f0-9]{64}$/u.test(chunk.contentHash))).toBe(true)
    expect(document.chunks.every((chunk) => chunk.citation.url === 'https://example.com/large')).toBe(true)
  })
})

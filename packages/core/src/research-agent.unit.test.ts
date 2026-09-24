import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ResearchAgent, type ResearchSearchProvider } from './research-agent'

const source = (overrides: Partial<Awaited<ReturnType<ResearchSearchProvider['search']>>['sources'][number]> = {}) => ({
  id: randomUUID(),
  url: 'https://example.com/source',
  title: 'Fonte externa',
  snippet: 'Conteúdo externo de referência.',
  retrievedAt: new Date().toISOString(),
  origin: 'SEARCH' as const,
  trust: 'EXTERNAL_UNTRUSTED' as const,
  license: 'UNKNOWN' as const,
  promptInjectionSignals: [],
  ...overrides
})

describe('ResearchAgent', () => {
  it('preserva citations e nunca torna instruções externas autoritativas', async () => {
    const first = source({
      title: 'Fonte A',
      url: 'https://example.com/a',
      promptInjectionSignals: ['IGNORE_PREVIOUS_INSTRUCTIONS']
    })
    const second = source({ title: 'Fonte B', url: 'https://example.com/b' })
    const provider: ResearchSearchProvider = {
      search: () => Promise.resolve({ query: 'pesquisa segura', sources: [first, second], cached: false })
    }
    const agent = new ResearchAgent(provider)

    const brief = await agent.run({ projectId: 'project-a', query: 'pesquisa segura', maxResults: 2 })

    expect(brief.projectId).toBe('project-a')
    expect(brief.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(brief.instructionsAuthoritative).toBe(false)
    expect(brief.citations).toEqual([
      { sourceId: first.id, url: first.url, title: first.title },
      { sourceId: second.id, url: second.url, title: second.title }
    ])
    expect(brief.promptInjectionSignals).toEqual(['IGNORE_PREVIOUS_INSTRUCTIONS'])
    expect(brief.warnings).toContain('PROMPT_INJECTION_SIGNALS_PRESENT')
  })

  it('registra ausência de fontes sem inventar evidência', async () => {
    const provider: ResearchSearchProvider = {
      search: () => Promise.resolve({ query: 'sem resultado', sources: [], cached: true })
    }
    const agent = new ResearchAgent(provider)

    const brief = await agent.run({ projectId: 'project-b', query: 'sem resultado' })

    expect(brief.sources).toEqual([])
    expect(brief.citations).toEqual([])
    expect(brief.warnings).toEqual(['NO_SOURCES'])
    expect(brief.cached).toBe(true)
    expect(brief.instructionsAuthoritative).toBe(false)
  })
})

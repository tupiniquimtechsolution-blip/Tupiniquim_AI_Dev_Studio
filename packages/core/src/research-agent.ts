import { randomUUID } from 'node:crypto'
import {
  researchAgentInputSchema,
  researchBriefSchema,
  type ResearchAgentInput,
  type ResearchBrief,
  type ResearchResult
} from '@tupiniquim/contracts'

export interface ResearchSearchProvider {
  search(query: string, maxResults?: number): Promise<ResearchResult>
}

export class ResearchAgent {
  public constructor(private readonly provider: ResearchSearchProvider) {}

  public async run(input: ResearchAgentInput): Promise<ResearchBrief> {
    const parsed = researchAgentInputSchema.parse(input)
    const result = await this.provider.search(parsed.query, parsed.maxResults)
    const promptInjectionSignals = [...new Set(result.sources.flatMap((source) => source.promptInjectionSignals))]
    const warnings: string[] = []

    if (result.sources.length === 0) warnings.push('NO_SOURCES')
    if (promptInjectionSignals.length > 0) warnings.push('PROMPT_INJECTION_SIGNALS_PRESENT')

    return researchBriefSchema.parse({
      id: randomUUID(),
      projectId: parsed.projectId,
      query: result.query,
      generatedAt: new Date().toISOString(),
      trust: 'EXTERNAL_UNTRUSTED',
      instructionsAuthoritative: false,
      cached: result.cached,
      sources: result.sources,
      citations: result.sources.map((source) => ({ sourceId: source.id, url: source.url, title: source.title })),
      promptInjectionSignals,
      warnings
    })
  }
}

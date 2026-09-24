import { createHash, randomUUID } from 'node:crypto'
import {
  knowledgeDocumentSchema,
  knowledgeIngestInputSchema,
  knowledgeQueryInputSchema,
  knowledgeQueryResultSchema,
  type KnowledgeDocument,
  type KnowledgeIngestInput,
  type KnowledgeQueryInput,
  type KnowledgeQueryResult
} from '@tupiniquim/contracts'

const normalizeTerms = (value: string): string[] => [...new Set(value
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/gu, ' ')
  .split(/\s+/u)
  .filter((term) => term.length >= 2))]

const splitText = (text: string): string[] => {
  const paragraphs = text.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (current === '') {
      current = paragraph
      continue
    }
    if (`${current}\n\n${paragraph}`.length <= 4_000) {
      current = `${current}\n\n${paragraph}`
      continue
    }
    chunks.push(current)
    current = paragraph
  }
  if (current !== '') chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

export class KnowledgeRegistry {
  private readonly documents = new Map<string, KnowledgeDocument>()

  public ingest(input: KnowledgeIngestInput): KnowledgeDocument {
    const parsed = knowledgeIngestInputSchema.parse(input)
    const documentId = randomUUID()
    const citation = {
      ...(parsed.sourceId === undefined ? {} : { sourceId: parsed.sourceId }),
      url: parsed.sourceUrl,
      title: parsed.title
    }
    const chunks = splitText(parsed.text).map((text) => ({
      id: randomUUID(),
      documentId,
      projectId: parsed.projectId,
      text,
      contentHash: createHash('sha256').update(text).digest('hex'),
      trust: parsed.trust,
      citation
    }))
    const document = knowledgeDocumentSchema.parse({
      id: documentId,
      projectId: parsed.projectId,
      title: parsed.title,
      sourceUrl: parsed.sourceUrl,
      ...(parsed.sourceId === undefined ? {} : { sourceId: parsed.sourceId }),
      trust: parsed.trust,
      createdAt: new Date().toISOString(),
      chunks
    })
    this.documents.set(document.id, document)
    return document
  }

  public listDocuments(projectId: string): KnowledgeDocument[] {
    return [...this.documents.values()].filter((document) => document.projectId === projectId)
  }

  public query(input: KnowledgeQueryInput): KnowledgeQueryResult {
    const parsed = knowledgeQueryInputSchema.parse(input)
    const queryTerms = new Set(normalizeTerms(parsed.query))
    const hits = this.listDocuments(parsed.projectId)
      .flatMap((document) => document.chunks)
      .map((chunk) => {
        const terms = new Set(normalizeTerms(chunk.text))
        const score = [...queryTerms].filter((term) => terms.has(term)).length
        return { chunk, score }
      })
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
      .slice(0, parsed.limit)

    const citations = [...new Map(hits.map(({ chunk }) => [chunk.citation.url, chunk.citation])).values()]

    return knowledgeQueryResultSchema.parse({
      projectId: parsed.projectId,
      query: parsed.query,
      hits,
      citations,
      crossProjectExcluded: true
    })
  }
}

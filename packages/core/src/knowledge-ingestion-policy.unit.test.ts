import { describe, expect, it } from 'vitest'
import { KnowledgeRegistry } from './knowledge-registry'
import { assessKnowledgeIngestionPath } from './knowledge-ingestion-policy'

describe('Knowledge ingestion quarantine', () => {
  it('bloqueia .env, credenciais e tokens antes da indexação', () => {
    expect(assessKnowledgeIngestionPath('.env.local')).toEqual({ eligible: false, reason: 'SENSITIVE_PATH' })
    expect(assessKnowledgeIngestionPath('config/client-secret.json')).toEqual({ eligible: false, reason: 'SENSITIVE_PATH' })
    expect(assessKnowledgeIngestionPath('backups/api-token.txt')).toEqual({ eligible: false, reason: 'SENSITIVE_PATH' })
  })

  it('bloqueia artefatos gerados e internos do VCS', () => {
    expect(assessKnowledgeIngestionPath('node_modules/pkg/README.md')).toEqual({ eligible: false, reason: 'GENERATED_ARTIFACT' })
    expect(assessKnowledgeIngestionPath('release/app.exe')).toEqual({ eligible: false, reason: 'GENERATED_ARTIFACT' })
    expect(assessKnowledgeIngestionPath('.git/config')).toEqual({ eligible: false, reason: 'VCS_INTERNAL' })
  })

  it('permite documentação e código-fonte elegíveis', () => {
    expect(assessKnowledgeIngestionPath('docs/AI_TOOLBOX/REPOSITORIES.md')).toEqual({ eligible: true, reason: 'ELIGIBLE_SOURCE' })
    expect(assessKnowledgeIngestionPath('packages/core/src/registry-catalog.ts')).toEqual({ eligible: true, reason: 'ELIGIBLE_SOURCE' })
  })

  it('KnowledgeRegistry rejeita sourcePath sensível mesmo se o conteúdo foi fornecido', () => {
    const registry = new KnowledgeRegistry()

    expect(() => registry.ingest({
      projectId: 'project-a',
      title: 'Arquivo sensível',
      sourceUrl: 'https://drive.google.com/file/d/example/view',
      sourcePath: '.env.local',
      text: 'conteúdo não deve ser indexado'
    })).toThrow('SENSITIVE_PATH')
    expect(registry.listDocuments('project-a')).toEqual([])
  })
})

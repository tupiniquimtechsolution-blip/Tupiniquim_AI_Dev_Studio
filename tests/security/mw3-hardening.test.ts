import { describe, expect, it } from 'vitest'
import { redactUntrustedOutput, resolveLexicalPath } from '@tupiniquim/adapters'
import { PolicyEngine, RegistryCatalog, assessKnowledgeIngestionPath, assessSkillGate } from '@tupiniquim/core'

describe('MW3 hardening invariants', () => {
  it('não deixa credenciais comuns atravessarem saída não confiável', () => {
    const raw = 'authorization=Bearer-secret service_role=eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop password=hunter2'
    const redacted = redactUntrustedOutput(raw)
    expect(redacted).not.toContain('Bearer-secret')
    expect(redacted).not.toContain('eyJabcdefghijk')
    expect(redacted).not.toContain('hunter2')
  })

  it('bloqueia caminhos fora do workspace e arquivos sensíveis do Knowledge', () => {
    expect(() => resolveLexicalPath('/tmp/workspace', '../../etc/passwd')).toThrow()
    expect(assessKnowledgeIngestionPath('.env.local')).toEqual({ eligible: false, reason: 'SENSITIVE_PATH' })
    expect(assessKnowledgeIngestionPath('node_modules/pkg/index.js')).toEqual({ eligible: false, reason: 'GENERATED_ARTIFACT' })
  })

  it('FULL_ACCESS não remove bloqueios absolutos', () => {
    const decision = new PolicyEngine('FULL_ACCESS').evaluate({ capability: 'terminal.command', target: 'git push origin main --force', risk: 'CRITICAL', destructive: true, requiresNetwork: true })
    expect(decision.allowed).toBe(false)
    expect(decision.requiresApproval).toBe(false)
  })

  it('descoberta externa de skill nunca equivale a execução', () => {
    const catalog = new RegistryCatalog()
    const skill = catalog.discover({
      kind: 'SKILL',
      name: 'Untrusted external skill',
      description: 'Security negative fixture.',
      citations: ['https://example.com/skill'],
      provenance: { sourceUrl: 'https://example.com/skill', sourceRef: 'untrusted-v1' }
    })
    const assessment = assessSkillGate(skill, 'project-a')
    expect(skill.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(assessment.eligibleForApproval).toBe(false)
    expect(assessment.adoptionReady).toBe(false)
    expect(assessment.runtimeExecutionAuthorized).toBe(false)
  })
})

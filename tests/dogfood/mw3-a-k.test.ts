import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { dogfoodScenarioResultSchema, type PromptTemplate, type UIProfile, type VisualAsset } from '@tupiniquim/contracts'
import {
  KnowledgeRegistry,
  PolicyEngine,
  PreferenceService,
  PromptArchitect,
  RegistryCatalog,
  ResearchAgent,
  TechnologyResolutionEngine,
  VisualIntelligenceService,
  assessSkillGate,
  buildMw3ReadinessReport,
  createDefaultProfile,
  registerTechnologyResolution,
  type PreferenceRepository,
  type PromptRepository,
  type ResearchSearchProvider,
  type VisualRepository
} from '@tupiniquim/core'
import { redactUntrustedOutput, resolveLexicalPath } from '@tupiniquim/adapters'

const evidence = (ref: string) => [{ kind: 'DOGFOOD' as const, ref, detail: 'MW3 controlled dogfood evidence.' }]
const pass = (id: string, title: string) => dogfoodScenarioResultSchema.parse({ id, title, status: 'CLOUD_PASS', evidence: evidence(`MW3-${id}`), windowsDependencies: [] })

class MemoryPromptRepository implements PromptRepository {
  public readonly prompts = new Map<string, PromptTemplate>()
  public async putPrompt(template: PromptTemplate): Promise<void> { this.prompts.set(template.id, template) }
  public async getPrompt(id: string): Promise<PromptTemplate | null> { return this.prompts.get(id) ?? null }
  public async listPrompts(): Promise<PromptTemplate[]> { return [...this.prompts.values()] }
  public async recordPromptUsage(): Promise<void> {}
}

class MemoryPreferenceRepository implements PreferenceRepository {
  private profile: UIProfile | null = null
  public async putPreference(_key: string, profile: UIProfile): Promise<void> { this.profile = profile }
  public async getPreference(): Promise<UIProfile | null> { return this.profile }
}

class MemoryVisualRepository implements VisualRepository {
  private readonly assets = new Map<string, VisualAsset>()
  public async putVisualAsset(asset: VisualAsset): Promise<void> { this.assets.set(asset.id, asset) }
  public async getVisualAsset(id: string): Promise<VisualAsset | null> { return this.assets.get(id) ?? null }
  public async listVisualAssets(): Promise<VisualAsset[]> { return [...this.assets.values()] }
}

describe('MW3 controlled dogfood A-K', () => {
  it('A — bloqueia traversal lexical fora do workspace', () => {
    const root = path.join(tmpdir(), 'mw3-workspace')
    expect(() => resolveLexicalPath(root, '../outside.txt')).toThrow('workspace')
    expect(pass('A', 'Workspace/path boundary').status).toBe('CLOUD_PASS')
  })

  it('B — bloqueia comando absolutamente destrutivo mesmo em FULL_ACCESS', () => {
    const policy = new PolicyEngine('FULL_ACCESS')
    const decision = policy.evaluate({ capability: 'terminal.command', target: 'git reset --hard', risk: 'CRITICAL', destructive: true, requiresNetwork: false })
    expect(decision.allowed).toBe(false)
    expect(decision.requiresApproval).toBe(false)
    expect(pass('B', 'Policy absolute block').status).toBe('CLOUD_PASS')
  })

  it('C — Research → Knowledge preserva citation e conteúdo externo não confiável', async () => {
    const sourceId = randomUUID()
    const provider: ResearchSearchProvider = {
      search: () => Promise.resolve({
        query: 'knowledge citations',
        cached: false,
        sources: [{ id: sourceId, url: 'https://example.com/c', title: 'Source C', snippet: 'Knowledge citations provenance.', retrievedAt: new Date().toISOString(), origin: 'SEARCH', trust: 'EXTERNAL_UNTRUSTED', license: 'UNKNOWN', promptInjectionSignals: [] }]
      })
    }
    const brief = await new ResearchAgent(provider).run({ projectId: 'project-a', query: 'knowledge citations' })
    const knowledge = new KnowledgeRegistry()
    knowledge.ingest({ projectId: 'project-a', title: brief.sources[0]!.title, sourceUrl: brief.sources[0]!.url, sourceId, text: brief.sources[0]!.snippet })
    const result = knowledge.query({ projectId: 'project-a', query: 'Knowledge citations' })
    expect(brief.instructionsAuthoritative).toBe(false)
    expect(result.citations[0]?.sourceId).toBe(sourceId)
    expect(result.hits[0]?.chunk.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(pass('C', 'Research to Knowledge citation-first').status).toBe('CLOUD_PASS')
  })

  it('D — Technology Resolution entra no registry como descoberta, não adoção', () => {
    const resolution = new TechnologyResolutionEngine().resolve('dashboard web TypeScript SPA', ['WEB'], ['node', 'pnpm'])
    const catalog = new RegistryCatalog()
    const entries = registerTechnologyResolution(catalog, 'project-a', resolution)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((entry) => entry.status === 'DISCOVERED')).toBe(true)
    expect(entries.every((entry) => entry.metadata.automaticAdoption === 'false')).toBe(true)
    expect(pass('D', 'Technology resolution registry discovery').status).toBe('CLOUD_PASS')
  })

  it('E — Prompt Architect versiona/compila e detecta segredo literal', async () => {
    const architect = new PromptArchitect(new MemoryPromptRepository())
    const template = await architect.save('MW3', 'Objetivo: testar. Restrições: não vazar. Aceite: test.', [])
    const compiled = await architect.compile(template.id, {})
    expect(compiled.lint.some((issue) => issue.severity === 'ERROR')).toBe(false)
    expect(architect.lint('Objetivo: x. sk-proj-1234567890abcdefghijklmnop')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'POSSIBLE_SECRET' })]))
    expect(pass('E', 'Prompt Architect').status).toBe('CLOUD_PASS')
  })

  it('F — Visual Intelligence bloqueia asset sem licença conhecida', async () => {
    const dataRoot = path.join(tmpdir(), 'mw3-data')
    const visual = new VisualIntelligenceService(new MemoryVisualRepository(), dataRoot)
    const asset = await visual.add({
      name: 'Unknown asset',
      localPath: path.join(dataRoot, 'assets', 'unknown.png'),
      sourceUrl: 'https://example.com/asset.png',
      provider: 'STILLS',
      license: 'UNKNOWN',
      licenseName: null,
      attribution: null,
      rightsNote: 'Licença ainda não comprovada.'
    })
    await expect(visual.assertUsable(asset.id)).rejects.toThrow('licença conhecida')
    expect(pass('F', 'Visual license gate').status).toBe('CLOUD_PASS')
  })

  it('G — Preferences aceita baseline WCAG e rejeita contraste insuficiente', async () => {
    const preferences = new PreferenceService(new MemoryPreferenceRepository())
    const baseline = await preferences.save(createDefaultProfile())
    expect(baseline.name).toBe('Carbono/Floresta')
    await expect(preferences.save({ ...baseline, theme: { ...baseline.theme, text: '#111111', background: '#111111' } })).rejects.toThrow('WCAG AA')
    expect(pass('G', 'Preferences WCAG gate').status).toBe('CLOUD_PASS')
  })

  it('H — skill descoberta nunca recebe autorização de runtime', () => {
    const catalog = new RegistryCatalog()
    const skill = catalog.discover({
      kind: 'SKILL',
      name: 'External Skill',
      description: 'Skill externa para prova de gate.',
      citations: ['https://example.com/skill'],
      provenance: { sourceUrl: 'https://example.com/skill', sourceRef: 'v1' }
    })
    const gate = assessSkillGate(skill, 'project-a')
    expect(gate.adoptionReady).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
    expect(gate.requiresHumanApproval).toBe(true)
    expect(pass('H', 'Skill execution gate').status).toBe('CLOUD_PASS')
  })

  it('I — saída de preview/log remove credenciais e limita volume', () => {
    const output = redactUntrustedOutput(`authorization=Bearer-secret password=hunter2 ${'x'.repeat(6_000)}`)
    expect(output).not.toContain('Bearer-secret')
    expect(output).not.toContain('hunter2')
    expect(output.length).toBeLessThanOrEqual(4_000)
    expect(pass('I', 'Preview output redaction').status).toBe('CLOUD_PASS')
  })

  it('J — isolamento A→B→A impede vazamento de Knowledge', () => {
    const knowledge = new KnowledgeRegistry()
    knowledge.ingest({ projectId: 'A', title: 'A', sourceUrl: 'https://example.com/a', text: 'alpha shared-term public-a' })
    knowledge.ingest({ projectId: 'B', title: 'B', sourceUrl: 'https://example.com/b', text: 'beta shared-term private-b-marker' })
    const firstA = knowledge.query({ projectId: 'A', query: 'shared-term' })
    const b = knowledge.query({ projectId: 'B', query: 'shared-term' })
    const secondA = knowledge.query({ projectId: 'A', query: 'shared-term' })
    expect(JSON.stringify(firstA)).not.toContain('private-b-marker')
    expect(JSON.stringify(secondA)).not.toContain('private-b-marker')
    expect(JSON.stringify(b)).toContain('private-b-marker')
    expect(pass('J', 'Cross-project isolation A-B-A').status).toBe('CLOUD_PASS')
  })

  it('K — readiness permite CLOUD-GREEN mas mantém Windows fora de RELEASE-GREEN', () => {
    const report = buildMw3ReadinessReport([
      { id: 'cloud-core', title: 'Cloud core', status: 'CLOUD_PASS', platforms: ['WEB', 'DESKTOP', 'MOBILE'], evidence: evidence('MW3-K-cloud'), reason: 'Gates cloud comprovados.' },
      { id: 'conpty', title: 'ConPTY real', status: 'WINDOWS_DEFERRED', platforms: ['DESKTOP'], evidence: [{ kind: 'MANUAL', ref: 'windows-certification', detail: 'Exige host Windows real.' }], reason: 'Não exercitável no runner Linux.' }
    ])
    expect(report.cloudGreenEligible).toBe(true)
    expect(report.releaseGreenEligible).toBe(false)
    expect(report.windowsDeferred).toEqual(['conpty'])
    expect(pass('K', 'Readiness preserves deferred certification').status).toBe('CLOUD_PASS')
  })
})

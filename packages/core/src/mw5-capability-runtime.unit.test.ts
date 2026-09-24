import { describe, expect, it } from 'vitest'
import type {
  AgentId,
  AIProviderKind,
  Mw5AssetProvenance,
  Mw5VoiceConsent,
  ProjectAgentAssignment,
  ProjectAgentTeam,
  ProjectAgentThreadBinding
} from '@tupiniquim/contracts'
import { AgentRegistryRuntime } from './agent-registry-runtime'
import { Mw5CapabilityRuntime, type Mw5CapabilityStateRepository } from './mw5-capability-runtime'
import type { AgentProjectRepository } from './agent-project-runtime'

const registryDocument = () => ({
  schemaVersion: '1.1.0',
  updatedAt: '2026-09-24',
  invariants: {
    separation: 'agent != model != provider != tool != skill != source_repository',
    providerSelection: 'user-controlled-no-automatic-priority',
    defaultActivation: 'on-demand',
    defaultTrust: 'untrusted-external-source',
    paidServices: 'NOT_CONFIGURED until explicit approval',
    projectIsolation: true,
    mutationAuthority: 'PolicyEngine + ApprovalStore + AuditLog'
  },
  agents: [
    { id: 'AGENT-ILLUSTRATOR', name: 'Illustrator', status: 'source-registered', sources: ['Anil-matcha/Open-Generative-AI', 'internal:gemini-video-presets'], capabilities: ['image-generation', 'image-editing', 'video-generation'], effects: ['asset:create', 'asset:edit'], constraints: [] },
    { id: 'AGENT-VOICE', name: 'Voice', status: 'source-registered', sources: ['kyutai-labs/pocket-tts'], capabilities: ['local-tts', 'voice-cloning-with-consent'], effects: ['asset:create'], constraints: [] },
    { id: 'AGENT-SOCIAL', name: 'Social', status: 'source-registered', sources: ['diwenne/openreply'], capabilities: ['social-automation'], effects: ['network:external-write'], constraints: [] }
  ],
  skillLibrary: { strategy: 'global-catalog-project-loadout-agent-loadout-task-activation', allTimeTopCount: 500, trendingWatchCount: 500, pinned: ['vercel-labs/skills/find-skills'], registeredDesignSources: [], installPolicy: 'metadata-first; audit-and-approve-before-activation', source: 'https://skills.sh' },
  referenceLibraries: [],
  optionalPlatformSources: []
})

class MemoryProjectRepository implements AgentProjectRepository {
  public assignments = new Map<string, ProjectAgentAssignment>()
  public async putAssignment(value: ProjectAgentAssignment): Promise<void> { this.assignments.set(`${value.projectId}:${value.agentId}`, value) }
  public async getAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment | null> { return this.assignments.get(`${projectId}:${agentId}`) ?? null }
  public async listAssignments(projectId: string): Promise<ProjectAgentAssignment[]> { return [...this.assignments.values()].filter((value) => value.projectId === projectId) }
  public async putThreadBinding(_binding: ProjectAgentThreadBinding): Promise<void> {}
  public async getThreadBinding(_projectId: string, _agentId: AgentId, _provider: AIProviderKind): Promise<ProjectAgentThreadBinding | null> { return null }
  public async findThreadBinding(_threadId: string): Promise<ProjectAgentThreadBinding | null> { return null }
  public async putTeam(_team: ProjectAgentTeam): Promise<void> {}
  public async listTeams(_projectId: string): Promise<ProjectAgentTeam[]> { return [] }
}

class MemoryMw5State implements Mw5CapabilityStateRepository {
  public provenance: Mw5AssetProvenance[] = []
  public consents: Mw5VoiceConsent[] = []
  public async putProvenance(record: Mw5AssetProvenance): Promise<void> { this.provenance.push(record) }
  public async listProvenance(projectId: string): Promise<Mw5AssetProvenance[]> { return this.provenance.filter((record) => record.projectId === projectId) }
  public async putVoiceConsent(record: Mw5VoiceConsent): Promise<void> { this.consents.push(record) }
  public async getVoiceConsent(projectId: string, consentId: string): Promise<Mw5VoiceConsent | null> { return this.consents.find((record) => record.projectId === projectId && record.id === consentId) ?? null }
}

const approved = (agentId: AgentId): ProjectAgentAssignment => ({ projectId: 'project-a', agentId, lifecycle: 'APPROVED_FOR_PROJECT', approvalRef: 'approval://mw5', skillIds: [], memoryNamespace: `project:project-a:agent:${agentId}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

const setup = async (availability = {}) => {
  const registry = new AgentRegistryRuntime(registryDocument())
  const projects = new MemoryProjectRepository()
  for (const agentId of ['AGENT-ILLUSTRATOR', 'AGENT-VOICE', 'AGENT-SOCIAL'] as AgentId[]) await projects.putAssignment(approved(agentId))
  const state = new MemoryMw5State()
  return { runtime: new Mw5CapabilityRuntime(registry, projects, state, availability), state }
}

describe('Mw5CapabilityRuntime', () => {
  it('expõe source states sem ativar provider/model automaticamente', async () => {
    const { runtime } = await setup()
    const sources = runtime.listSources()
    expect(sources.find((source) => source.id === 'OPEN_GENERATIVE_AI')?.state).toBe('REGISTERED_SOURCE')
    expect(sources.find((source) => source.id === 'POCKET_TTS')?.state).toBe('WINDOWS_DEFERRED')
    expect(sources.find((source) => source.id === 'OPENREPLY')?.state).toBe('NOT_CONFIGURED')
    expect(sources.find((source) => source.id === 'KIMI_K3_C')?.state).toBe('EXPERIMENTAL')
  })

  it('media source só cria proposta e nunca recebe runtime authority', async () => {
    const { runtime } = await setup()
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', operation: 'IMAGE_GENERATE', sourceId: 'OPEN_GENERATIVE_AI', provider: null, model: null, target: 'asset://hero', risk: 'LOW', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.policyAllowed).toBe(true)
    expect(decision.requiresApproval).toBe(true)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
    expect(decision.canonicalCapability).toBe('asset.create')
  })

  it('voice clone falha fechado sem consentimento e provenance', async () => {
    const { runtime } = await setup()
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice-output', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.policyAllowed).toBe(false)
    expect(decision.consentValidated).toBe(false)
    expect(decision.provenanceValidated).toBe(false)
  })

  it('voice clone com consent/provenance continua proposal-only e WINDOWS_DEFERRED', async () => {
    const { runtime } = await setup()
    const consent = await runtime.recordVoiceConsent('project-a', 'AGENT-VOICE', 'subject://owner', 'evidence://consent')
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice-output', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: consent.id, inputProvenanceRef: 'asset://voice-sample', officialApiConfirmed: false })
    expect(decision.sourceState).toBe('WINDOWS_DEFERRED')
    expect(decision.policyAllowed).toBe(true)
    expect(decision.consentValidated).toBe(true)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
  })

  it('OpenReply exige configuração e confirmação de API oficial', async () => {
    const first = await setup()
    const blocked = await first.runtime.gate({ projectId: 'project-a', agentId: 'AGENT-SOCIAL', operation: 'SOCIAL_COMMENT_TO_DM', sourceId: 'OPENREPLY', provider: 'meta', model: null, target: 'instagram://campaign', risk: 'HIGH', destructive: false, requiresNetwork: true, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: true })
    expect(blocked.policyAllowed).toBe(false)

    const configured = await setup({ OPENREPLY_OFFICIAL_API_READY: true })
    const allowed = await configured.runtime.gate({ projectId: 'project-a', agentId: 'AGENT-SOCIAL', operation: 'SOCIAL_COMMENT_TO_DM', sourceId: 'OPENREPLY', provider: 'meta', model: null, target: 'instagram://campaign', risk: 'HIGH', destructive: false, requiresNetwork: true, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: true })
    expect(allowed.policyAllowed).toBe(true)
    expect(allowed.requiresApproval).toBe(true)
    expect(allowed.runtimeExecutionAuthorized).toBe(false)
  })

  it('rejeita source que não pertence ao Agent', async () => {
    const { runtime } = await setup({ POCKET_TTS_LOCAL_READY: true })
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', operation: 'TTS_GENERATE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://audio', risk: 'LOW', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.sourceDeclaredByAgent).toBe(false)
    expect(decision.policyAllowed).toBe(false)
  })
})

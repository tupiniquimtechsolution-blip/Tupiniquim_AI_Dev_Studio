import { randomUUID } from 'node:crypto'
import {
  mw5AssetProvenanceSchema,
  mw5CapabilityDecisionSchema,
  mw5CapabilityIntentSchema,
  mw5SourceDefinitionSchema,
  mw5VoiceConsentSchema,
  type AgentId,
  type Mw5AssetProvenance,
  type Mw5CapabilityDecision,
  type Mw5CapabilityIntent,
  type Mw5Operation,
  type Mw5SourceDefinition,
  type Mw5SourceId,
  type Mw5VoiceConsent,
  type ProjectAgentAssignment
} from '@tupiniquim/contracts'
import type { AgentProjectRepository } from './agent-project-runtime'
import type { AgentRegistryRuntime } from './agent-registry-runtime'
import { PolicyEngine } from './policy'

export interface Mw5CapabilityStateRepository {
  putProvenance(record: Mw5AssetProvenance): Promise<void>
  listProvenance(projectId: string): Promise<Mw5AssetProvenance[]>
  putVoiceConsent(record: Mw5VoiceConsent): Promise<void>
  getVoiceConsent(projectId: string, consentId: string): Promise<Mw5VoiceConsent | null>
}

export interface Mw5RuntimeAuditEvent {
  action: 'CONSENT_RECORD' | 'PROVENANCE_RECORD' | 'CAPABILITY_GATE'
  projectId: string
  agentId: AgentId
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR'
  detail: string
  at: string
}

export interface Mw5RuntimeAuditSink {
  write(event: Mw5RuntimeAuditEvent): Promise<void>
}

export interface Mw5SourceAvailability {
  OPEN_GENERATIVE_AI_READY?: boolean
  POCKET_TTS_LOCAL_READY?: boolean
  OPENREPLY_OFFICIAL_API_READY?: boolean
}

const sourceCatalog = (availability: Mw5SourceAvailability): Mw5SourceDefinition[] => [
  mw5SourceDefinitionSchema.parse({
    id: 'OPEN_GENERATIVE_AI',
    sourceRef: 'Anil-matcha/Open-Generative-AI',
    kind: 'MEDIA',
    operations: ['IMAGE_GENERATE', 'IMAGE_EDIT', 'VIDEO_GENERATE'],
    state: availability.OPEN_GENERATIVE_AI_READY === true ? 'READY' : 'REGISTERED_SOURCE',
    runtimeClass: 'CLOUD_CONTROL_PLANE',
    officialApiOnly: false,
    requiresConsent: false,
    detail: 'Principal capability source do Illustrator; providers/local engines permanecem configuração explícita.'
  }),
  mw5SourceDefinitionSchema.parse({
    id: 'GEMINI_VIDEO_PRESETS',
    sourceRef: 'internal:gemini-video-presets',
    kind: 'MEDIA',
    operations: ['VIDEO_GENERATE'],
    state: 'READY',
    runtimeClass: 'CLOUD_CONTROL_PLANE',
    officialApiOnly: false,
    requiresConsent: false,
    detail: 'Aliases internos de prompt; não são comandos oficiais nem configuram provider Gemini.'
  }),
  mw5SourceDefinitionSchema.parse({
    id: 'POCKET_TTS',
    sourceRef: 'kyutai-labs/pocket-tts',
    kind: 'VOICE',
    operations: ['TTS_GENERATE', 'VOICE_CLONE'],
    state: availability.POCKET_TTS_LOCAL_READY === true ? 'READY' : 'WINDOWS_DEFERRED',
    runtimeClass: 'LOCAL_RUNTIME',
    officialApiOnly: false,
    requiresConsent: true,
    detail: 'Source local de TTS/voice; execução física depende do ambiente local certificado.'
  }),
  mw5SourceDefinitionSchema.parse({
    id: 'OPENREPLY',
    sourceRef: 'diwenne/openreply',
    kind: 'SOCIAL',
    operations: ['SOCIAL_COMMENT_TO_DM'],
    state: availability.OPENREPLY_OFFICIAL_API_READY === true ? 'READY' : 'NOT_CONFIGURED',
    runtimeClass: 'EXTERNAL_SERVICE',
    officialApiOnly: true,
    requiresConsent: false,
    detail: 'Automação social somente via API oficial configurada; sem scraping/browser automation.'
  }),
  mw5SourceDefinitionSchema.parse({
    id: 'KIMI_K3_C',
    sourceRef: 'research:kimi-k3-in-c',
    kind: 'EXPERIMENTAL',
    operations: [],
    state: 'EXPERIMENTAL',
    runtimeClass: 'EXPERIMENTAL',
    officialApiOnly: false,
    requiresConsent: false,
    detail: 'Pesquisa experimental sem source canônica pinada e sem runtime authority.'
  })
]

const operationRules: Readonly<Record<Mw5Operation, { effect: 'asset:create' | 'asset:edit' | 'network:external-write'; canonical: 'asset.create' | 'asset.edit' | 'network.external-write'; inputProvenanceRequired: boolean }>> = {
  IMAGE_GENERATE: { effect: 'asset:create', canonical: 'asset.create', inputProvenanceRequired: false },
  IMAGE_EDIT: { effect: 'asset:edit', canonical: 'asset.edit', inputProvenanceRequired: true },
  VIDEO_GENERATE: { effect: 'asset:create', canonical: 'asset.create', inputProvenanceRequired: false },
  TTS_GENERATE: { effect: 'asset:create', canonical: 'asset.create', inputProvenanceRequired: false },
  VOICE_CLONE: { effect: 'asset:create', canonical: 'asset.create', inputProvenanceRequired: true },
  SOCIAL_COMMENT_TO_DM: { effect: 'network:external-write', canonical: 'network.external-write', inputProvenanceRequired: false }
}

export class Mw5CapabilityRuntime {
  private readonly sources: Map<Mw5SourceId, Mw5SourceDefinition>

  public constructor(
    private readonly registry: AgentRegistryRuntime,
    private readonly projectRepository: AgentProjectRepository,
    private readonly stateRepository: Mw5CapabilityStateRepository,
    availability: Mw5SourceAvailability = {},
    private readonly audit?: Mw5RuntimeAuditSink
  ) {
    this.sources = new Map(sourceCatalog(availability).map((source) => [source.id, source]))
  }

  public listSources(): Mw5SourceDefinition[] {
    return [...this.sources.values()].map((source) => structuredClone(source))
  }

  public async recordVoiceConsent(projectId: string, agentId: AgentId, subjectRef: string, evidenceRef: string): Promise<Mw5VoiceConsent> {
    await this.requireApprovedAssignment(projectId, agentId)
    const agent = this.registry.get(agentId)
    if (!agent.sources.includes('kyutai-labs/pocket-tts')) throw new Error('Agent não declara Pocket TTS como source de voz.')
    const record = mw5VoiceConsentSchema.parse({ id: randomUUID(), projectId, subjectRef, scope: 'VOICE_CLONE', evidenceRef, createdAt: new Date().toISOString(), revokedAt: null })
    await this.stateRepository.putVoiceConsent(record)
    await this.writeAudit('CONSENT_RECORD', projectId, agentId, 'SUCCESS', `Consentimento de voz registrado: ${record.id}.`)
    return record
  }

  public async recordProvenance(input: Omit<Mw5AssetProvenance, 'id' | 'createdAt'>): Promise<Mw5AssetProvenance> {
    await this.requireApprovedAssignment(input.projectId, input.agentId)
    const agent = this.registry.get(input.agentId)
    const source = this.requireSource(input.sourceId)
    if (!agent.sources.includes(source.sourceRef)) throw new Error('Source de provenance não pertence ao Agent aprovado.')
    if (!source.operations.includes(input.operation)) throw new Error('Operation não é suportada pela source declarada.')
    const record = mw5AssetProvenanceSchema.parse({ ...input, id: randomUUID(), createdAt: new Date().toISOString() })
    await this.stateRepository.putProvenance(record)
    await this.writeAudit('PROVENANCE_RECORD', input.projectId, input.agentId, 'SUCCESS', `Provenance registrada: ${record.id}.`)
    return record
  }

  public async listProjectProvenance(projectId: string): Promise<Mw5AssetProvenance[]> {
    return (await this.stateRepository.listProvenance(projectId)).map((record) => mw5AssetProvenanceSchema.parse(record))
  }

  public async gate(rawIntent: Mw5CapabilityIntent): Promise<Mw5CapabilityDecision> {
    const intent = mw5CapabilityIntentSchema.parse(rawIntent)
    await this.requireApprovedAssignment(intent.projectId, intent.agentId)
    const agent = this.registry.get(intent.agentId)
    const source = this.requireSource(intent.sourceId)
    const rule = operationRules[intent.operation]
    const sourceDeclaredByAgent = agent.sources.includes(source.sourceRef)
    const declaredByAgent = agent.effects.includes(rule.effect)
    const provenanceValidated = !rule.inputProvenanceRequired || intent.inputProvenanceRef !== null
    const officialApiValidated = !source.officialApiOnly || intent.officialApiConfirmed
    let consentValidated = !source.requiresConsent || intent.operation !== 'VOICE_CLONE'

    if (intent.operation === 'VOICE_CLONE') {
      if (intent.consentRef !== null) {
        const consent = await this.stateRepository.getVoiceConsent(intent.projectId, intent.consentRef)
        consentValidated = consent !== null && consent.revokedAt === null
      } else {
        consentValidated = false
      }
    }

    const deny = async (reason: string): Promise<Mw5CapabilityDecision> => {
      const decision = mw5CapabilityDecisionSchema.parse({
        projectId: intent.projectId,
        agentId: intent.agentId,
        operation: intent.operation,
        sourceId: intent.sourceId,
        sourceState: source.state,
        effect: rule.effect,
        canonicalCapability: rule.canonical,
        declaredByAgent,
        sourceDeclaredByAgent,
        policyAllowed: false,
        consentValidated,
        provenanceValidated,
        officialApiValidated,
        requiresApproval: false,
        runtimeExecutionAuthorized: false,
        reason
      })
      await this.writeAudit('CAPABILITY_GATE', intent.projectId, intent.agentId, 'DENIED', reason)
      return decision
    }

    if (source.state === 'EXPERIMENTAL') return await deny('Source experimental não possui runtime authority.')
    if (!sourceDeclaredByAgent) return await deny('Source não declarada pelo Agent aprovado.')
    if (!source.operations.includes(intent.operation)) return await deny('Operation não suportada pela source.')
    if (!declaredByAgent) return await deny('Effect mutável não declarado pelo Agent.')
    if (source.state === 'NOT_CONFIGURED') return await deny('Source externa não configurada explicitamente.')
    if (!provenanceValidated) return await deny('Operation exige provenance explícita do input.')
    if (!consentValidated) return await deny('Voice cloning exige consentimento ativo no mesmo projeto.')
    if (!officialApiValidated) return await deny('External write exige confirmação de API oficial.')
    if (source.officialApiOnly && !intent.requiresNetwork) return await deny('External write oficial precisa declarar uso de rede.')
    if (intent.sourceId === 'GEMINI_VIDEO_PRESETS' && intent.presetAlias === null) return await deny('Gemini video preset exige alias interno explícito.')

    const policy = new PolicyEngine(intent.permissionProfile).evaluate({
      capability: rule.canonical,
      target: intent.target,
      risk: intent.risk,
      destructive: intent.destructive,
      requiresNetwork: intent.requiresNetwork
    })

    const reason = policy.allowed
      ? `${policy.reason} MW5 autoriza somente proposta; ApprovalStore/PlanApprovalService e AuditLog continuam obrigatórios antes de qualquer efeito real.${source.state === 'WINDOWS_DEFERRED' ? ' Runtime local permanece WINDOWS_DEFERRED.' : ''}`
      : policy.reason

    const decision = mw5CapabilityDecisionSchema.parse({
      projectId: intent.projectId,
      agentId: intent.agentId,
      operation: intent.operation,
      sourceId: intent.sourceId,
      sourceState: source.state,
      effect: rule.effect,
      canonicalCapability: rule.canonical,
      declaredByAgent,
      sourceDeclaredByAgent,
      policyAllowed: policy.allowed,
      consentValidated,
      provenanceValidated,
      officialApiValidated,
      requiresApproval: policy.allowed,
      runtimeExecutionAuthorized: false,
      reason
    })
    await this.writeAudit('CAPABILITY_GATE', intent.projectId, intent.agentId, policy.allowed ? 'SUCCESS' : 'DENIED', reason)
    return decision
  }

  private requireSource(sourceId: Mw5SourceId): Mw5SourceDefinition {
    const source = this.sources.get(sourceId)
    if (source === undefined) throw new Error(`MW5 source desconhecida: ${sourceId}.`)
    return source
  }

  private async requireApprovedAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment> {
    this.registry.get(agentId)
    const assignment = await this.projectRepository.getAssignment(projectId, agentId)
    if (assignment === null || assignment.lifecycle !== 'APPROVED_FOR_PROJECT') throw new Error(`Agent ${agentId} não está aprovado para o projeto ${projectId}.`)
    return assignment
  }

  private async writeAudit(action: Mw5RuntimeAuditEvent['action'], projectId: string, agentId: AgentId, outcome: Mw5RuntimeAuditEvent['outcome'], detail: string): Promise<void> {
    if (this.audit === undefined) return
    await this.audit.write({ action, projectId, agentId, outcome, detail, at: new Date().toISOString() })
  }
}

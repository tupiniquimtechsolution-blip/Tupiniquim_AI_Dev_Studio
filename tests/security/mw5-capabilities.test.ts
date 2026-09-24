import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore, Mw5CapabilityJsonStore } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime, Mw5CapabilityRuntime } from '@tupiniquim/core'

let root = ''
let runtime: Mw5CapabilityRuntime
let registry: AgentRegistryRuntime

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-mw5-security-'))
  registry = AgentRegistryRuntime.fromJson(await readFile(path.resolve('.agent/AGENT_REGISTRY.json'), 'utf8'))
  const projects = new AgentProjectJsonStore(root)
  const assignments = new AgentProjectRuntime(registry, projects)
  for (const projectId of ['project-a', 'project-b']) {
    await assignments.approveForProject(projectId, 'AGENT-ILLUSTRATOR', `approval://${projectId}/illustrator`)
    await assignments.approveForProject(projectId, 'AGENT-VOICE', `approval://${projectId}/voice`)
    await assignments.approveForProject(projectId, 'AGENT-SOCIAL', `approval://${projectId}/social`)
  }
  runtime = new Mw5CapabilityRuntime(registry, projects, new Mw5CapabilityJsonStore(root), { OPENREPLY_OFFICIAL_API_READY: true })
})

afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe('MW5 security boundaries', () => {
  it('nega image edit sem provenance do input', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', operation: 'IMAGE_EDIT', sourceId: 'OPEN_GENERATIVE_AI', provider: 'explicit-provider', model: 'explicit-model', target: 'asset://edited.png', risk: 'LOW', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.provenanceValidated).toBe(false)
    expect(decision.policyAllowed).toBe(false)
  })

  it('nega voice clone sem consentimento explícito', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice.wav', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: null, inputProvenanceRef: 'asset://sample.wav', officialApiConfirmed: false })
    expect(decision.consentValidated).toBe(false)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
  })

  it('consentimento não cruza projetos', async () => {
    const consent = await runtime.recordVoiceConsent('project-a', 'AGENT-VOICE', 'subject://owner', 'evidence://signed')
    const decision = await runtime.gate({ projectId: 'project-b', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice.wav', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: consent.id, inputProvenanceRef: 'asset://sample.wav', officialApiConfirmed: false })
    expect(decision.consentValidated).toBe(false)
    expect(decision.policyAllowed).toBe(false)
  })

  it('nega social external write sem confirmação de API oficial', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-SOCIAL', operation: 'SOCIAL_COMMENT_TO_DM', sourceId: 'OPENREPLY', provider: 'meta', model: null, target: 'instagram://campaign', risk: 'HIGH', destructive: false, requiresNetwork: true, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.officialApiValidated).toBe(false)
    expect(decision.policyAllowed).toBe(false)
  })

  it('nega social external write que tenta ocultar uso de rede', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-SOCIAL', operation: 'SOCIAL_COMMENT_TO_DM', sourceId: 'OPENREPLY', provider: 'meta', model: null, target: 'instagram://campaign', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: true })
    expect(decision.policyAllowed).toBe(false)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
  })

  it('FULL_ACCESS nunca transforma MW5 proposal em execução direta', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-SOCIAL', operation: 'SOCIAL_COMMENT_TO_DM', sourceId: 'OPENREPLY', provider: 'meta', model: null, target: 'instagram://campaign', risk: 'LOW', destructive: false, requiresNetwork: true, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: true })
    expect(decision.policyAllowed).toBe(true)
    expect(decision.requiresApproval).toBe(true)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
  })

  it('source experimental jamais recebe runtime authority', async () => {
    const decision = await runtime.gate({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', operation: 'IMAGE_GENERATE', sourceId: 'KIMI_K3_C', provider: null, model: null, target: 'asset://experimental', risk: 'LOW', destructive: false, requiresNetwork: false, permissionProfile: 'FULL_ACCESS', presetAlias: null, consentRef: null, inputProvenanceRef: null, officialApiConfirmed: false })
    expect(decision.sourceState).toBe('EXPERIMENTAL')
    expect(decision.policyAllowed).toBe(false)
    expect(decision.runtimeExecutionAuthorized).toBe(false)
  })
})

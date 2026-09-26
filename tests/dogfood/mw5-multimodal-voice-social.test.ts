import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore, Mw5CapabilityJsonStore } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime, Mw5CapabilityRuntime, resolveGeminiVideoPreset } from '@tupiniquim/core'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true }))) })

describe('MW5 controlled dogfood — multimodal, voice and social', () => {
  it('prova presets/provenance/consent/social gates e restart sem executar efeitos externos', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-mw5-dogfood-'))
    roots.push(root)
    const registry = AgentRegistryRuntime.fromJson(await readFile(path.resolve('.agent/AGENT_REGISTRY.json'), 'utf8'))
    const projects = new AgentProjectJsonStore(root)
    const agentRuntime = new AgentProjectRuntime(registry, projects)

    await agentRuntime.approveForProject('project-mw5', 'AGENT-ILLUSTRATOR', 'approval://mw5/illustrator')
    await agentRuntime.approveForProject('project-mw5', 'AGENT-VOICE', 'approval://mw5/voice')
    await agentRuntime.approveForProject('project-mw5', 'AGENT-SOCIAL', 'approval://mw5/social')

    const state = new Mw5CapabilityJsonStore(root)
    const runtime = new Mw5CapabilityRuntime(registry, projects, state, { OPENREPLY_OFFICIAL_API_READY: true })

    const preset = resolveGeminiVideoPreset('/reveal Tupiniquim product')
    expect(preset).not.toBeNull()
    expect(preset?.preset.officialGeminiCommand).toBe(false)
    expect(preset?.preset.alias).toBe('/reveal')
    expect(preset?.expandedPrompt).toContain('Tupiniquim product')

    const mediaDecision = await runtime.gate({
      projectId: 'project-mw5',
      agentId: 'AGENT-ILLUSTRATOR',
      operation: 'VIDEO_GENERATE',
      sourceId: 'GEMINI_VIDEO_PRESETS',
      provider: null,
      model: null,
      target: 'asset://mw5/reveal.mp4',
      risk: 'LOW',
      destructive: false,
      requiresNetwork: false,
      permissionProfile: 'ASSISTED',
      presetAlias: '/reveal',
      consentRef: null,
      inputProvenanceRef: null,
      officialApiConfirmed: false
    })
    expect(mediaDecision.policyAllowed).toBe(true)
    expect(mediaDecision.requiresApproval).toBe(true)
    expect(mediaDecision.runtimeExecutionAuthorized).toBe(false)

    const provenance = await runtime.recordProvenance({
      projectId: 'project-mw5',
      agentId: 'AGENT-ILLUSTRATOR',
      sourceId: 'GEMINI_VIDEO_PRESETS',
      operation: 'VIDEO_GENERATE',
      provider: null,
      model: null,
      presetAlias: '/reveal',
      inputAssetRefs: [],
      outputAssetRef: 'asset://mw5/reveal.mp4',
      licenseRef: 'license://project-owned'
    })

    const consent = await runtime.recordVoiceConsent('project-mw5', 'AGENT-VOICE', 'subject://owner', 'evidence://voice-consent')
    const voiceDecision = await runtime.gate({
      projectId: 'project-mw5',
      agentId: 'AGENT-VOICE',
      operation: 'VOICE_CLONE',
      sourceId: 'POCKET_TTS',
      provider: 'pocket-tts-local',
      model: null,
      target: 'asset://mw5/voice.wav',
      risk: 'HIGH',
      destructive: false,
      requiresNetwork: false,
      permissionProfile: 'ASSISTED',
      presetAlias: null,
      consentRef: consent.id,
      inputProvenanceRef: 'asset://mw5/voice-sample.wav',
      officialApiConfirmed: false
    })
    expect(voiceDecision.sourceState).toBe('WINDOWS_DEFERRED')
    expect(voiceDecision.consentValidated).toBe(true)
    expect(voiceDecision.policyAllowed).toBe(true)
    expect(voiceDecision.runtimeExecutionAuthorized).toBe(false)

    const socialDecision = await runtime.gate({
      projectId: 'project-mw5',
      agentId: 'AGENT-SOCIAL',
      operation: 'SOCIAL_COMMENT_TO_DM',
      sourceId: 'OPENREPLY',
      provider: 'meta',
      model: null,
      target: 'instagram://campaign/mw5',
      risk: 'HIGH',
      destructive: false,
      requiresNetwork: true,
      permissionProfile: 'ASSISTED',
      presetAlias: null,
      consentRef: null,
      inputProvenanceRef: null,
      officialApiConfirmed: true
    })
    expect(socialDecision.officialApiValidated).toBe(true)
    expect(socialDecision.policyAllowed).toBe(true)
    expect(socialDecision.requiresApproval).toBe(true)
    expect(socialDecision.runtimeExecutionAuthorized).toBe(false)

    const restarted = new Mw5CapabilityRuntime(registry, new AgentProjectJsonStore(root), new Mw5CapabilityJsonStore(root), { OPENREPLY_OFFICIAL_API_READY: true })
    expect((await restarted.listProjectProvenance('project-mw5')).map((record) => record.id)).toContain(provenance.id)
  })
})

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentProjectJsonStore, Mw5CapabilityJsonStore } from '@tupiniquim/adapters'
import { AgentProjectRuntime, AgentRegistryRuntime, Mw5CapabilityRuntime } from '@tupiniquim/core'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true }))) })

describe('MW5 capability persistence', () => {
  it('preserva provenance/consent após restart e mantém isolamento por projeto', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tupiniquim-mw5-'))
    roots.push(root)
    const registry = AgentRegistryRuntime.fromJson(await readFile(path.resolve('.agent/AGENT_REGISTRY.json'), 'utf8'))
    const projects = new AgentProjectJsonStore(root)
    const projectRuntime = new AgentProjectRuntime(registry, projects)
    await projectRuntime.approveForProject('project-a', 'AGENT-ILLUSTRATOR', 'approval://illustrator')
    await projectRuntime.approveForProject('project-a', 'AGENT-VOICE', 'approval://voice')
    await projectRuntime.approveForProject('project-a', 'AGENT-SOCIAL', 'approval://social')
    await projectRuntime.approveForProject('project-b', 'AGENT-VOICE', 'approval://voice-b')

    const firstState = new Mw5CapabilityJsonStore(root)
    const first = new Mw5CapabilityRuntime(registry, projects, firstState, { OPENREPLY_OFFICIAL_API_READY: true })
    const consent = await first.recordVoiceConsent('project-a', 'AGENT-VOICE', 'subject://owner', 'evidence://signed')
    const provenance = await first.recordProvenance({ projectId: 'project-a', agentId: 'AGENT-ILLUSTRATOR', sourceId: 'OPEN_GENERATIVE_AI', operation: 'IMAGE_GENERATE', provider: 'explicit-provider', model: 'explicit-model', presetAlias: null, inputAssetRefs: [], outputAssetRef: 'asset://hero.png', licenseRef: 'license://project-a' })

    const restartedState = new Mw5CapabilityJsonStore(root)
    const restarted = new Mw5CapabilityRuntime(registry, new AgentProjectJsonStore(root), restartedState, { OPENREPLY_OFFICIAL_API_READY: true })
    expect((await restarted.listProjectProvenance('project-a')).map((item) => item.id)).toEqual([provenance.id])
    expect(await restarted.listProjectProvenance('project-b')).toEqual([])

    const voice = await restarted.gate({ projectId: 'project-a', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice.wav', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: consent.id, inputProvenanceRef: 'asset://voice-sample.wav', officialApiConfirmed: false })
    expect(voice.consentValidated).toBe(true)
    expect(voice.policyAllowed).toBe(true)
    expect(voice.runtimeExecutionAuthorized).toBe(false)

    const crossProject = await restarted.gate({ projectId: 'project-b', agentId: 'AGENT-VOICE', operation: 'VOICE_CLONE', sourceId: 'POCKET_TTS', provider: 'pocket-tts-local', model: null, target: 'asset://voice-b.wav', risk: 'HIGH', destructive: false, requiresNetwork: false, permissionProfile: 'ASSISTED', presetAlias: null, consentRef: consent.id, inputProvenanceRef: 'asset://voice-sample.wav', officialApiConfirmed: false })
    expect(crossProject.consentValidated).toBe(false)
    expect(crossProject.policyAllowed).toBe(false)
  })
})

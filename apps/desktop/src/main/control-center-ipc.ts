import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import {
  agentLoadoutPutInputSchema,
  controlCenterIpcChannels,
  err,
  ok,
  portableInspectInputSchema,
  projectIdInputSchema,
  skillSetEnabledInputSchema,
  toolboxRunInputSchema,
  toAppError,
  type AgentCatalogView,
  type AgentLoadoutView,
  type SkillControlView
} from '@tupiniquim/contracts'
import { inspectPortableLayout, runToolboxGate, type ToolboxPnpmInvocation } from '@tupiniquim/core'

const execFileAsync = promisify(execFile)
const INTERNAL_SKILL_ID = 'tupiniquim-toolbox' as const

interface SkillStateFile { projects: Record<string, string[]> }
interface AgentLoadoutStateFile { projects: Record<string, AgentLoadoutView[]> }

const agentCatalog: AgentCatalogView[] = [
  { id: 'AGENT-PLANNER', name: 'Master Planner', capabilities: ['planning', 'dependency-mapping', 'handoff', 'prioritization', 'validation'], effects: [] },
  { id: 'AGENT-RESEARCH', name: 'Researcher', capabilities: ['web-research', 'source-analysis', 'technology-research', 'evidence-synthesis'], effects: [] },
  { id: 'AGENT-ILLUSTRATOR', name: 'Illustrator / Media Agent', capabilities: ['image-generation', 'image-editing', 'video-generation', 'media-workflows'], effects: ['asset:create', 'asset:edit'] },
  { id: 'AGENT-UX', name: 'UI/UX Designer', capabilities: ['ui-ux', 'design-system', 'animation-review', 'responsive-design', 'design-guidelines'], effects: [] },
  { id: 'AGENT-PROMPT', name: 'Prompt Architect', capabilities: ['prompt-generation', 'prompt-review', 'prompt-adaptation', 'tool-routing'], effects: [] },
  { id: 'AGENT-TOOLS', name: 'Tool / CLI Integrator', capabilities: ['cli-discovery', 'agent-native-cli', 'software-tooling', 'environment-patterns'], effects: ['workspace:write', 'process:execute'] },
  { id: 'AGENT-VOICE', name: 'Voice / TTS Agent', capabilities: ['local-tts', 'streaming-audio', 'multilingual-voice', 'voice-cloning-with-consent'], effects: ['asset:create'] },
  { id: 'AGENT-SOCIAL', name: 'Social Automation Agent', capabilities: ['instagram-comment-to-dm', 'webhooks', 'keyword-routing', 'social-automation'], effects: ['network:external-write'] },
  { id: 'AGENT-KNOWLEDGE', name: 'Knowledge / RAG Agent', capabilities: ['rag', 'hybrid-search', 'knowledge-graph', 'citations', 'context-retrieval'], effects: [] },
  { id: 'AGENT-TRUST-QA', name: 'Trust / QA Reviewer', capabilities: ['review', 'quality-gates', 'security-gate', 'evidence', 'approval-validation'], effects: [] },
  { id: 'AGENT-CODER', name: 'Coding Worker', capabilities: ['code', 'test', 'fix', 'refactor'], effects: ['workspace:write'] }
]

const readJsonObject = async (filePath: string): Promise<unknown> => {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as unknown } catch { return null }
}

const atomicWriteJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, filePath)
}

const readSkillState = async (filePath: string): Promise<SkillStateFile> => {
  const parsed = await readJsonObject(filePath)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { projects: {} }
  const projects = (parsed as { projects?: unknown }).projects
  if (typeof projects !== 'object' || projects === null || Array.isArray(projects)) return { projects: {} }
  const result: Record<string, string[]> = {}
  for (const [projectId, skillIds] of Object.entries(projects)) {
    if (Array.isArray(skillIds)) result[projectId] = skillIds.filter((item): item is string => typeof item === 'string')
  }
  return { projects: result }
}

const readLoadoutState = async (filePath: string): Promise<AgentLoadoutStateFile> => {
  const parsed = await readJsonObject(filePath)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { projects: {} }
  const projects = (parsed as { projects?: unknown }).projects
  if (typeof projects !== 'object' || projects === null || Array.isArray(projects)) return { projects: {} }
  const result: Record<string, AgentLoadoutView[]> = {}
  for (const [projectId, value] of Object.entries(projects)) {
    if (!Array.isArray(value)) continue
    result[projectId] = value.flatMap((candidate): AgentLoadoutView[] => {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return []
      const item = candidate as Partial<AgentLoadoutView>
      if (item.projectId !== projectId || typeof item.agentId !== 'string') return []
      if (item.provider !== 'codex-app-server' && item.provider !== 'ollama') return []
      if (item.permissionProfile !== 'READ_ONLY' && item.permissionProfile !== 'ASSISTED' && item.permissionProfile !== 'FULL_ACCESS') return []
      if (!Array.isArray(item.skillIds) || !item.skillIds.every((skillId) => typeof skillId === 'string')) return []
      return [{
        projectId,
        agentId: item.agentId,
        provider: item.provider,
        model: typeof item.model === 'string' ? item.model : null,
        skillIds: item.skillIds,
        permissionProfile: item.permissionProfile,
        runtimeExecutionAuthorized: false
      }]
    })
  }
  return { projects: result }
}

const skillView = (enabled: boolean): SkillControlView => ({
  id: INTERNAL_SKILL_ID,
  name: 'Tupiniquim Toolbox',
  status: 'APPROVED_INTERNAL',
  enabled,
  runtimeExecutionAuthorized: false
})

export const registerControlCenterIpc = (input: {
  dataRoot: string
  getWorkspaceRoot: () => string | null
}): void => {
  const skillStatePath = path.join(input.dataRoot, 'control-center', 'project-skills.json')
  const loadoutStatePath = path.join(input.dataRoot, 'control-center', 'agent-loadouts.json')

  ipcMain.handle(controlCenterIpcChannels.status, () => ok({
    product: 'Tupiniquim Dev AI' as const,
    sections: [
      { id: 'models-providers', label: 'Modelos & Providers' },
      { id: 'skills', label: 'Skills' },
      { id: 'toolbox', label: 'Toolbox' },
      { id: 'ai-lab', label: 'AI Lab' },
      { id: 'agents', label: 'Agentes' },
      { id: 'security-quality', label: 'Segurança & Qualidade' }
    ],
    policy: {
      explicitProviderSelection: true as const,
      explicitModelSelection: true as const,
      automaticFallback: false as const,
      privilegedActionsDefaultDeny: true as const
    }
  }))

  ipcMain.handle(controlCenterIpcChannels.portableInspect, (_event, raw: unknown) => {
    try {
      const { root } = portableInspectInputSchema.parse(raw)
      const layout = inspectPortableLayout(root)
      return ok({
        root: layout.root,
        directories: layout.directories,
        runtimes: layout.runtimes.map(({ id, label, available, state }) => ({ id, label, available, state }))
      })
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_PORTABLE_INSPECT') }
    }
  })

  ipcMain.handle(controlCenterIpcChannels.toolboxRun, async (_event, raw: unknown) => {
    try {
      const { gateId } = toolboxRunInputSchema.parse(raw)
      const cwd = input.getWorkspaceRoot()
      if (cwd === null) return err('WORKSPACE_REQUIRED', 'Abra um workspace antes de executar gates do Toolbox.')
      const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
      const result = await runToolboxGate(gateId, {
        execute: async (invocation: ToolboxPnpmInvocation) => {
          try {
            const { stdout, stderr } = await execFileAsync(pnpm, [invocation.scriptOrCommand, ...invocation.args], {
              cwd,
              windowsHide: true,
              timeout: 15 * 60 * 1000,
              maxBuffer: 10 * 1024 * 1024,
              env: { ...process.env }
            })
            return { exitCode: 0, stdout, stderr }
          } catch (cause) {
            const failure = cause as { code?: number | string; stdout?: string; stderr?: string }
            return {
              exitCode: typeof failure.code === 'number' ? failure.code : 1,
              stdout: failure.stdout ?? '',
              stderr: failure.stderr ?? 'Toolbox invocation failed.'
            }
          }
        }
      })
      return ok({ gateId: result.gateId, state: result.state, evidence: result.evidence })
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_TOOLBOX') }
    }
  })

  ipcMain.handle(controlCenterIpcChannels.skills, async (_event, raw: unknown) => {
    try {
      const { projectId } = projectIdInputSchema.parse(raw)
      const state = await readSkillState(skillStatePath)
      return ok([skillView(state.projects[projectId]?.includes(INTERNAL_SKILL_ID) ?? false)])
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_SKILLS') }
    }
  })

  ipcMain.handle(controlCenterIpcChannels.skillSetEnabled, async (_event, raw: unknown) => {
    try {
      const { projectId, skillId, enabled } = skillSetEnabledInputSchema.parse(raw)
      if (skillId !== INTERNAL_SKILL_ID) return err('SKILL_NOT_APPROVED', 'Somente skills auditadas e aprovadas podem ser habilitadas.')
      const state = await readSkillState(skillStatePath)
      const current = new Set(state.projects[projectId] ?? [])
      if (enabled) current.add(INTERNAL_SKILL_ID)
      else current.delete(INTERNAL_SKILL_ID)
      state.projects[projectId] = [...current].sort()
      await atomicWriteJson(skillStatePath, state)
      return ok(skillView(enabled))
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_SKILL_ENABLEMENT') }
    }
  })

  ipcMain.handle(controlCenterIpcChannels.agentCatalog, () => ok(agentCatalog))

  ipcMain.handle(controlCenterIpcChannels.agentLoadouts, async (_event, raw: unknown) => {
    try {
      const { projectId } = projectIdInputSchema.parse(raw)
      const state = await readLoadoutState(loadoutStatePath)
      return ok(state.projects[projectId] ?? [])
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_AGENT_LOADOUTS') }
    }
  })

  ipcMain.handle(controlCenterIpcChannels.agentLoadoutPut, async (_event, raw: unknown) => {
    try {
      const parsed = agentLoadoutPutInputSchema.parse(raw)
      if (!agentCatalog.some((agent) => agent.id === parsed.agentId)) return err('AGENT_NOT_REGISTERED', 'O agente não está registrado no catálogo canônico.')
      if (parsed.provider === 'ollama' && parsed.model === null) return err('MODEL_REQUIRED', 'Loadout Ollama exige modelo explícito.')
      if (parsed.provider === 'codex-app-server' && parsed.model !== null) return err('MODEL_INVALID', 'Loadout Codex não pode embutir modelo Ollama.')

      const skills = await readSkillState(skillStatePath)
      const enabledSkills = new Set(skills.projects[parsed.projectId] ?? [])
      for (const skillId of parsed.skillIds) {
        if (!enabledSkills.has(skillId)) return err('SKILL_NOT_ENABLED', `A skill ${skillId} não está habilitada para este projeto.`)
      }

      const state = await readLoadoutState(loadoutStatePath)
      const current = state.projects[parsed.projectId] ?? []
      const view: AgentLoadoutView = {
        projectId: parsed.projectId,
        agentId: parsed.agentId,
        provider: parsed.provider,
        model: parsed.model,
        skillIds: [...new Set(parsed.skillIds)].sort(),
        permissionProfile: parsed.permissionProfile,
        runtimeExecutionAuthorized: false
      }
      state.projects[parsed.projectId] = [...current.filter((item) => item.agentId !== parsed.agentId), view].sort((a, b) => a.agentId.localeCompare(b.agentId))
      await atomicWriteJson(loadoutStatePath, state)
      return ok(view)
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_AGENT_LOADOUT_PUT') }
    }
  })
}

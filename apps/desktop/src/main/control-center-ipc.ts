import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import {
  controlCenterIpcChannels,
  err,
  ok,
  portableInspectInputSchema,
  projectIdInputSchema,
  skillSetEnabledInputSchema,
  toolboxRunInputSchema,
  toAppError,
  type SkillControlView
} from '@tupiniquim/contracts'
import { inspectPortableLayout, runToolboxGate, type ToolboxPnpmInvocation } from '@tupiniquim/core'

const execFileAsync = promisify(execFile)
const INTERNAL_SKILL_ID = 'tupiniquim-toolbox' as const

interface SkillStateFile { projects: Record<string, string[]> }

const readSkillState = async (filePath: string): Promise<SkillStateFile> => {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { projects: {} }
    const projects = (parsed as { projects?: unknown }).projects
    if (typeof projects !== 'object' || projects === null || Array.isArray(projects)) return { projects: {} }
    const result: Record<string, string[]> = {}
    for (const [projectId, skillIds] of Object.entries(projects)) {
      if (Array.isArray(skillIds)) result[projectId] = skillIds.filter((item): item is string => typeof item === 'string')
    }
    return { projects: result }
  } catch {
    return { projects: {} }
  }
}

const writeSkillState = async (filePath: string, state: SkillStateFile): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.tmp`
  await writeFile(temp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, filePath)
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
      await writeSkillState(skillStatePath, state)
      return ok(skillView(enabled))
    } catch (cause) {
      return { ok: false as const, error: toAppError(cause, 'CONTROL_CENTER_SKILL_ENABLEMENT') }
    }
  })
}

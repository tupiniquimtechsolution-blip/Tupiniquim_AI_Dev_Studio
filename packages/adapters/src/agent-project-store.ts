import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  projectAgentAssignmentSchema,
  projectAgentTeamSchema,
  projectAgentThreadBindingSchema,
  type AgentId,
  type AIProviderKind,
  type ProjectAgentAssignment,
  type ProjectAgentTeam,
  type ProjectAgentThreadBinding
} from '@tupiniquim/contracts'
import type { AgentProjectRepository } from '@tupiniquim/core'

const persistedAgentProjectStateSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  assignments: z.array(projectAgentAssignmentSchema),
  bindings: z.array(projectAgentThreadBindingSchema),
  teams: z.array(projectAgentTeamSchema)
}).strict()
type PersistedAgentProjectState = z.infer<typeof persistedAgentProjectStateSchema>

const emptyState = (): PersistedAgentProjectState => ({ schemaVersion: '1.0.0', assignments: [], bindings: [], teams: [] })

export class AgentProjectJsonStore implements AgentProjectRepository {
  private readonly file: string
  private state: PersistedAgentProjectState | null = null
  private operation: Promise<void> = Promise.resolve()

  public constructor(dataRoot: string) {
    this.file = path.join(dataRoot, 'agent-runtime', 'project-state.json')
  }

  public async putAssignment(assignment: ProjectAgentAssignment): Promise<void> {
    await this.withWrite((state) => {
      const parsed = projectAgentAssignmentSchema.parse(assignment)
      state.assignments = state.assignments.filter((item) => !(item.projectId === parsed.projectId && item.agentId === parsed.agentId))
      state.assignments.push(parsed)
    })
  }

  public async getAssignment(projectId: string, agentId: AgentId): Promise<ProjectAgentAssignment | null> {
    const state = await this.readState()
    return structuredClone(state.assignments.find((item) => item.projectId === projectId && item.agentId === agentId) ?? null)
  }

  public async listAssignments(projectId: string): Promise<ProjectAgentAssignment[]> {
    const state = await this.readState()
    return structuredClone(state.assignments.filter((item) => item.projectId === projectId))
  }

  public async putThreadBinding(binding: ProjectAgentThreadBinding): Promise<void> {
    await this.withWrite((state) => {
      const parsed = projectAgentThreadBindingSchema.parse(binding)
      const conflicting = state.bindings.find((item) => item.threadId === parsed.threadId && (item.projectId !== parsed.projectId || item.agentId !== parsed.agentId || item.provider !== parsed.provider))
      if (conflicting !== undefined) throw new Error('Thread já pertence a outro project/agent/provider.')
      state.bindings = state.bindings.filter((item) => !(item.projectId === parsed.projectId && item.agentId === parsed.agentId && item.provider === parsed.provider))
      state.bindings.push(parsed)
    })
  }

  public async getThreadBinding(projectId: string, agentId: AgentId, provider: AIProviderKind): Promise<ProjectAgentThreadBinding | null> {
    const state = await this.readState()
    return structuredClone(state.bindings.find((item) => item.projectId === projectId && item.agentId === agentId && item.provider === provider) ?? null)
  }

  public async findThreadBinding(threadId: string): Promise<ProjectAgentThreadBinding | null> {
    const state = await this.readState()
    return structuredClone(state.bindings.find((item) => item.threadId === threadId) ?? null)
  }

  public async putTeam(team: ProjectAgentTeam): Promise<void> {
    await this.withWrite((state) => {
      const parsed = projectAgentTeamSchema.parse(team)
      const conflicting = state.teams.find((item) => item.id === parsed.id && item.projectId !== parsed.projectId)
      if (conflicting !== undefined) throw new Error('Team id já pertence a outro projeto.')
      state.teams = state.teams.filter((item) => item.id !== parsed.id)
      state.teams.push(parsed)
    })
  }

  public async listTeams(projectId: string): Promise<ProjectAgentTeam[]> {
    const state = await this.readState()
    return structuredClone(state.teams.filter((item) => item.projectId === projectId))
  }

  private async readState(): Promise<PersistedAgentProjectState> {
    await this.operation
    return await this.readStateUnlocked()
  }

  private async withWrite(mutator: (state: PersistedAgentProjectState) => void): Promise<void> {
    const preceding = this.operation
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    this.operation = gate
    await preceding
    try {
      const current = structuredClone(await this.readStateUnlocked())
      mutator(current)
      const parsed = persistedAgentProjectStateSchema.parse(current)
      await mkdir(path.dirname(this.file), { recursive: true })
      const temp = `${this.file}.${randomUUID()}.tmp`
      await writeFile(temp, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: 'utf8' })
      await rename(temp, this.file)
      this.state = parsed
    } finally {
      release()
    }
  }

  private async readStateUnlocked(): Promise<PersistedAgentProjectState> {
    if (this.state !== null) return this.state
    try {
      const raw = await readFile(this.file, 'utf8')
      this.state = persistedAgentProjectStateSchema.parse(JSON.parse(raw) as unknown)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
      this.state = emptyState()
    }
    return this.state
  }
}

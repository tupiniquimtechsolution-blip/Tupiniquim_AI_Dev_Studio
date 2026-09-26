import { agentRegistryDocumentSchema, type AgentDefinition, type AgentId, type AgentRegistryDocument } from '@tupiniquim/contracts'

export class AgentRegistryRuntime {
  private readonly document: AgentRegistryDocument
  private readonly agents = new Map<AgentId, AgentDefinition>()

  public constructor(rawRegistry: unknown) {
    this.document = agentRegistryDocumentSchema.parse(rawRegistry)
    for (const agent of this.document.agents) this.agents.set(agent.id, agent)
  }

  public static fromJson(serialized: string): AgentRegistryRuntime {
    return new AgentRegistryRuntime(JSON.parse(serialized) as unknown)
  }

  public schemaVersion(): string { return this.document.schemaVersion }

  public snapshot(): AgentRegistryDocument {
    return structuredClone(this.document)
  }

  public list(): AgentDefinition[] {
    return [...this.agents.values()].map((agent) => structuredClone(agent))
  }

  public get(agentId: AgentId): AgentDefinition {
    const agent = this.agents.get(agentId)
    if (agent === undefined) throw new Error(`Agent não registrado: ${agentId}.`)
    return structuredClone(agent)
  }

  public has(agentId: AgentId): boolean { return this.agents.has(agentId) }

  public assertCapability(agentId: AgentId, capability: string): AgentDefinition {
    const agent = this.get(agentId)
    if (!agent.capabilities.includes(capability)) throw new Error(`Capability não declarada pelo Agent ${agentId}: ${capability}.`)
    return agent
  }

  public assertEffect(agentId: AgentId, effect: string): AgentDefinition {
    const agent = this.get(agentId)
    if (!agent.effects.includes(effect)) throw new Error(`Efeito não declarado pelo Agent ${agentId}: ${effect}.`)
    return agent
  }
}

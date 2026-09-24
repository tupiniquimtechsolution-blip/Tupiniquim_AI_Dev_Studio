import { randomUUID } from 'node:crypto'
import type { AgentRuntimeAuditEvent, AgentRuntimeAuditSink } from '@tupiniquim/core'
import { AuditLog } from './audit-log'

export class AgentRuntimeAuditAdapter implements AgentRuntimeAuditSink {
  public constructor(private readonly audit: AuditLog) {}

  public async write(event: AgentRuntimeAuditEvent): Promise<void> {
    await this.audit.write({
      requestId: randomUUID(),
      at: event.at,
      capability: `agent-runtime.${event.action.toLowerCase()}`,
      outcome: event.outcome,
      target: `${event.projectId}:${event.agentId}`,
      durationMs: 0,
      ...(event.outcome === 'ERROR' ? { errorCode: 'AGENT_RUNTIME_ERROR' } : {})
    })
  }
}

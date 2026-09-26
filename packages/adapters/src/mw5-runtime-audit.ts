import { randomUUID } from 'node:crypto'
import type { Mw5RuntimeAuditEvent, Mw5RuntimeAuditSink } from '@tupiniquim/core'
import type { AuditLog } from './audit-log'

export class Mw5RuntimeAuditAdapter implements Mw5RuntimeAuditSink {
  public constructor(private readonly audit: AuditLog) {}

  public async write(event: Mw5RuntimeAuditEvent): Promise<void> {
    await this.audit.write({
      requestId: randomUUID(),
      at: event.at,
      capability: `mw5-runtime.${event.action.toLowerCase()}`,
      outcome: event.outcome,
      target: `${event.projectId}:${event.agentId}`,
      durationMs: 0,
      ...(event.outcome === 'ERROR' ? { errorCode: 'MW5_RUNTIME_ERROR' } : {})
    })
  }
}

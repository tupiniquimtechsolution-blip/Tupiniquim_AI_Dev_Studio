import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export interface AuditRecord {
  requestId: string
  at: string
  capability: string
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR'
  target?: string
  durationMs: number
  errorCode?: string
}
export class AuditLog {
  private readonly file: string

  public constructor(dataRoot: string) {
    this.file = path.join(dataRoot, 'logs', 'audit.jsonl')
  }

  public async write(record: AuditRecord): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true })
    await appendFile(this.file, `${JSON.stringify(record)}\n`, { encoding: 'utf8' })
  }
}

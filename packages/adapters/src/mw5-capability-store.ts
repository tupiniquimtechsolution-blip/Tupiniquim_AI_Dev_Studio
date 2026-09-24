import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  mw5AssetProvenanceSchema,
  mw5VoiceConsentSchema,
  type Mw5AssetProvenance,
  type Mw5VoiceConsent
} from '@tupiniquim/contracts'
import type { Mw5CapabilityStateRepository } from '@tupiniquim/core'

const persistedMw5StateSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  provenance: z.array(mw5AssetProvenanceSchema),
  voiceConsents: z.array(mw5VoiceConsentSchema)
}).strict()
type PersistedMw5State = z.infer<typeof persistedMw5StateSchema>

const emptyState = (): PersistedMw5State => ({ schemaVersion: '1.0.0', provenance: [], voiceConsents: [] })

export class Mw5CapabilityJsonStore implements Mw5CapabilityStateRepository {
  private readonly file: string
  private state: PersistedMw5State | null = null
  private operation: Promise<void> = Promise.resolve()

  public constructor(dataRoot: string) {
    this.file = path.join(dataRoot, 'mw5-runtime', 'state.json')
  }

  public async putProvenance(record: Mw5AssetProvenance): Promise<void> {
    await this.withWrite((state) => {
      const parsed = mw5AssetProvenanceSchema.parse(record)
      const conflict = state.provenance.find((item) => item.id === parsed.id && item.projectId !== parsed.projectId)
      if (conflict !== undefined) throw new Error('Provenance id já pertence a outro projeto.')
      state.provenance = state.provenance.filter((item) => item.id !== parsed.id)
      state.provenance.push(parsed)
    })
  }

  public async listProvenance(projectId: string): Promise<Mw5AssetProvenance[]> {
    const state = await this.readState()
    return structuredClone(state.provenance.filter((item) => item.projectId === projectId))
  }

  public async putVoiceConsent(record: Mw5VoiceConsent): Promise<void> {
    await this.withWrite((state) => {
      const parsed = mw5VoiceConsentSchema.parse(record)
      const conflict = state.voiceConsents.find((item) => item.id === parsed.id && item.projectId !== parsed.projectId)
      if (conflict !== undefined) throw new Error('Consent id já pertence a outro projeto.')
      state.voiceConsents = state.voiceConsents.filter((item) => item.id !== parsed.id)
      state.voiceConsents.push(parsed)
    })
  }

  public async getVoiceConsent(projectId: string, consentId: string): Promise<Mw5VoiceConsent | null> {
    const state = await this.readState()
    return structuredClone(state.voiceConsents.find((item) => item.projectId === projectId && item.id === consentId) ?? null)
  }

  private async readState(): Promise<PersistedMw5State> {
    await this.operation
    return await this.readStateUnlocked()
  }

  private async withWrite(mutator: (state: PersistedMw5State) => void): Promise<void> {
    const preceding = this.operation
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    this.operation = gate
    await preceding
    try {
      const current = structuredClone(await this.readStateUnlocked())
      mutator(current)
      const parsed = persistedMw5StateSchema.parse(current)
      await mkdir(path.dirname(this.file), { recursive: true })
      const temp = `${this.file}.${randomUUID()}.tmp`
      await writeFile(temp, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: 'utf8' })
      await rename(temp, this.file)
      this.state = parsed
    } finally {
      release()
    }
  }

  private async readStateUnlocked(): Promise<PersistedMw5State> {
    if (this.state !== null) return this.state
    try {
      const raw = await readFile(this.file, 'utf8')
      this.state = persistedMw5StateSchema.parse(JSON.parse(raw) as unknown)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
      this.state = emptyState()
    }
    return this.state
  }
}

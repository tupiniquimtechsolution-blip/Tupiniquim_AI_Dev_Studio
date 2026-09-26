import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { aiProviderKindSchema } from '@tupiniquim/contracts'

const schema = z.object({
  provider: aiProviderKindSchema,
  model: z.string().min(1).max(300).nullable()
}).strict()
export type ProviderPreferences = z.infer<typeof schema>

/** Public choices only; never auth, prompts, threads or environment values. */
export class ProviderPreferenceStore {
  private tail: Promise<void> = Promise.resolve()
  public constructor(private readonly root: string) {}
  public async load(): Promise<ProviderPreferences> {
    try { return schema.parse(JSON.parse(await readFile(path.join(this.root, 'provider-choice.json'), 'utf8'))) }
    catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return { provider: 'codex-app-server', model: null }
      // Do not attach parser errors: they may include untrusted file contents.
      // eslint-disable-next-line preserve-caught-error
      throw new Error('Preferencia de provider invalida; preserve provider-choice.json para diagnostico.')
    }
  }
  public save(value: ProviderPreferences): Promise<void> {
    const serialized = JSON.stringify(schema.parse(value))
    const operation = this.tail.then(async () => {
      await mkdir(this.root, { recursive: true })
      const temporary = path.join(this.root, `provider-choice.${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, serialized, { flag: 'wx', mode: 0o600 })
        await rename(temporary, path.join(this.root, 'provider-choice.json'))
      } finally { await rm(temporary, { force: true }) }
    })
    this.tail = operation.catch(() => undefined)
    return operation
  }
}

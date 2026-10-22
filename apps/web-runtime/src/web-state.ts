import { PromptArchitect } from '../../../packages/core/src/prompt-architect'
import { promptSaveInputSchema, promptCompileInputSchema, promptCompareInputSchema, promptIdInputSchema, promptLintInputSchema, promptTemplateSchema } from '../../../packages/contracts/src/prompt'

type DurableStorage = {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
}

type DurableState = {
  storage: DurableStorage
}

const json = (body: unknown, init: ResponseInit = {}): Response => Response.json(body, init)

export class WebState {
  private promptQueue: Promise<void> = Promise.resolve()
  constructor(private readonly state: DurableState) {}

  private async promptRequest(request: Request): Promise<Response> {
    const preceding = this.promptQueue
    let release = (): void => undefined
    this.promptQueue = new Promise<void>((resolve) => { release = resolve })
    await preceding
    try {
      const body = await request.json() as { action?: string; input?: unknown }
      const list = async () => promptTemplateSchema.array().parse(await this.state.storage.get('prompts') ?? [])
      const architect = new PromptArchitect({
        listPrompts: list,
        getPrompt: async (id) => (await list()).find((item) => item.id === id) ?? null,
        putPrompt: async (template) => { await this.state.storage.put('prompts', [...(await list()).filter((item) => item.id !== template.id), template]) },
        recordPromptUsage: async (executionId, templateId, promptHash) => { await this.state.storage.put(`prompt-usage:${executionId}`, { templateId, promptHash }) }
      })
      let value: unknown
      switch (body.action) {
        case 'list': value = await architect.list(); break
        case 'save': { const input = promptSaveInputSchema.parse(body.input); value = await architect.save(input.name, input.content, input.variables); break }
        case 'compile': { const input = promptCompileInputSchema.parse(body.input); value = await architect.compile(input.templateId, input.values); break }
        case 'compare': { const input = promptCompareInputSchema.parse(body.input); value = await architect.compare(input.leftId, input.rightId); break }
        case 'lint': value = architect.lint(promptLintInputSchema.parse(body.input).content); break
        case 'export': value = await architect.export(promptIdInputSchema.parse(body.input).templateId); break
        default: return json({ ok: false, error: { code: 'INVALID_PROMPT_ACTION', message: 'Ação de prompt inválida.', retryable: false } }, { status: 400 })
      }
      return json({ ok: true, value })
    } catch (cause) {
      return json({ ok: false, error: { code: 'PROMPT_ERROR', message: cause instanceof Error ? cause.message : 'Falha no Prompt Architect.', retryable: false } }, { status: 400 })
    } finally { release() }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/prompt' && request.method === 'POST') return this.promptRequest(request)
    const key = url.searchParams.get('key')?.trim() ?? ''
    if (key === '' || key.length > 512) return json({ ok: false, error: 'INVALID_KEY' }, { status: 400 })

    if (request.method === 'GET') {
      const value = await this.state.storage.get<unknown>(key)
      return json({ ok: true, found: value !== undefined, value: value ?? null })
    }

    if (request.method === 'PUT') {
      const body = await request.json() as { value?: unknown }
      if (!Object.prototype.hasOwnProperty.call(body, 'value')) return json({ ok: false, error: 'VALUE_REQUIRED' }, { status: 400 })
      await this.state.storage.put(key, body.value)
      return json({ ok: true })
    }

    if (request.method === 'DELETE') {
      await this.state.storage.delete(key)
      return json({ ok: true })
    }

    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  }
}

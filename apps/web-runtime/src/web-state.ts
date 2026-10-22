import { PromptArchitect } from '../../../packages/core/src/prompt-architect'
import { VisualIntelligenceService } from '../../../packages/core/src/visual-intelligence'
import { visualAssetSchema, visualAssetAddInputSchema, visualAssetUseInputSchema } from '../../../packages/contracts/src/visual'
import { toolboxGateRecordSchema } from '../../../packages/contracts/src/control-center'
import { WorkspaceCreateService } from './workspace-create'
import { getRemoteSandbox, type RemoteRuntimeConfig } from './remote-runtime'
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
  private visualQueue: Promise<void> = Promise.resolve()
  private evidenceQueue: Promise<void> = Promise.resolve()
  private readonly fileCreation: WorkspaceCreateService
  constructor(private readonly state: DurableState, private readonly env: RemoteRuntimeConfig = {}) {
    this.fileCreation = new WorkspaceCreateService(state.storage)
  }

  private async evidenceRequest(request: Request): Promise<Response> {
    const preceding = this.evidenceQueue
    let release = (): void => undefined
    this.evidenceQueue = new Promise<void>((resolve) => { release = resolve })
    await preceding
    try {
      const body = await request.json() as { action: string; record?: unknown }
      const records = toolboxGateRecordSchema.array().parse(await this.state.storage.get('gate-evidence') ?? [])
      if (body.action === 'list') return json({ ok: true, value: records })
      if (body.action !== 'append') throw new Error('Ação inválida.')
      const record = toolboxGateRecordSchema.parse(body.record)
      await this.state.storage.put('gate-evidence', [record, ...records.filter((item) => item.id !== record.id)].slice(0, 100))
      return json({ ok: true, value: record })
    } catch { return json({ ok: false, error: { code: 'GATE_EVIDENCE_ERROR', message: 'Histórico de evidências indisponível.', retryable: false } }, { status: 400 }) }
    finally { release() }
  }

  private async visualRequest(request: Request): Promise<Response> {
    const preceding = this.visualQueue
    let release = (): void => undefined
    this.visualQueue = new Promise<void>((resolve) => { release = resolve })
    await preceding
    try {
      const body = await request.json() as { action: string; input: unknown; workspaceId: string }
      if (!/^[a-zA-Z0-9_-]{8,96}$/.test(body.workspaceId)) throw new Error('Workspace inválido.')
      const list = async () => visualAssetSchema.array().parse(await this.state.storage.get('visual-assets') ?? [])
      const service = new VisualIntelligenceService({
        listVisualAssets: list,
        getVisualAsset: async (id) => (await list()).find((item) => item.id === id) ?? null,
        putVisualAsset: async (asset) => { await this.state.storage.put('visual-assets', [...await list(), asset]) }
      }, '/workspace')
      let value: unknown
      if (body.action === 'statuses') value = service.statuses({})
      else if (body.action === 'list') value = await service.list()
      else if (body.action === 'add') {
        const input = visualAssetAddInputSchema.parse(body.input)
        const url = new URL(input.sourceUrl)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Origem deve ser uma URL HTTP(S).')
        const sandbox = getRemoteSandbox(this.env, body.workspaceId)
        const metadata = await sandbox.fileInfo(input.localPath)
        if (!metadata.isFile) throw new Error('Arquivo visual inexistente ou não regular.')
        value = await service.add(input)
      } else if (body.action === 'use') {
        const asset = await service.assertUsable(visualAssetUseInputSchema.parse(body.input).assetId)
        const metadata = await getRemoteSandbox(this.env, body.workspaceId).fileInfo(asset.localPath)
        if (!metadata.isFile) throw new Error('Arquivo visual indisponível.')
        value = asset
      } else throw new Error('Ação visual inválida.')
      return json({ ok: true, value })
    } catch (cause) { return json({ ok: false, error: { code: 'VISUAL_ERROR', message: cause instanceof Error ? cause.message : 'Falha no catálogo visual.', retryable: false } }, { status: 400 }) }
    finally { release() }
  }

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
    if (url.pathname === '/gate-evidence' && request.method === 'POST') return this.evidenceRequest(request)
    if (url.pathname === '/visual' && request.method === 'POST') return this.visualRequest(request)
    if (url.pathname === '/workspace-create' && request.method === 'POST') {
      try {
        const body = await request.json() as { action: string; input: unknown; workspaceId: string }
        if (!/^[a-zA-Z0-9_-]{8,96}$/.test(body.workspaceId)) throw new Error('Workspace inválido.')
        const sandbox = getRemoteSandbox(this.env, body.workspaceId)
        if (body.action !== 'prepare' && body.action !== 'approve') throw new Error('Ação inválida.')
        const value = body.action === 'prepare' ? await this.fileCreation.prepare(body.input) : await this.fileCreation.approve(body.input, (path, content) => sandbox.createFile(path, content))
        return json({ ok: true, value })
      } catch { return json({ ok: false, error: { code: 'WORKSPACE_CREATE_FAILED', message: 'Criação não confirmada. Verifique caminho, diretório pai, arquivo existente e validade da revisão. Para tentar novamente, prepare uma nova revisão.', retryable: false } }, { status: 409 }) }
    }
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

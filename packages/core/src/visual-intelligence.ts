import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { visualAssetSchema, visualProviderStatusSchema, type VisualAsset, type VisualProviderStatus } from '@tupiniquim/contracts'

export interface VisualRepository {
  putVisualAsset(asset: VisualAsset): Promise<void>
  getVisualAsset(id: string): Promise<VisualAsset | null>
  listVisualAssets(): Promise<VisualAsset[]>
}

const providers: Array<Omit<VisualProviderStatus, 'state'> & { environment?: string; defaultState?: VisualProviderStatus['state'] }> = [
  { id: 'YANDEX_IMAGES', label: 'Yandex Images', kind: 'API', url: 'https://yandex.cloud/en/docs/search-api/concepts/image-search', detail: 'Pesquisa visual por API oficial.', environment: 'YANDEX_SEARCH_API_KEY' },
  { id: 'MAGNIFIC', label: 'Magnific', kind: 'API', url: 'https://www.magnific.com/ai/docs/magnific-api', detail: 'Upscale e transformação por API.', environment: 'MAGNIFIC_API_KEY' },
  { id: 'EVERYPIXEL', label: 'Everypixel', kind: 'API', url: 'https://labs.everypixel.com/docs', detail: 'Busca e avaliação de imagens.', environment: 'EVERYPIXEL_CLIENT_ID' },
  { id: 'KREA', label: 'Krea', kind: 'API', url: 'https://www.krea.ai/features/api', detail: 'Geração e edição visual por API.', environment: 'KREA_API_KEY' },
  { id: 'FONTJOY', label: 'Fontjoy', kind: 'ASSISTED', url: 'https://fontjoy.com/', detail: 'Combinações tipográficas por fluxo assistido.', defaultState: 'ASSISTED_DEEP_LINK' },
  { id: 'HAIKEI', label: 'Haikei', kind: 'ASSISTED', url: 'https://haikei.app/', detail: 'Gerador assistido de SVGs e fundos.', defaultState: 'ASSISTED_DEEP_LINK' },
  { id: 'STILLS', label: 'Stills', kind: 'ASSISTED', url: 'https://www.stills.com/', detail: 'Referência visual condicionada à licença.', defaultState: 'LICENSE_REQUIRED' },
  { id: 'SPOT_DSGN', label: '@spot_dsgn', kind: 'ASSISTED', url: 'https://www.instagram.com/spot_dsgn/', detail: 'Referência pública; copiar assets é proibido.', defaultState: 'ASSISTED_DEEP_LINK' }
]

export class VisualIntelligenceService {
  public constructor(private readonly repository: VisualRepository, private readonly dataRoot: string) {}

  public statuses(configured: Record<string, boolean>): VisualProviderStatus[] {
    return providers.map((provider) => visualProviderStatusSchema.parse({ ...provider, state: provider.environment === undefined ? provider.defaultState : configured[provider.environment] === true ? 'READY' : 'NOT_CONFIGURED' }))
  }

  public async add(input: Omit<VisualAsset, 'id' | 'createdAt'>): Promise<VisualAsset> {
    const expectedRoot = path.resolve(this.dataRoot, 'assets')
    const candidate = path.resolve(input.localPath)
    const relative = path.relative(expectedRoot, candidate)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Assets visuais precisam ser copiados para o diretório de dados em D:\\CODEX.')
    const asset = visualAssetSchema.parse({ ...input, id: randomUUID(), createdAt: new Date().toISOString() })
    await this.repository.putVisualAsset(asset)
    return asset
  }

  public async list(): Promise<VisualAsset[]> { return await this.repository.listVisualAssets() }

  public async assertUsable(id: string): Promise<VisualAsset> {
    const asset = await this.repository.getVisualAsset(id)
    if (asset === null) throw new Error('Asset visual não encontrado.')
    if (asset.license !== 'KNOWN' || asset.licenseName === null) throw new Error('Uso bloqueado: licença conhecida é obrigatória.')
    return asset
  }
}

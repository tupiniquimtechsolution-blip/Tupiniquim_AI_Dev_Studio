import { describe, expect, it } from 'vitest'
import type { VisualAsset } from '@tupiniquim/contracts'
import { VisualIntelligenceService, type VisualRepository } from './visual-intelligence'

class MemoryVisuals implements VisualRepository {
  public assets: VisualAsset[] = []
  public putVisualAsset(asset: VisualAsset): Promise<void> { this.assets.push(asset); return Promise.resolve() }
  public getVisualAsset(id: string): Promise<VisualAsset | null> { return Promise.resolve(this.assets.find((asset) => asset.id === id) ?? null) }
  public listVisualAssets(): Promise<VisualAsset[]> { return Promise.resolve(this.assets) }
}

describe('VisualIntelligenceService', () => {
  it('mantém APIs sem credencial em NOT_CONFIGURED', () => {
    const service = new VisualIntelligenceService(new MemoryVisuals(), 'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data')
    expect(service.statuses({}).filter((provider) => provider.kind === 'API').every((provider) => provider.state === 'NOT_CONFIGURED')).toBe(true)
  })

  it('bloqueia uso de asset sem licença conhecida', async () => {
    const repository = new MemoryVisuals()
    const service = new VisualIntelligenceService(repository, 'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data')
    const asset = await service.add({ name: 'Referência', localPath: 'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data\\assets\\ref.png', sourceUrl: 'https://example.com/ref', provider: 'STILLS', license: 'UNKNOWN', licenseName: null, attribution: null, rightsNote: 'Licença ainda não comprovada.' })
    await expect(service.assertUsable(asset.id)).rejects.toThrow('licença')
  })
})

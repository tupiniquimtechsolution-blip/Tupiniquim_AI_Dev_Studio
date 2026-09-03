import { describe, expect, it } from 'vitest'
import type { UIProfile } from '@tupiniquim/contracts'
import { PreferenceService, contrastRatio, type PreferenceRepository } from './preferences'

class MemoryPreferences implements PreferenceRepository {
  public profile: UIProfile | null = null
  public putPreference(_key: string, profile: UIProfile): Promise<void> { this.profile = profile; return Promise.resolve() }
  public getPreference(): Promise<UIProfile | null> { return Promise.resolve(this.profile) }
}

describe('PreferenceService', () => {
  it('cria perfil acessível e rejeita contraste insuficiente', async () => {
    const service = new PreferenceService(new MemoryPreferences())
    const profile = await service.get()
    expect(contrastRatio(profile.theme.text, profile.theme.background)).toBeGreaterThan(4.5)
    await expect(service.save({ ...profile, theme: { ...profile.theme, text: '#111111' } })).rejects.toThrow('WCAG')
  })
})

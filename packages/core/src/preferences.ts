import { randomUUID } from 'node:crypto'
import { uiProfileSchema, type UIProfile } from '@tupiniquim/contracts'

export interface PreferenceRepository {
  putPreference(key: string, profile: UIProfile): Promise<void>
  getPreference(key: string): Promise<UIProfile | null>
}

const activeKey = 'ui-profile:active'

export const createDefaultProfile = (): UIProfile => uiProfileSchema.parse({
  id: randomUUID(),
  name: 'Carbono/Floresta',
  density: 'COMPACT',
  theme: { background: '#0B0F12', surface: '#11171C', raised: '#182127', text: '#E7EEF3', muted: '#93A4AF', accent: '#27C483', info: '#49B6FF', warning: '#F2B84B', danger: '#FF6B6B' },
  layout: { explorerWidth: 230, agentWidth: 340, deckHeight: 220 },
  updatedAt: new Date().toISOString()
})

const luminance = (hex: string): number => {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * (values[0] ?? 0) + 0.7152 * (values[1] ?? 0) + 0.0722 * (values[2] ?? 0)
}

export const contrastRatio = (left: string, right: string): number => {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

export class PreferenceService {
  public constructor(private readonly repository: PreferenceRepository) {}

  public async get(): Promise<UIProfile> {
    const existing = await this.repository.getPreference(activeKey)
    if (existing !== null) return uiProfileSchema.parse(existing)
    const created = createDefaultProfile()
    await this.repository.putPreference(activeKey, created)
    return created
  }

  public async save(profile: UIProfile): Promise<UIProfile> {
    const updated = uiProfileSchema.parse({ ...profile, updatedAt: new Date().toISOString() })
    if (contrastRatio(updated.theme.text, updated.theme.background) < 4.5) throw new Error('Contraste texto/fundo abaixo de WCAG AA.')
    if (contrastRatio(updated.theme.accent, updated.theme.background) < 3) throw new Error('Contraste do acento abaixo do mínimo para componentes.')
    await this.repository.putPreference(activeKey, updated)
    return updated
  }

  public async export(): Promise<string> { return JSON.stringify(await this.get(), null, 2) }

  public async import(serialized: string): Promise<UIProfile> { return await this.save(uiProfileSchema.parse(JSON.parse(serialized))) }
}

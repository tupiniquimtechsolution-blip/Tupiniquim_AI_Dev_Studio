import { describe, expect, it } from 'vitest'
import {
  createThemeController,
  parseThemePreference,
  resolveTheme,
  DESKTOP_THEME_KEY,
  WEB_THEME_KEY,
  type ResolvedTheme,
  type ThemeMedia,
  type ThemeStorage
} from '../../apps/desktop/src/renderer/src/theme'

const memoryStorage = (initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value
    }
  }
}

const fakeMedia = (matches: boolean): ThemeMedia & { fire: () => void; listeners: number } => {
  const listeners = new Set<() => void>()
  return {
    matches,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    fire: () => {
      for (const listener of listeners) listener()
    },
    get listeners() {
      return listeners.size
    }
  }
}

describe('parseThemePreference', () => {
  it('aceita os três valores válidos', () => {
    expect(parseThemePreference('LIGHT')).toBe('LIGHT')
    expect(parseThemePreference('DARK')).toBe('DARK')
    expect(parseThemePreference('SYSTEM')).toBe('SYSTEM')
  })

  it('valor inválido ou ausente cai no fallback (fail-closed)', () => {
    expect(parseThemePreference(null)).toBe('SYSTEM')
    expect(parseThemePreference('')).toBe('SYSTEM')
    expect(parseThemePreference('light')).toBe('SYSTEM')
    expect(parseThemePreference('{"x":1}')).toBe('SYSTEM')
    expect(parseThemePreference(null, 'DARK')).toBe('DARK')
    expect(parseThemePreference('neon', 'DARK')).toBe('DARK')
  })
})

describe('resolveTheme', () => {
  it('LIGHT e DARK ignoram o sistema', () => {
    expect(resolveTheme('LIGHT', true)).toBe('light')
    expect(resolveTheme('LIGHT', false)).toBe('light')
    expect(resolveTheme('DARK', true)).toBe('dark')
    expect(resolveTheme('DARK', false)).toBe('dark')
  })

  it('SYSTEM segue prefers-color-scheme', () => {
    expect(resolveTheme('SYSTEM', true)).toBe('dark')
    expect(resolveTheme('SYSTEM', false)).toBe('light')
  })
})

describe('createThemeController', () => {
  it('lê a preferência persistida e aplica o tema resolvido na criação', () => {
    const storage = memoryStorage({ [WEB_THEME_KEY]: 'DARK' })
    const applied: ResolvedTheme[] = []
    const controller = createThemeController({
      storageKey: WEB_THEME_KEY,
      storage,
      media: fakeMedia(false),
      apply: (resolved) => applied.push(resolved)
    })
    expect(controller.preference()).toBe('DARK')
    expect(controller.resolved()).toBe('dark')
    expect(applied).toEqual(['dark'])
    controller.dispose()
  })

  it('preferência inválida persistida cai no fallback da superfície', () => {
    const storage = memoryStorage({ [DESKTOP_THEME_KEY]: 'corrompido' })
    const controller = createThemeController({
      storageKey: DESKTOP_THEME_KEY,
      fallback: 'DARK',
      storage,
      media: fakeMedia(false),
      apply: () => undefined
    })
    expect(controller.preference()).toBe('DARK')
    expect(controller.resolved()).toBe('dark')
    controller.dispose()
  })

  it('setPreference persiste, aplica e notifica assinantes', () => {
    const storage = memoryStorage()
    const applied: ResolvedTheme[] = []
    let notified = 0
    const controller = createThemeController({
      storageKey: WEB_THEME_KEY,
      storage,
      media: fakeMedia(true),
      apply: (resolved) => applied.push(resolved)
    })
    controller.subscribe(() => {
      notified += 1
    })
    expect(controller.resolved()).toBe('dark') // SYSTEM + sistema escuro

    controller.setPreference('LIGHT')
    expect(storage.data[WEB_THEME_KEY]).toBe('LIGHT')
    expect(controller.resolved()).toBe('light')
    expect(applied).toEqual(['dark', 'light'])
    expect(notified).toBe(1)
    controller.dispose()
  })

  it('SYSTEM reage a mudança do SO; LIGHT/DARK explícitos não', () => {
    const media = fakeMedia(false)
    const applied: ResolvedTheme[] = []
    const controller = createThemeController({
      storageKey: WEB_THEME_KEY,
      storage: memoryStorage(),
      media,
      apply: (resolved) => applied.push(resolved)
    })
    expect(controller.resolved()).toBe('light')

    media.matches = true
    media.fire()
    expect(controller.resolved()).toBe('dark')

    controller.setPreference('LIGHT')
    media.matches = false
    media.fire()
    expect(controller.resolved()).toBe('light')
    media.matches = true
    media.fire()
    expect(controller.resolved()).toBe('light') // preferência explícita vence
    controller.dispose()
  })

  it('sem storage e sem media funciona (fallback SYSTEM → light)', () => {
    const controller = createThemeController({
      storageKey: WEB_THEME_KEY,
      storage: null,
      media: null,
      apply: () => undefined
    })
    expect(controller.preference()).toBe('SYSTEM')
    expect(controller.resolved()).toBe('light')
    controller.setPreference('DARK') // não lança sem storage
    expect(controller.resolved()).toBe('dark')
    controller.dispose()
  })

  it('dispose remove o listener do sistema', () => {
    const media = fakeMedia(false)
    const controller = createThemeController({
      storageKey: WEB_THEME_KEY,
      storage: memoryStorage(),
      media,
      apply: () => undefined
    })
    expect(media.listeners).toBe(1)
    controller.dispose()
    expect(media.listeners).toBe(0)
  })
})

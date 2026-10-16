import { useSyncExternalStore } from 'react'

/**
 * Sistema de tema Claro/Escuro/Sistema compartilhado entre as superfícies
 * Web e Desktop.
 *
 * - A preferência é semântica (`LIGHT | DARK | SYSTEM`) e persistida por
 *   superfície (chaves versionadas abaixo).
 * - `SYSTEM` resolve via `prefers-color-scheme` e segue mudanças do SO em
 *   tempo real enquanto a preferência for SYSTEM.
 * - O tema resolvido é aplicado como `data-theme="light" | "dark"` no
 *   elemento raiz — NENHUMA condição de tema em JSX; toda diferença visual
 *   vem de CSS variables (styles.css / web-experience.css).
 * - O controller aceita dependências injetáveis (storage/media/apply) para
 *   testes determinísticos sem DOM.
 */

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM'
export type ResolvedTheme = 'light' | 'dark'

export const WEB_THEME_KEY = 'tupiniquim.web.theme.v1'
export const DESKTOP_THEME_KEY = 'tupiniquim.desktop.theme.v1'

/** Parse fail-closed: qualquer valor fora do enum cai no fallback. */
export const parseThemePreference = (raw: string | null, fallback: ThemePreference = 'SYSTEM'): ThemePreference =>
  raw === 'LIGHT' || raw === 'DARK' || raw === 'SYSTEM' ? raw : fallback

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme =>
  preference === 'DARK' ? 'dark' : preference === 'LIGHT' ? 'light' : systemPrefersDark ? 'dark' : 'light'

export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Subconjunto de MediaQueryList suficiente para o controller. */
export interface ThemeMedia {
  matches: boolean
  addEventListener?(type: 'change', listener: () => void): void
  removeEventListener?(type: 'change', listener: () => void): void
}

export interface ThemeControllerOptions {
  storageKey: string
  fallback?: ThemePreference
  storage?: ThemeStorage | null
  media?: ThemeMedia | null
  apply?: (resolved: ResolvedTheme) => void
}

export interface ThemeController {
  preference(): ThemePreference
  resolved(): ResolvedTheme
  setPreference(next: ThemePreference): void
  subscribe(listener: () => void): () => void
  dispose(): void
}

const safeLocalStorage = (): ThemeStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const systemMedia = (): ThemeMedia | null =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia('(prefers-color-scheme: dark)')

const domApply = (resolved: ResolvedTheme): void => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolved
}

export const createThemeController = (options: ThemeControllerOptions): ThemeController => {
  const fallback = options.fallback ?? 'SYSTEM'
  const storage = options.storage === undefined ? safeLocalStorage() : options.storage
  const media = options.media === undefined ? systemMedia() : options.media
  const apply = options.apply ?? domApply
  const listeners = new Set<() => void>()

  let preference = parseThemePreference(storage?.getItem(options.storageKey) ?? null, fallback)
  let resolved = resolveTheme(preference, media?.matches === true)

  const publish = (): void => {
    apply(resolved)
    for (const listener of listeners) listener()
  }

  const refresh = (): void => {
    const next = resolveTheme(preference, media?.matches === true)
    if (next !== resolved) {
      resolved = next
      publish()
    }
  }

  // Mudança do SO reflete automaticamente quando a preferência é SYSTEM
  // (refresh() é no-op para LIGHT/DARK explícitos).
  const onSystemChange = (): void => refresh()
  media?.addEventListener?.('change', onSystemChange)

  // Aplicação imediata na criação — antes do primeiro render possível,
  // evitando flash de tema (Parte H).
  apply(resolved)

  return {
    preference: () => preference,
    resolved: () => resolved,
    setPreference: (next: ThemePreference): void => {
      preference = next
      try {
        storage?.setItem(options.storageKey, next)
      } catch {
        /* storage indisponível: preferência vale para a sessão atual */
      }
      resolved = resolveTheme(preference, media?.matches === true)
      publish()
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: (): void => {
      media?.removeEventListener?.('change', onSystemChange)
      listeners.clear()
    }
  }
}

let activeController: ThemeController | null = null

/** Inicializa (uma vez por superfície) e aplica o tema imediatamente. */
export const initThemeController = (options: ThemeControllerOptions): ThemeController => {
  activeController?.dispose()
  activeController = createThemeController(options)
  return activeController
}

export const getThemeController = (): ThemeController | null => activeController

const subscribeActive = (listener: () => void): (() => void) =>
  activeController === null ? () => undefined : activeController.subscribe(listener)

/** Hook: preferência atual + setter (sincronizado entre múltiplos toggles). */
export const useThemePreference = (): [ThemePreference, (next: ThemePreference) => void] => {
  const preference = useSyncExternalStore(subscribeActive, () => activeController?.preference() ?? 'SYSTEM')
  return [preference, (next) => activeController?.setPreference(next)]
}

/** Hook: tema efetivamente resolvido (para Monaco `vs`/`vs-dark` etc.). */
export const useResolvedTheme = (): ResolvedTheme =>
  useSyncExternalStore(subscribeActive, () => activeController?.resolved() ?? 'dark')

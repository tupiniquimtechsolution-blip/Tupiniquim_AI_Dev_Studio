import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import './web-experience.css'
import { WEB_ENTERED_KEY, resolveWebRoute, routePath, type WebRoute } from './experience'

const Landing = lazy(async () => ({ default: (await import('./Landing')).Landing }))
const Onboarding = lazy(async () => ({ default: (await import('./Onboarding')).Onboarding }))
const StudioShell = lazy(async () => ({ default: (await import('./StudioShell')).StudioShell }))
const Workbench = lazy(async () => ({ default: (await import('./Workbench')).Workbench }))

const hasEntered = (): boolean => localStorage.getItem(WEB_ENTERED_KEY) === 'true'

const RouteFallback = (): React.JSX.Element => (
  <div className="wx-route-loading" role="status" aria-live="polite">
    <span className="wx-spinner" aria-hidden="true" />
    <p>Carregando o Tupiniquim Dev AI Studio…</p>
  </div>
)

/**
 * Casca da experiência Web: landing pública → onboarding conversacional →
 * Studio chat-first. O Desktop não passa por aqui (main.tsx decide pela
 * presença da bridge nativa). O workbench completo continua disponível em
 * `/workbench` — progressive disclosure, nunca remoção de capacidade.
 */
export const WebExperience = (): React.JSX.Element => {
  const [route, setRoute] = useState<WebRoute>(() => resolveWebRoute(window.location.pathname, hasEntered()))

  const navigate = useCallback((next: WebRoute): void => {
    if (next === 'studio' || next === 'workbench') localStorage.setItem(WEB_ENTERED_KEY, 'true')
    const path = routePath(next)
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setRoute(next)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onPopState = (): void => setRoute(resolveWebRoute(window.location.pathname, hasEntered()))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return (
    <Suspense fallback={<RouteFallback />}>
      {route === 'landing' && <Landing onNavigate={navigate} />}
      {route === 'onboarding' && <Onboarding onNavigate={navigate} />}
      {route === 'studio' && <StudioShell onNavigate={navigate} />}
      {route === 'workbench' && <Workbench onNavigate={navigate} />}
    </Suspense>
  )
}

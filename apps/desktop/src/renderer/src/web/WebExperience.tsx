import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import './web-experience.css'
import { WEB_ENTERED_KEY, resolveWebRoute, routePath, type WebRoute } from './experience'

const Landing = lazy(async () => ({ default: (await import('./Landing')).Landing }))
const Onboarding = lazy(async () => ({ default: (await import('./Onboarding')).Onboarding }))
const StudioShell = lazy(async () => ({ default: (await import('./StudioShell')).StudioShell }))
const Workbench = lazy(async () => ({ default: (await import('./Workbench')).Workbench }))

const hasEntered = (): boolean => localStorage.getItem(WEB_ENTERED_KEY) === 'true'

/** Duração do exit da rota — deve casar com wx-route-exit no CSS (180ms). */
const ROUTE_EXIT_MS = 180

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
 *
 * Transições de rota: a URL muda imediatamente (pushState/popstate intactos);
 * a rota atual é segurada ~180ms em fase de exit (opacity/translateY via CSS)
 * antes de trocar; a nova rota entra com animação de 200ms. Sob
 * prefers-reduced-motion a troca é instantânea.
 */
export const WebExperience = (): React.JSX.Element => {
  const [route, setRoute] = useState<WebRoute>(() => resolveWebRoute(window.location.pathname, hasEntered()))
  const [exiting, setExiting] = useState(false)
  const routeRef = useRef(route)
  const pendingRef = useRef<WebRoute | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    routeRef.current = route
  }, [route])

  const transitionTo = useCallback((next: WebRoute): void => {
    if (next === routeRef.current && pendingRef.current === null) return
    if (prefersReducedMotion()) {
      pendingRef.current = null
      setExiting(false)
      setRoute(next)
      window.scrollTo({ top: 0 })
      return
    }
    pendingRef.current = next
    setExiting(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const target = pendingRef.current
      pendingRef.current = null
      setExiting(false)
      if (target !== null) {
        setRoute(target)
        window.scrollTo({ top: 0 })
      }
    }, ROUTE_EXIT_MS)
  }, [])

  const navigate = useCallback((next: WebRoute): void => {
    if (next === 'studio' || next === 'workbench') localStorage.setItem(WEB_ENTERED_KEY, 'true')
    const path = routePath(next)
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    transitionTo(next)
  }, [transitionTo])

  useEffect(() => {
    const onPopState = (): void => transitionTo(resolveWebRoute(window.location.pathname, hasEntered()))
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [transitionTo])

  return (
    <Suspense fallback={<RouteFallback />}>
      <div key={route} className={exiting ? 'wx-route exiting' : 'wx-route'}>
        {route === 'landing' && <Landing onNavigate={navigate} />}
        {route === 'onboarding' && <Onboarding onNavigate={navigate} />}
        {route === 'studio' && <StudioShell onNavigate={navigate} />}
        {route === 'workbench' && <Workbench onNavigate={navigate} />}
      </div>
    </Suspense>
  )
}

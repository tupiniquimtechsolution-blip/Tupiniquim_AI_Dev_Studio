import type { Mode } from '@tupiniquim/contracts'

/**
 * Web Product Experience — helpers puros (roteamento, preferências de
 * onboarding e leitura de estado do Remote Runtime).
 *
 * Referências de UX/visual registradas em docs/WEB/PRODUCT_EXPERIENCE.md.
 * Nada aqui cria backend novo: preferências são locais ao navegador e a
 * fronteira de identidade continua sendo a existente (Cloudflare Access /
 * WEB_ALLOW_ANONYMOUS no worker).
 */

export const WEB_ENTERED_KEY = 'tupiniquim.web.entered'
export const WEB_ONBOARDING_KEY = 'tupiniquim.web.onboarding.v1'
export const WEB_MODEL_KEY = 'tupiniquim.web.model'

export type WebRoute = 'landing' | 'onboarding' | 'studio' | 'workbench'

/**
 * Roteamento SPA da superfície Web:
 * - `/` é a landing pública no primeiro acesso e o Studio depois que o
 *   usuário entrou explicitamente (flag local — recovery de sessão volta
 *   direto para a conversa);
 * - `/onboarding`, `/studio` e `/workbench` são sempre respeitados;
 * - caminhos desconhecidos caem na mesma regra da raiz (SPA fallback do
 *   worker Cloudflare).
 */
export const resolveWebRoute = (pathname: string, entered: boolean): WebRoute => {
  const normalized = pathname.replace(/\/+$/, '') === '' ? '/' : pathname.replace(/\/+$/, '')
  if (normalized === '/onboarding') return 'onboarding'
  if (normalized === '/studio') return 'studio'
  if (normalized === '/workbench') return 'workbench'
  if (normalized === '/landing') return 'landing'
  return entered ? 'studio' : 'landing'
}

export const routePath = (route: WebRoute): string =>
  route === 'landing' ? '/' : `/${route}`

export type OnboardingIntent = 'PROGRAMACAO' | 'PESQUISA' | 'PRODUTO' | 'AUTOMACOES' | 'APRENDIZADO'
export type OnboardingLevel = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO'
export type OnboardingExecution = 'CLOUD' | 'CLOUD_PLUS_RUNTIME'

export interface OnboardingPreferences {
  intent: OnboardingIntent
  level: OnboardingLevel
  interests: string[]
  execution: OnboardingExecution
  /** Modelo escolhido entre os compatíveis com a edição Web; null = padrão do produto. */
  model: string | null
  completedAt: string
}

const INTENTS: ReadonlySet<string> = new Set(['PROGRAMACAO', 'PESQUISA', 'PRODUTO', 'AUTOMACOES', 'APRENDIZADO'])
const LEVELS: ReadonlySet<string> = new Set(['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'])
const EXECUTIONS: ReadonlySet<string> = new Set(['CLOUD', 'CLOUD_PLUS_RUNTIME'])

export const parseOnboardingPreferences = (raw: string | null): OnboardingPreferences | null => {
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingPreferences>
    if (typeof parsed !== 'object' || parsed === null) return null
    if (typeof parsed.intent !== 'string' || !INTENTS.has(parsed.intent)) return null
    if (typeof parsed.level !== 'string' || !LEVELS.has(parsed.level)) return null
    if (typeof parsed.execution !== 'string' || !EXECUTIONS.has(parsed.execution)) return null
    if (!Array.isArray(parsed.interests) || parsed.interests.some((item) => typeof item !== 'string')) return null
    if (parsed.model !== null && typeof parsed.model !== 'string') return null
    if (typeof parsed.completedAt !== 'string') return null
    return {
      intent: parsed.intent,
      level: parsed.level,
      interests: parsed.interests,
      execution: parsed.execution,
      model: parsed.model ?? null,
      completedAt: parsed.completedAt
    }
  } catch {
    return null
  }
}

export const serializeOnboardingPreferences = (preferences: OnboardingPreferences): string =>
  JSON.stringify(preferences)

/** Estados do Remote Runtime preservados integralmente (fail-closed). */
export type ExecutionRuntimeState = 'DISABLED' | 'MISCONFIGURED' | 'OFFLINE' | 'READY'

export interface ExecutionRuntimeView {
  state: ExecutionRuntimeState
  label: string
  detail: string
  tone: 'ok' | 'warn' | 'muted' | 'danger'
  /** true somente quando READY: filesystem/Git/terminal/build/tests liberados. */
  osCapabilities: boolean
}

export const RUNTIME_LOCK_MESSAGE = 'Conecte o Runtime Local para usar terminal, Git e filesystem.'

/**
 * Cada estado tem mensagem própria (fail-closed intacto): a UI nunca deve
 * apresentar o mesmo erro genérico para DISABLED/MISCONFIGURED/OFFLINE —
 * isso fazia todos os fluxos parecerem quebrados em produção.
 */
export const executionRuntimeView = (state: string | null | undefined): ExecutionRuntimeView => {
  switch (state) {
    case 'READY':
      return { state: 'READY', label: 'Runtime Local — Online', detail: 'Files, Git, terminal, build e testes liberados no seu hardware.', tone: 'ok', osCapabilities: true }
    case 'OFFLINE':
      return { state: 'OFFLINE', label: 'Runtime Local — Offline', detail: 'O Tunnel está configurado, mas o gateway não respondeu. Inicie o Runtime Local ou verifique o túnel; depois use "Verificar novamente".', tone: 'warn', osCapabilities: false }
    case 'MISCONFIGURED':
      return { state: 'MISCONFIGURED', label: 'Runtime Local — Configuração incompleta', detail: 'Revise URL/token do gateway no Control Center. Nenhum fallback silencioso é aplicado.', tone: 'danger', osCapabilities: false }
    default:
      return { state: 'DISABLED', label: 'Execution — Cloud', detail: 'Execução local desativada nesta implantação. Chat e Workers AI continuam disponíveis; terminal, Git, filesystem e gates exigem o Runtime Local.', tone: 'muted', osCapabilities: false }
  }
}

export interface StudioSuggestion {
  id: string
  title: string
  detail: string
  mode: Mode
  prompt: string
}

/** Sugestões contextuais do estado vazio — orientadas por intenção. */
export const studioSuggestions = (preferences: OnboardingPreferences | null): StudioSuggestion[] => {
  const base: StudioSuggestion[] = [
    { id: 'create-app', title: 'Criar um app', detail: 'Descreva o produto e receba um caminho executável.', mode: 'CHAT', prompt: 'Quero criar um aplicativo. Contexto: ' },
    { id: 'review-repo', title: 'Revisar repositório', detail: 'Análise guiada do código do workspace.', mode: 'REVIEW', prompt: 'Revise a estrutura atual do workspace e aponte riscos. ' },
    { id: 'research', title: 'Pesquisar tecnologia', detail: 'Comparar opções com evidências.', mode: 'RESEARCH', prompt: 'Pesquise e compare opções para: ' },
    { id: 'plan', title: 'Montar um plano', detail: 'Plano verificável antes de qualquer mutação.', mode: 'PLAN', prompt: 'Crie um plano detalhado para: ' }
  ]
  if (preferences === null) return base
  if (preferences.intent === 'PESQUISA') return [base[2] as StudioSuggestion, base[3] as StudioSuggestion, base[0] as StudioSuggestion, base[1] as StudioSuggestion]
  if (preferences.intent === 'APRENDIZADO') return [{ id: 'learn', title: 'Aprender um conceito', detail: 'Explicações com exemplos executáveis.', mode: 'CHAT', prompt: 'Explique com exemplos práticos: ' }, ...base.slice(0, 3)]
  return base
}

import { ArrowLeft, ArrowRight, Bot, Braces, Check, Cloud, Cpu, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle'
import type { LocalModel } from '@tupiniquim/contracts'
import {
  WEB_MODEL_KEY,
  WEB_ONBOARDING_KEY,
  serializeOnboardingPreferences,
  type OnboardingExecution,
  type OnboardingIntent,
  type OnboardingLevel,
  type WebRoute
} from './experience'

interface OnboardingProps {
  onNavigate: (route: WebRoute) => void
}

const INTENT_OPTIONS: Array<{ id: OnboardingIntent; label: string; detail: string }> = [
  { id: 'PROGRAMACAO', label: 'Programação', detail: 'Escrever, revisar e evoluir código real.' },
  { id: 'PESQUISA', label: 'Pesquisa', detail: 'Comparar tecnologias e coletar evidências.' },
  { id: 'PRODUTO', label: 'Produto', detail: 'Transformar ideias em planos e protótipos.' },
  { id: 'AUTOMACOES', label: 'Automações', detail: 'Rotinas, integrações e fluxos assistidos.' },
  { id: 'APRENDIZADO', label: 'Aprendizado', detail: 'Estudar com exemplos executáveis.' }
]

const LEVEL_OPTIONS: Array<{ id: OnboardingLevel; label: string; detail: string }> = [
  { id: 'INICIANTE', label: 'Estou começando', detail: 'Prefiro explicações passo a passo.' },
  { id: 'INTERMEDIARIO', label: 'Intermediário', detail: 'Conheço o básico e quero produtividade.' },
  { id: 'AVANCADO', label: 'Avançado', detail: 'Quero controle fino de plano, diff e execução.' }
]

const INTEREST_OPTIONS = ['TypeScript', 'Python', 'React', 'Node.js', 'Rust', 'Dados & ML', 'DevOps', 'Mobile'] as const

const EXECUTION_OPTIONS: Array<{ id: OnboardingExecution; label: string; detail: string; icon: React.ReactNode }> = [
  { id: 'CLOUD', label: 'Somente Cloud', detail: 'Chat, planos e workspace lógico — sem instalar nada.', icon: <Cloud size={18} aria-hidden="true" /> },
  { id: 'CLOUD_PLUS_RUNTIME', label: 'Cloud + Runtime Local', detail: 'Pretendo conectar meu computador depois para terminal, Git e builds.', icon: <Cpu size={18} aria-hidden="true" /> }
]

const TOTAL_STEPS = 7

interface Answers {
  intent: OnboardingIntent | null
  level: OnboardingLevel | null
  interests: string[]
  execution: OnboardingExecution | null
  model: string | null
}

/**
 * Onboarding conversacional multi-step.
 * Referência de UX: multi-step AI chat-style lead gen form
 * (21st.dev/@openairlabs) — uma decisão por vez, cards limpos, progresso
 * discreto. Produz PREFERÊNCIAS locais; não cria permissões nem substitui a
 * fronteira de identidade existente (Cloudflare Access permanece a borda).
 */
export const Onboarding = ({ onNavigate }: OnboardingProps): React.JSX.Element => {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({ intent: null, level: null, interests: [], execution: null, model: null })
  const [models, setModels] = useState<LocalModel[]>([])
  const [modelsState, setModelsState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let active = true
    void window.studio.agent.listLocalModels().then((result) => {
      if (!active) return
      if (result.ok && result.value.length > 0) { setModels(result.value); setModelsState('ready') } else setModelsState('unavailable')
    })
    return () => { active = false }
  }, [])

  const progress = useMemo(() => Math.round(((step + 1) / TOTAL_STEPS) * 100), [step])

  const finish = (): void => {
    const now = new Date().toISOString()
    localStorage.setItem(WEB_ONBOARDING_KEY, serializeOnboardingPreferences({
      intent: answers.intent ?? 'PROGRAMACAO',
      level: answers.level ?? 'INTERMEDIARIO',
      interests: answers.interests,
      execution: answers.execution ?? 'CLOUD',
      model: answers.model,
      completedAt: now
    }))
    // Preferência de modelo somente entre os compatíveis reportados pelo
    // catálogo Web — nunca um identificador digitado livremente.
    if (answers.model !== null && models.some((model) => model.model === answers.model)) {
      localStorage.setItem(WEB_MODEL_KEY, answers.model)
    }
    onNavigate('studio')
  }

  const next = (): void => setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1))
  const back = (): void => setStep((current) => Math.max(current - 1, 0))

  const toggleInterest = (interest: string): void => {
    setAnswers((current) => ({
      ...current,
      interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest]
    }))
  }

  return (
    <div className="tqs-onboarding">
      <header className="ob-top">
        <div className="ld-brand">
          <span className="ld-brand-mark" aria-hidden="true"><Braces size={16} /></span>
          <span className="ld-brand-name">Tupiniquim <strong>Dev AI Studio</strong></span>
        </div>
        <div className="ob-progress" role="status" aria-label={`Passo ${step + 1} de ${TOTAL_STEPS}`}>
          <span>Passo {step + 1} de {TOTAL_STEPS}</span>
          <div className="ob-progress-track" aria-hidden="true"><div className="ob-progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
        <ThemeToggle />
        <button className="ld-btn ghost" onClick={() => onNavigate('studio')}>Pular por agora</button>
      </header>

      <main className="ob-stage">
        <div className="ob-orb" aria-hidden="true"><Bot size={20} /></div>

        {step === 0 && (
          <section className="ob-card" aria-labelledby="ob-q0">
            <h1 id="ob-q0">Boas-vindas ao Studio.</h1>
            <p>Vou fazer algumas perguntas rápidas para deixar sua experiência com a cara do seu trabalho. Leva menos de um minuto — e nada disso vira permissão: são só preferências.</p>
            <div className="ob-actions">
              <button className="ld-btn primary lg" onClick={next}>Vamos lá <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="ob-card" aria-labelledby="ob-q1">
            <h1 id="ob-q1">Como você pretende usar o Studio?</h1>
            <div className="ob-options" role="group" aria-labelledby="ob-q1">
              {INTENT_OPTIONS.map((option) => (
                <button key={option.id} className={`ob-option${answers.intent === option.id ? ' selected' : ''}`} aria-pressed={answers.intent === option.id} onClick={() => { setAnswers((current) => ({ ...current, intent: option.id })); next() }}>
                  <strong>{option.label}</strong><span>{option.detail}</span>
                </button>
              ))}
            </div>
            <OnboardingNav onBack={back} />
          </section>
        )}

        {step === 2 && (
          <section className="ob-card" aria-labelledby="ob-q2">
            <h1 id="ob-q2">Qual o seu nível hoje?</h1>
            <div className="ob-options" role="group" aria-labelledby="ob-q2">
              {LEVEL_OPTIONS.map((option) => (
                <button key={option.id} className={`ob-option${answers.level === option.id ? ' selected' : ''}`} aria-pressed={answers.level === option.id} onClick={() => { setAnswers((current) => ({ ...current, level: option.id })); next() }}>
                  <strong>{option.label}</strong><span>{option.detail}</span>
                </button>
              ))}
            </div>
            <OnboardingNav onBack={back} />
          </section>
        )}

        {step === 3 && (
          <section className="ob-card" aria-labelledby="ob-q3">
            <h1 id="ob-q3">Quais stacks ou temas interessam?</h1>
            <p>Escolha quantos quiser — usamos isso apenas para sugerir pontos de partida.</p>
            <div className="ob-chips" role="group" aria-labelledby="ob-q3">
              {INTEREST_OPTIONS.map((interest) => (
                <button key={interest} className={`ob-chip${answers.interests.includes(interest) ? ' selected' : ''}`} aria-pressed={answers.interests.includes(interest)} onClick={() => toggleInterest(interest)}>
                  {answers.interests.includes(interest) && <Check size={13} aria-hidden="true" />}{interest}
                </button>
              ))}
            </div>
            <OnboardingNav onBack={back} onNext={next} nextLabel="Continuar" />
          </section>
        )}

        {step === 4 && (
          <section className="ob-card" aria-labelledby="ob-q4">
            <h1 id="ob-q4">Como prefere executar?</h1>
            <p>O modo Cloud já funciona agora. O Runtime Local é opcional e pode ser conectado depois, pelo Control Center — sem pressa.</p>
            <div className="ob-options" role="group" aria-labelledby="ob-q4">
              {EXECUTION_OPTIONS.map((option) => (
                <button key={option.id} className={`ob-option${answers.execution === option.id ? ' selected' : ''}`} aria-pressed={answers.execution === option.id} onClick={() => { setAnswers((current) => ({ ...current, execution: option.id })); next() }}>
                  <span className="ob-option-icon" aria-hidden="true">{option.icon}</span>
                  <strong>{option.label}</strong><span>{option.detail}</span>
                </button>
              ))}
            </div>
            <OnboardingNav onBack={back} />
          </section>
        )}

        {step === 5 && (
          <section className="ob-card" aria-labelledby="ob-q5">
            <h1 id="ob-q5">Preferência inicial de modelo</h1>
            <p>Somente modelos compatíveis com a edição Web aparecem aqui. Você pode trocar a qualquer momento dentro do Studio.</p>
            {modelsState === 'loading' && <p className="ob-muted" role="status">Consultando catálogo de modelos…</p>}
            {modelsState === 'unavailable' && <p className="ob-muted" role="status">Catálogo indisponível agora — o Studio usará o modelo padrão compatível.</p>}
            {modelsState === 'ready' && (
              <div className="ob-options" role="group" aria-labelledby="ob-q5">
                {models.map((model) => (
                  <button key={model.model} className={`ob-option${answers.model === model.model ? ' selected' : ''}`} aria-pressed={answers.model === model.model} onClick={() => { setAnswers((current) => ({ ...current, model: model.model })); next() }}>
                    <strong>{model.displayName ?? model.name}</strong><span>Provider: Cloudflare Workers AI · Runtime: Cloud</span>
                  </button>
                ))}
              </div>
            )}
            <OnboardingNav onBack={back} onNext={next} nextLabel={modelsState === 'ready' ? 'Usar o padrão' : 'Continuar'} />
          </section>
        )}

        {step === 6 && (
          <section className="ob-card" aria-labelledby="ob-q6">
            <h1 id="ob-q6">Tudo pronto.</h1>
            <p>Seu Studio abre em modo conversa. Ferramentas técnicas — arquivos, terminal, Git — aparecem quando o trabalho pedir por elas.</p>
            <ul className="ob-summary">
              <li><span>Uso</span><strong>{INTENT_OPTIONS.find((item) => item.id === answers.intent)?.label ?? 'Programação'}</strong></li>
              <li><span>Nível</span><strong>{LEVEL_OPTIONS.find((item) => item.id === answers.level)?.label ?? 'Intermediário'}</strong></li>
              <li><span>Execução</span><strong>{answers.execution === 'CLOUD_PLUS_RUNTIME' ? 'Cloud + Runtime Local' : 'Somente Cloud'}</strong></li>
              <li><span>Modelo</span><strong>{models.find((item) => item.model === answers.model)?.displayName ?? 'Padrão compatível (GLM-4.7 Flash)'}</strong></li>
            </ul>
            <div className="ob-actions">
              <button className="ld-btn ghost" onClick={back}><ArrowLeft size={15} aria-hidden="true" /> Voltar</button>
              <button className="ld-btn primary lg" onClick={finish}><Sparkles size={16} aria-hidden="true" /> Abrir o Studio</button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

const OnboardingNav = ({ onBack, onNext, nextLabel }: { onBack: () => void; onNext?: () => void; nextLabel?: string }): React.JSX.Element => (
  <div className="ob-actions">
    <button className="ld-btn ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Voltar</button>
    {onNext !== undefined && <button className="ld-btn primary" onClick={onNext}>{nextLabel ?? 'Continuar'} <ArrowRight size={15} aria-hidden="true" /></button>}
  </div>
)

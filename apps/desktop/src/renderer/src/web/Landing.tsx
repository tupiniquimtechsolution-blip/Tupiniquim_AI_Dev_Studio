import { ArrowRight, Bot, Braces, CheckCircle2, Cloud, Cpu, ExternalLink, FileCode2, GitBranch, Layers, Lock, MonitorSmartphone, ShieldCheck, Sparkles, TerminalSquare, Workflow } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import type { WebRoute } from './experience'

interface LandingProps {
  onNavigate: (route: WebRoute) => void
}

const capacidades = [
  { icon: <Bot size={20} />, title: 'Conversa que vira trabalho', detail: 'Chat com IA em Workers AI para planejar, pesquisar, revisar e escrever código — com histórico e recuperação de sessão.' },
  { icon: <Workflow size={20} />, title: 'Planos verificáveis', detail: 'Todo efeito mutável nasce de um plano com manifesto de efeitos e aprovação explícita. Nada roda por baixo dos panos.' },
  { icon: <FileCode2 size={20} />, title: 'Workspace lógico', detail: 'Arquivos do projeto organizados em um workspace isolado por sessão, com checkpoints e restauração.' },
  { icon: <TerminalSquare size={20} />, title: 'Execução real, sob controle', detail: 'Terminal, Git, build e testes através do Runtime Local opcional — no seu hardware, nunca em servidores de terceiros.' },
  { icon: <Layers size={20} />, title: 'Provider ≠ Runtime ≠ Modelo', detail: 'Cada camada é explícita e selecionável. Sem fallback silencioso, sem troca automática de modelo.' },
  { icon: <ShieldCheck size={20} />, title: 'Fail-closed por padrão', detail: 'Runtime offline não derruba o chat; recursos de SO ficam bloqueados até o gateway reportar READY.' }
]

const passos = [
  { n: '1', title: 'Descreva a intenção', detail: '“Quero uma API de agendamento com autenticação.” O Studio entende o pedido no chat.' },
  { n: '2', title: 'Receba um plano', detail: 'Passos claros, riscos e efeitos declarados. Você edita e aprova o que pode mutar.' },
  { n: '3', title: 'Acompanhe a execução', detail: 'Arquivos, Git e terminal aparecem quando são usados — não antes.' },
  { n: '4', title: 'Valide com evidência', detail: 'Build, testes e diffs reais, com trilha causal recuperável.' }
]

/**
 * Landing pública do Tupiniquim Dev AI Studio.
 * Referência estrutural de UX: template Nextly (21st.dev/@web3templates) —
 * apenas estrutura visual; marca, textos e identidade são do produto.
 */
export const Landing = ({ onNavigate }: LandingProps): React.JSX.Element => {
  return (
    <div className="tqs-landing">
      <header className="ld-nav">
        <div className="ld-nav-inner">
          <a className="ld-brand" href="/" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <span className="ld-brand-mark" aria-hidden="true"><Braces size={18} /></span>
            <span className="ld-brand-name">Tupiniquim <strong>Dev AI Studio</strong></span>
          </a>
          <nav className="ld-links" aria-label="Seções da página">
            <a href="#produto">Produto</a>
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#seguranca">Segurança</a>
            <a href="https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio" target="_blank" rel="noreferrer noopener"><ExternalLink size={14} aria-hidden="true" /> GitHub</a>
          </nav>
          <div className="ld-nav-ctas">
            <ThemeToggle />
            <button className="ld-btn ghost" onClick={() => onNavigate('studio')}>Abrir Studio</button>
            <button className="ld-btn primary" onClick={() => onNavigate('onboarding')}>Começar</button>
          </div>
        </div>
      </header>

      <main>
        <section className="ld-hero" id="produto">
          <div className="ld-hero-copy">
            <span className="ld-eyebrow"><Sparkles size={14} aria-hidden="true" /> Plataforma de desenvolvimento assistido por IA</span>
            <h1>Do pedido ao código executável, em um único Studio.</h1>
            <p>
              Converse com a IA, planeje, pesquise e escreva código em um workspace real.
              Quando precisar executar — terminal, Git, build e testes — o Runtime Local opcional
              roda no seu hardware, com você no controle de provider, modelo e runtime o tempo todo.
            </p>
            <div className="ld-hero-ctas">
              <button className="ld-btn primary lg" onClick={() => onNavigate('onboarding')}>Começar agora <ArrowRight size={16} aria-hidden="true" /></button>
              <button className="ld-btn ghost lg" onClick={() => onNavigate('studio')}>Entrar no Studio</button>
            </div>
            <ul className="ld-hero-facts">
              <li><CheckCircle2 size={14} aria-hidden="true" /> Sem cartão, sem instalação para o modo Cloud</li>
              <li><CheckCircle2 size={14} aria-hidden="true" /> Aprovação explícita antes de qualquer mutação</li>
            </ul>
          </div>
          <div className="ld-hero-preview" aria-label="Prévia da interface do Studio" role="img">
            <div className="ld-preview-window">
              <div className="ld-preview-titlebar">
                <span className="ld-dot" /><span className="ld-dot" /><span className="ld-dot" />
                <span className="ld-preview-title">Tupiniquim Dev AI Studio</span>
                <span className="ld-preview-chip"><Cloud size={11} aria-hidden="true" /> Workers AI</span>
              </div>
              <div className="ld-preview-body">
                <div className="ld-msg user"><span>Você</span><p>Crie uma API de tarefas com autenticação e testes.</p></div>
                <div className="ld-msg ai"><span>Workers AI</span><p>Plano proposto: 1) contrato da API · 2) autenticação · 3) persistência · 4) testes. O passo 3 grava arquivos e aguarda sua aprovação.</p></div>
                <div className="ld-preview-plan">
                  <CheckCircle2 size={13} aria-hidden="true" /> Aprovação pendente — <em>workspace.write · src/tasks.ts</em>
                </div>
                <div className="ld-preview-composer">
                  <span>Descreva o que deseja construir…</span>
                  <span className="ld-preview-send"><Sparkles size={12} aria-hidden="true" /> Enviar</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ld-trust" aria-label="Arquitetura de confiança">
          <div className="ld-trust-inner">
            <div><Cloud size={16} aria-hidden="true" /><strong>Cloud Free</strong><span>UI, chat e estado em Cloudflare Workers</span></div>
            <div><Cpu size={16} aria-hidden="true" /><strong>Runtime Local</strong><span>Execução opcional no seu hardware</span></div>
            <div><Lock size={16} aria-hidden="true" /><strong>Fail-closed</strong><span>Offline bloqueia SO, nunca o chat</span></div>
            <div><GitBranch size={16} aria-hidden="true" /><strong>Git de verdade</strong><span>Diffs, status e histórico do repositório</span></div>
          </div>
        </section>

        <section className="ld-section" id="recursos">
          <header className="ld-section-head">
            <h2>Principais capacidades</h2>
            <p>Um Studio conversacional na frente; engenharia verificável por trás.</p>
          </header>
          <div className="ld-grid">
            {capacidades.map((item) => (
              <article key={item.title} className="ld-card">
                <span className="ld-card-icon" aria-hidden="true">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ld-section alt" id="como-funciona">
          <header className="ld-section-head">
            <h2>Como funciona</h2>
            <p>A interface começa como uma conversa e revela ferramentas conforme o trabalho exige.</p>
          </header>
          <ol className="ld-steps">
            {passos.map((passo) => (
              <li key={passo.n}>
                <span className="ld-step-n" aria-hidden="true">{passo.n}</span>
                <div><h3>{passo.title}</h3><p>{passo.detail}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ld-section" id="cloud-runtime">
          <header className="ld-section-head">
            <h2>Cloud + Runtime Local</h2>
            <p>Duas camadas distintas, nomeadas sem mistura: provider de IA na nuvem, execução de SO no seu computador.</p>
          </header>
          <div className="ld-split">
            <article className="ld-card wide">
              <span className="ld-card-icon" aria-hidden="true"><Cloud size={20} /></span>
              <h3>Cloud (sempre disponível)</h3>
              <p>Chat, planejamento, pesquisa, histórico, sessões e workspace lógico rodam em Cloudflare Workers com Workers AI. Nenhuma instalação.</p>
              <ul>
                <li>Provider: Cloudflare Workers AI</li>
                <li>Runtime: Cloud</li>
                <li>Modelo padrão: GLM-4.7 Flash</li>
              </ul>
            </article>
            <article className="ld-card wide">
              <span className="ld-card-icon" aria-hidden="true"><MonitorSmartphone size={20} /></span>
              <h3>Runtime Local (opcional)</h3>
              <p>Conecte o Tupiniquim Remote Runtime via túnel seguro e libere progressivamente filesystem, Git, terminal, build e testes no seu hardware.</p>
              <ul>
                <li>Estados: DISABLED · MISCONFIGURED · OFFLINE · READY</li>
                <li>Offline? O chat Cloud continua funcionando.</li>
                <li>Nenhuma porta aberta no roteador.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="ld-section alt" id="seguranca">
          <header className="ld-section-head">
            <h2>Segurança e controle</h2>
            <p>Você aprova, o Studio executa. Nunca o contrário.</p>
          </header>
          <div className="ld-grid three">
            <article className="ld-card"><span className="ld-card-icon" aria-hidden="true"><ShieldCheck size={20} /></span><h3>Aprovações granulares</h3><p>Propostas de escrita trazem hash, alvo, operação e proveniência completa antes de materializar qualquer arquivo.</p></article>
            <article className="ld-card"><span className="ld-card-icon" aria-hidden="true"><Lock size={20} /></span><h3>Sem fallback silencioso</h3><p>Provider, modelo e runtime são escolhas suas. Estado indisponível bloqueia o envio — nunca troca sozinho.</p></article>
            <article className="ld-card"><span className="ld-card-icon" aria-hidden="true"><Cpu size={20} /></span><h3>Seu hardware, suas regras</h3><p>A execução de SO acontece no Runtime Local com confinamento de workspace, ou simplesmente não acontece.</p></article>
          </div>
        </section>

        <section className="ld-section" id="modelos">
          <header className="ld-section-head">
            <h2>Modelos e providers</h2>
            <p>Distinções explícitas — cada camada aparece com o próprio nome na interface.</p>
          </header>
          <div className="ld-models">
            <div className="ld-model-row"><span className="ld-model-k">Model</span><strong>GLM-4.7 Flash</strong><span className="ld-model-tag">padrão Web</span></div>
            <div className="ld-model-row"><span className="ld-model-k">Model</span><strong>Gemma 4 26B A4B IT</strong><span className="ld-model-tag">compatível</span></div>
            <div className="ld-model-row"><span className="ld-model-k">Provider</span><strong>Cloudflare Workers AI</strong><span className="ld-model-tag">cloud</span></div>
            <div className="ld-model-row"><span className="ld-model-k">Runtime</span><strong>Cloud · Runtime Local (opcional)</strong><span className="ld-model-tag">execução</span></div>
          </div>
        </section>

        <section className="ld-final-cta">
          <h2>Em que vamos trabalhar?</h2>
          <p>Abra o Studio e comece pela conversa. As ferramentas aparecem quando você precisar delas.</p>
          <div className="ld-hero-ctas center">
            <button className="ld-btn primary lg" onClick={() => onNavigate('onboarding')}>Começar <ArrowRight size={16} aria-hidden="true" /></button>
            <button className="ld-btn ghost lg" onClick={() => onNavigate('studio')}>Abrir Studio</button>
          </div>
        </section>
      </main>

      <footer className="ld-footer">
        <div className="ld-footer-inner">
          <div className="ld-brand">
            <span className="ld-brand-mark" aria-hidden="true"><Braces size={16} /></span>
            <span className="ld-brand-name">Tupiniquim <strong>Dev AI Studio</strong></span>
          </div>
          <nav aria-label="Links do rodapé">
            <a href="#produto">Produto</a>
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#seguranca">Segurança</a>
            <a href="https://github.com/tupiniquimtechsolution-blip/Tupiniquim_AI_Dev_Studio" target="_blank" rel="noreferrer noopener">GitHub</a>
          </nav>
          <p className="ld-footer-note">Cloud Free em Cloudflare Workers · Execução de SO somente via Runtime Local opcional · Fail-closed por padrão.</p>
        </div>
      </footer>
    </div>
  )
}

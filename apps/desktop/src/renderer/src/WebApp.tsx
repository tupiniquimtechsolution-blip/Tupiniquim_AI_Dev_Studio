import { Boxes, CheckCircle2, Cloud, Download, HardDrive, Monitor, ShieldCheck, Usb } from 'lucide-react'

const unavailable = 'Requer edição Windows/USB'

const features = [
  ['Interface Web', 'Disponível no navegador'],
  ['Control Center', 'Modo Web seguro'],
  ['Workspace local / filesystem', unavailable],
  ['Terminal / node-pty', unavailable],
  ['Ollama local', unavailable],
  ['Hardware e USB', unavailable]
] as const

export const WebApp = (): React.JSX.Element => {
  return (
    <main style={{ minHeight: '100vh', background: '#07090f', color: '#f7f7fb', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 72px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 56, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#121725', border: '1px solid #273044' }}>
              <Boxes size={24} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: 18 }}>Tupiniquim Dev AI</strong>
              <span style={{ color: '#9ca6ba', fontSize: 13 }}>Web Preview</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: '#0f1c17', border: '1px solid #1f4937', color: '#9ce7bf', fontSize: 13 }}>
            <CheckCircle2 size={15} /> Aplicação Web online
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, .65fr)', gap: 24, alignItems: 'stretch' }}>
          <div style={{ padding: '44px', borderRadius: 24, background: 'linear-gradient(145deg, #101524 0%, #0b0e16 100%)', border: '1px solid #232b3d' }}>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: '#a9b8ff', fontSize: 13, marginBottom: 20 }}>
              <Cloud size={16} /> MODO WEB DE TESTES
            </div>
            <h1 style={{ fontSize: 'clamp(38px, 6vw, 68px)', lineHeight: .98, letterSpacing: '-0.045em', margin: '0 0 22px', maxWidth: 760 }}>
              Seu laboratório de IA, agora acessível pelo navegador.
            </h1>
            <p style={{ margin: 0, color: '#a8b0c1', maxWidth: 720, fontSize: 17, lineHeight: 1.7 }}>
              Esta edição Web executa somente capacidades compatíveis com o navegador. Recursos privilegiados do computador permanecem bloqueados por padrão e são disponibilizados pelas edições Windows e USB.
            </p>
          </div>

          <aside style={{ padding: 28, borderRadius: 24, background: '#0d1018', border: '1px solid #232b3d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <ShieldCheck size={21} />
              <strong>Capability Gate</strong>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {features.map(([name, status]) => (
                <div key={name} style={{ padding: '13px 14px', borderRadius: 12, background: '#111622', border: '1px solid #20283a' }}>
                  <div style={{ fontSize: 13, fontWeight: 650 }}>{name}</div>
                  <div style={{ marginTop: 5, color: status === unavailable ? '#e3b879' : '#8ed7ad', fontSize: 12 }}>{status}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <div style={{ padding: 24, borderRadius: 18, background: '#0d1018', border: '1px solid #232b3d' }}>
            <Cloud size={24} />
            <h2 style={{ fontSize: 18, margin: '16px 0 8px' }}>Web</h2>
            <p style={{ color: '#9da6b7', lineHeight: 1.6, margin: 0, fontSize: 14 }}>Interface para demonstração, testes e recursos cloud-safe.</p>
          </div>
          <div style={{ padding: 24, borderRadius: 18, background: '#0d1018', border: '1px solid #232b3d' }}>
            <Monitor size={24} />
            <h2 style={{ fontSize: 18, margin: '16px 0 8px' }}>Windows</h2>
            <p style={{ color: '#9da6b7', lineHeight: 1.6, margin: '0 0 16px', fontSize: 14 }}>Edição local completa para workspace, terminal e modelos locais.</p>
            <button disabled title="O download será habilitado somente quando houver um release asset real." style={{ opacity: .55, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #30394d', background: '#151a27', color: '#d7dbea', padding: '9px 12px', borderRadius: 10 }}><Download size={15} /> Em preparação</button>
          </div>
          <div style={{ padding: 24, borderRadius: 18, background: '#0d1018', border: '1px solid #232b3d' }}>
            <Usb size={24} />
            <h2 style={{ fontSize: 18, margin: '16px 0 8px' }}>USB Portable</h2>
            <p style={{ color: '#9da6b7', lineHeight: 1.6, margin: '0 0 16px', fontSize: 14 }}>Ambiente portátil/offline para execução local sem instalar o laboratório no PC.</p>
            <button disabled title="O download será habilitado somente quando houver um release asset real." style={{ opacity: .55, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #30394d', background: '#151a27', color: '#d7dbea', padding: '9px 12px', borderRadius: 10 }}><HardDrive size={15} /> Em preparação</button>
          </div>
        </section>
      </div>
    </main>
  )
}

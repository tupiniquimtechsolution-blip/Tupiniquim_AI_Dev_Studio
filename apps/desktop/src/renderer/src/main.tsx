import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

const root = document.getElementById('root')
if (root === null) throw new Error('Elemento raiz não encontrado.')

const hasDesktopBridge = typeof window.studio !== 'undefined'
  && typeof window.controlCenter !== 'undefined'
  && typeof window.googleTasks !== 'undefined'

const renderFatal = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida ao iniciar o Tupiniquim Dev AI.'
  ReactDOM.createRoot(root).render(
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07090f', color: '#f7f7fb', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', padding: 32 }}>
      <section style={{ maxWidth: 720, padding: 28, border: '1px solid #3b2630', borderRadius: 18, background: '#140d12' }}>
        <h1 style={{ marginTop: 0 }}>Falha ao iniciar o Tupiniquim Dev AI</h1>
        <p style={{ color: '#efb6c0', lineHeight: 1.6 }}>{message}</p>
        <button onClick={() => window.location.reload()} style={{ border: '1px solid #44506a', background: '#171d2a', color: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>Recarregar</button>
      </section>
    </main>
  )
}

const bootstrap = async (): Promise<void> => {
  if (!hasDesktopBridge) {
    const { installWebBridge } = await import('./webBridge')
    installWebBridge()
  }

  await Promise.all([
    import('./monaco'),
    import('@xterm/xterm/css/xterm.css')
  ])
  const [{ App }, { GoogleTasksDock }] = await Promise.all([
    import('./App'),
    import('./GoogleTasksDock')
  ])

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
      <GoogleTasksDock />
    </React.StrictMode>
  )
}

void bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar o Tupiniquim Dev AI.', error)
  renderFatal(error)
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { WebApp } from './WebApp'

const root = document.getElementById('root')
if (root === null) throw new Error('Elemento raiz não encontrado.')

const hasDesktopBridge = typeof window.studio !== 'undefined'
  && typeof window.controlCenter !== 'undefined'
  && typeof window.googleTasks !== 'undefined'

const renderWeb = (): void => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <WebApp />
    </React.StrictMode>
  )
}

const renderDesktop = async (): Promise<void> => {
  await import('./monaco')
  await import('@xterm/xterm/css/xterm.css')
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

if (hasDesktopBridge) {
  void renderDesktop().catch((error: unknown) => {
    console.error('Falha ao iniciar a edição Desktop do Tupiniquim Dev AI.', error)
    renderWeb()
  })
} else {
  renderWeb()
}

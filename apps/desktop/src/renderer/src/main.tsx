import './monaco'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { App } from './App'
import { GoogleTasksDock } from './GoogleTasksDock'
import { WebApp } from './WebApp'

const root = document.getElementById('root')
if (root === null) throw new Error('Elemento raiz não encontrado.')

const hasDesktopBridge = typeof window.studio !== 'undefined'
  && typeof window.controlCenter !== 'undefined'
  && typeof window.googleTasks !== 'undefined'

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {hasDesktopBridge ? (
      <>
        <App />
        <GoogleTasksDock />
      </>
    ) : (
      <WebApp />
    )}
  </React.StrictMode>
)

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { CirclePlay, Square } from 'lucide-react'

export const TerminalPane = ({ workspaceReady, platform }: { workspaceReady: boolean; platform?: string | null }): React.JSX.Element => {
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const idRef = useRef<string | null>(null)
  const [state, setState] = useState<'stopped' | 'running' | 'error'>('stopped')
  const starting = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
      fontSize: 12,
      theme: { background: '#0B0F12', foreground: '#D8E2E8', cursor: '#27C483', selectionBackground: '#28513F' }
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    if (hostRef.current !== null) terminal.open(hostRef.current)
    fit.fit()
    terminal.writeln('\x1b[38;2;39;196;131mTupiniquim Terminal\x1b[0m — sessão ainda não iniciada.')
    terminal.onData((data) => {
      const terminalId = idRef.current
      if (terminalId !== null) void window.studio.terminal.write({ terminalId, data }).then((result) => {
        if (!result.ok) terminal.writeln(`\r\n${result.error.message}`)
      })
    })
    const unsubscribe = window.studio.terminal.onData((event) => {
      if (event.terminalId !== idRef.current) return
      terminal.write(event.data)
      if (event.exited === true) { setState('stopped'); idRef.current = null }
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      const terminalId = idRef.current
      if (terminalId !== null) void window.studio.terminal.resize({ terminalId, cols: terminal.cols, rows: terminal.rows })
    })
    if (hostRef.current !== null) observer.observe(hostRef.current)
    terminalRef.current = terminal
    fitRef.current = fit
    return () => {
      mounted.current = false
      if (idRef.current !== null) void window.studio.terminal.kill({ terminalId: idRef.current })
      idRef.current = null
      observer.disconnect(); unsubscribe(); terminal.dispose()
    }
  }, [])

  const start = async (): Promise<void> => {
    const terminal = terminalRef.current
    if (!workspaceReady || terminal === null || starting.current || idRef.current !== null) return
    if (!window.confirm('Iniciar um shell real no workspace? Os comandos digitados serão executados com as permissões do Runtime.')) return
    starting.current = true
    try {
      fitRef.current?.fit()
      const result = await window.studio.terminal.create({ cwd: '', cols: terminal.cols, rows: terminal.rows })
      if (!mounted.current) { if (result.ok) await window.studio.terminal.kill({ terminalId: result.value.terminalId }); return }
      if (result.ok) { idRef.current = result.value.terminalId; setState('running'); terminal.clear() }
      else { setState('error'); terminal.writeln(`\r\n\x1b[31m${result.error.message}\x1b[0m`) }
    } catch { setState('error'); terminal.writeln('\r\nNão foi possível iniciar o terminal.') }
    finally { starting.current = false }
  }

  const stop = async (): Promise<void> => {
    const terminalId = idRef.current
    if (terminalId !== null) {
      try {
        const result = await window.studio.terminal.kill({ terminalId })
        if (!result.ok) { terminalRef.current?.writeln(`\r\n${result.error.message}`); return }
      } catch { terminalRef.current?.writeln('\r\nEncerramento não confirmado.'); return }
    }
    idRef.current = null
    setState('stopped')
  }

  return (
    <section className="terminal-shell">
      <header className="terminal-toolbar">
        <span className={`state-dot ${state}`} />
        <span>{state === 'running' ? ((platform === 'cloudflare-edge' || platform === 'cloudflare-sandbox') ? 'Shell · Tupiniquim Remote Runtime' : 'PowerShell · ConPTY') : state === 'error' ? 'Falha no terminal' : 'Terminal parado'}</span>
        <div className="spacer" />
        {state === 'running'
          ? <button className="icon-button" onClick={() => void stop()} title="Encerrar terminal"><Square size={14} /></button>
          : <button className="icon-button" disabled={!workspaceReady} onClick={() => void start()} title="Iniciar terminal"><CirclePlay size={15} /></button>}
      </header>
      <div ref={hostRef} className="terminal-host" />
    </section>
  )
}

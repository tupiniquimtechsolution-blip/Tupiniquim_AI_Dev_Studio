import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { CirclePlay, Square } from 'lucide-react'

export const TerminalPane = ({ workspaceReady }: { workspaceReady: boolean }): React.JSX.Element => {
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const idRef = useRef<string | null>(null)
  const [state, setState] = useState<'stopped' | 'running' | 'error'>('stopped')

  useEffect(() => {
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
      if (terminalId !== null) void window.studio.terminal.write({ terminalId, data })
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
    return () => { observer.disconnect(); unsubscribe(); terminal.dispose() }
  }, [])

  const start = async (): Promise<void> => {
    const terminal = terminalRef.current
    if (!workspaceReady || terminal === null) return
    fitRef.current?.fit()
    const result = await window.studio.terminal.create({ cwd: '', cols: terminal.cols, rows: terminal.rows })
    if (result.ok) { idRef.current = result.value.terminalId; setState('running'); terminal.clear() }
    else { setState('error'); terminal.writeln(`\r\n\x1b[31m${result.error.message}\x1b[0m`) }
  }

  const stop = async (): Promise<void> => {
    const terminalId = idRef.current
    if (terminalId !== null) await window.studio.terminal.kill({ terminalId })
    idRef.current = null
    setState('stopped')
  }

  return (
    <section className="terminal-shell">
      <header className="terminal-toolbar">
        <span className={`state-dot ${state}`} />
        <span>{state === 'running' ? 'PowerShell · ConPTY' : state === 'error' ? 'Falha no terminal' : 'Terminal parado'}</span>
        <div className="spacer" />
        {state === 'running'
          ? <button className="icon-button" onClick={() => void stop()} title="Encerrar terminal"><Square size={14} /></button>
          : <button className="icon-button" disabled={!workspaceReady} onClick={() => void start()} title="Iniciar terminal"><CirclePlay size={15} /></button>}
      </header>
      <div ref={hostRef} className="terminal-host" />
    </section>
  )
}

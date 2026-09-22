import { useEffect, useState } from 'react'

export const GitReviewPane = ({ workspaceReady }: { workspaceReady: boolean }): React.JSX.Element => {
  const [output, setOutput] = useState('Abra um workspace para consultar o diff real.')
  const [busy, setBusy] = useState(false)
  const refresh = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.studio.git.diff()
      setOutput(result.ok ? result.value || 'Nenhuma alteração tracked não staged. Consulte git status no terminal para untracked/staged.' : result.error.message)
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!workspaceReady) return
    let alive = true
    void window.studio.git.diff().then((result) => {
      if (alive) setOutput(result.ok ? result.value || 'Nenhuma alteração tracked não staged.' : result.error.message)
    })
    return () => { alive = false }
  }, [workspaceReady])
  return <section><button disabled={!workspaceReady || busy} title={!workspaceReady ? 'Abra um workspace primeiro' : 'Executar git diff --no-ext-diff'} onClick={() => void refresh()}>Atualizar diff</button><pre style={{ whiteSpace: 'pre-wrap', userSelect: 'text', padding: 12 }}>{output}</pre></section>
}

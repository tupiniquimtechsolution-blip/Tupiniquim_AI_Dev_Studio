import { useEffect, useRef, useState } from 'react'
import type { PromptTemplate } from '@tupiniquim/contracts'

export const PromptArchitectPane = ({ onDirtyChange, onBusyChange }: { onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void }): React.JSX.Element => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [otherId, setOtherId] = useState('')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [notice, setNotice] = useState('Carregando versões…')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const selected = templates.find((item) => item.id === selectedId)
  const dirty = name !== (selected?.name ?? '') || content !== (selected?.content ?? '')
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    let active = true
    void window.studio.prompt.list().then((result) => {
      if (!active) return
      if (result.ok) { setTemplates(result.value); setNotice(result.value.length === 0 ? 'Crie seu primeiro template.' : 'Versões carregadas.') }
      else setNotice(result.error.message)
    }).catch(() => { if (active) setNotice('Não foi possível carregar os templates. Reabra o painel para tentar novamente.') })
    return () => { active = false }
  }, [])

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try { await action() }
    catch { setNotice('Operação não confirmada. O rascunho foi preservado; consulte as versões antes de tentar novamente.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  const choose = (id: string): void => {
    if (inFlight.current || (dirty && !window.confirm('Descartar o rascunho de prompt não salvo?'))) return
    const template = templates.find((item) => item.id === id)
    setSelectedId(id); setName(template?.name ?? ''); setContent(template?.content ?? ''); setValues({}); setOutput('')
  }

  const save = async (): Promise<void> => {
    const variables = [...new Set([...content.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/gu)].map((match) => match[1]).filter((item): item is string => item !== undefined))]
    const result = await window.studio.prompt.save({ name, content, variables: variables.map((variable) => ({ name: variable, description: `Valor de ${variable}`, required: true })) })
    if (!result.ok) { setNotice(result.error.message); return }
    setTemplates((current) => [...current.filter((item) => item.id !== result.value.id), result.value])
    setSelectedId(result.value.id); setName(result.value.name); setContent(result.value.content)
    setNotice(`Versão ${result.value.version} salva. As versões anteriores foram preservadas.`)
  }

  return <section className="prompt-architect-pane" aria-label="Prompt Architect">
    <p role="status">{busy ? 'Processando…' : notice}</p>
    <fieldset disabled={busy}>
      <legend>Templates e versões</legend>
      <label>Versão salva<select value={selectedId} onChange={(event) => choose(event.target.value)}>
        <option value="">Novo template</option>
        {templates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
      </select></label>
      <button onClick={() => choose('')}>Novo template</button>
      <label>Nome do template<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Conteúdo do template<textarea rows={9} maxLength={200_000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Objetivo: {{objetivo}}" /></label>
      <div className="prompt-actions">
        <button disabled={!name.trim() || !content || !dirty} onClick={() => void run(save)}>Salvar nova versão</button>
        <button disabled={!content} onClick={() => void run(async () => {
          const result = await window.studio.prompt.lint({ content })
          if (!result.ok) { setNotice(result.error.message); return }
          setOutput(result.value.length ? result.value.map((issue) => `${issue.severity} · ${issue.code}: ${issue.message}`).join('\n') : 'Nenhum problema de validação encontrado.')
          setNotice('Validação do rascunho concluída.')
        })}>Validar rascunho</button>
      </div>
      <p>Use variáveis como {'{{objetivo}}'}. Salvar cria uma nova versão; compilar e exportar usam a versão salva.</p>
      {selected?.variables.map((variable) => <label key={variable.name}>Valor de {variable.name}<input value={values[variable.name] ?? variable.defaultValue ?? ''} onChange={(event) => setValues((current) => ({ ...current, [variable.name]: event.target.value }))} /></label>)}
      <div className="prompt-actions">
        <button disabled={!selected || dirty} onClick={() => void run(async () => {
          const result = await window.studio.prompt.compile({ templateId: selectedId, values })
          if (!result.ok) { setNotice(result.error.message); return }
          setOutput(result.value.content); setNotice(`Compilado v${result.value.version} · SHA-256 ${result.value.hash}`)
        })}>Compilar versão salva</button>
        <button disabled={!selected || dirty} onClick={() => void run(async () => {
          const result = await window.studio.prompt.export({ templateId: selectedId })
          if (!result.ok) { setNotice(result.error.message); return }
          const url = URL.createObjectURL(new Blob([result.value], { type: 'text/markdown;charset=utf-8' }))
          const link = document.createElement('a')
          link.href = url; link.download = `${name.replace(/[^a-zA-Z0-9_-]/gu, '_').slice(0, 80)}-v${selected?.version ?? 1}.md`
          link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          setNotice('Versão exportada para download.')
        })}>Exportar versão salva</button>
      </div>
      <label>Comparar com<select value={otherId} onChange={(event) => setOtherId(event.target.value)}><option value="">Escolha outra versão</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
      <button disabled={!selected || !otherId || selectedId === otherId} onClick={() => void run(async () => {
        const result = await window.studio.prompt.compare({ leftId: selectedId, rightId: otherId })
        if (!result.ok) { setNotice(result.error.message); return }
        setOutput([...result.value.removed.map((line) => `− ${line}`), ...result.value.added.map((line) => `+ ${line}`)].join('\n') || 'Versões com conteúdo idêntico.')
        setNotice(`Comparação v${result.value.left.version} → v${result.value.right.version}.`)
      })}>Comparar versões salvas</button>
    </fieldset>
    {output !== '' && <section aria-label="Resultado do Prompt Architect"><h2>Resultado</h2><pre>{output}</pre></section>}
  </section>
}

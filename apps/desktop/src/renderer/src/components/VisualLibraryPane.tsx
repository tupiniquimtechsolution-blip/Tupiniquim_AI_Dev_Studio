import { useEffect, useRef, useState } from 'react'
import type { VisualAsset, VisualProviderStatus } from '@tupiniquim/contracts'
import { visualProviderIds } from '../../../../../../packages/contracts/src/visual'

export const VisualLibraryPane = (): React.JSX.Element => {
  const [assets, setAssets] = useState<VisualAsset[]>([])
  const [providers, setProviders] = useState<VisualProviderStatus[]>([])
  const [name, setName] = useState('')
  const [localPath, setLocalPath] = useState('/workspace/assets/')
  const [sourceUrl, setSourceUrl] = useState('')
  const [provider, setProvider] = useState<VisualAsset['provider']>('USER_PROVIDED')
  const [license, setLicense] = useState<VisualAsset['license']>('UNKNOWN')
  const [licenseName, setLicenseName] = useState('')
  const [attribution, setAttribution] = useState('')
  const [rightsNote, setRightsNote] = useState('')
  const [status, setStatus] = useState('Carregando biblioteca visual…')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    void Promise.all([window.studio.visual.list(), window.studio.visual.statuses()]).then(([items, connections]) => {
      if (!active) return
      if (items.ok) setAssets(items.value)
      if (connections.ok) setProviders(connections.value)
      setStatus(!items.ok ? items.error.message : !connections.ok ? connections.error.message : 'Catálogo carregado. Direitos são declarados pelo usuário.')
    }).catch(() => { if (active) setStatus('Não foi possível carregar o catálogo.') }).finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [])
  const add = async (): Promise<void> => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const result = await window.studio.visual.add({ name: name.trim(), localPath, sourceUrl, provider, license, licenseName: licenseName.trim() || null, attribution: attribution.trim() || null, rightsNote: rightsNote.trim() })
      if (result.ok) { setAssets((items) => [...items, result.value]); setStatus('Referência visual registrada. Nenhum arquivo foi copiado ou transformado.') }
      else setStatus(result.error.message)
    } catch { setStatus('Registro não confirmado; o formulário foi preservado.') }
    finally { pending.current = false; setBusy(false) }
  }
  const check = async (assetId: string): Promise<void> => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const result = await window.studio.visual.use({ assetId })
      setStatus(result.ok ? `Licença declarada identificada: ${result.value.licenseName ?? ''}. Verifique as condições e atribuição antes de publicar.` : result.error.message)
    } catch { setStatus('Verificação indisponível.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="prompt-architect-pane" aria-label="Biblioteca visual">
    <p>Registre arquivos existentes em /workspace/assets com origem e direitos. Fechar sem registrar descarta o formulário. Serviços de transformação exigem uma integração configurada; nenhum será acionado por este catálogo.</p>
    <details><summary>Conexões visuais</summary><ul>{providers.map((item) => <li key={item.id}>{item.label}: {item.state}</li>)}</ul></details>
    <fieldset disabled={busy || !loaded}><legend>Registrar referência</legend>
      <label>Nome visual<input aria-label="Nome visual" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></label>
      <label>Arquivo visual<input aria-label="Arquivo visual" value={localPath} maxLength={4096} onChange={(event) => setLocalPath(event.target.value)} /></label>
      <label>URL de origem<input aria-label="URL de origem" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
      <label>Fonte declarada<select aria-label="Fonte declarada" value={provider} onChange={(event) => setProvider(event.target.value as VisualAsset['provider'])}><option value="USER_PROVIDED">Arquivo fornecido pelo usuário</option>{visualProviderIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>Situação da licença<select aria-label="Situação da licença" value={license} onChange={(event) => setLicense(event.target.value as VisualAsset['license'])}><option value="UNKNOWN">Desconhecida</option><option value="KNOWN">Identificada</option><option value="RESTRICTED">Restrita</option></select></label>
      <label>Nome da licença<input aria-label="Nome da licença" value={licenseName} maxLength={200} onChange={(event) => setLicenseName(event.target.value)} /></label>
      <label>Atribuição<input aria-label="Atribuição" value={attribution} maxLength={500} onChange={(event) => setAttribution(event.target.value)} /></label>
      <label>Direitos e condições<textarea aria-label="Direitos e condições" value={rightsNote} maxLength={2000} onChange={(event) => setRightsNote(event.target.value)} /></label>
      <button disabled={!name.trim() || !sourceUrl || !rightsNote.trim()} onClick={() => void add()}>Registrar referência visual</button>
    </fieldset>
    <p role="status" aria-live="polite">{status}</p>
    <h3>Referências registradas</h3>{assets.length === 0 ? <p>Nenhuma referência registrada.</p> : <ul>{assets.map((asset) => <li key={asset.id}><strong>{asset.name}</strong><p>{asset.localPath}<br />Origem: {asset.sourceUrl}<br />Licença: {asset.licenseName ?? 'não identificada'} ({asset.license})<br />Atribuição: {asset.attribution ?? 'não informada'}<br />{asset.rightsNote}</p><button disabled={busy} onClick={() => void check(asset.id)}>Verificar licença de {asset.name}</button></li>)}</ul>}
  </section>
}

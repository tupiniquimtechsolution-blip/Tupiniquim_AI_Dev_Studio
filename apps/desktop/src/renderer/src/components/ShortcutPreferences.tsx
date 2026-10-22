import { useEffect, useRef, useState } from 'react'
import type { UIProfile } from '@tupiniquim/contracts'
import { shortcutActions, shortcutsSchema, type Shortcuts } from '../../../../../../packages/contracts/src/shortcuts'

const labels = { composer: 'Mensagem ao agente', files: 'Arquivos', prompts: 'Prompt Architect', activity: 'Atividade' }

export const ShortcutPreferences = ({ onSaved }: { onSaved: (bindings: Shortcuts) => void }): React.JSX.Element => {
  const [profile, setProfile] = useState<UIProfile | null>(null)
  const [bindings, setBindings] = useState<Shortcuts>({})
  const [status, setStatus] = useState('Carregando preferências…')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  useEffect(() => {
    let active = true
    void window.studio.settings.get().then((result) => {
      if (!active) return
      if (result.ok) { setProfile(result.value); setBindings(result.value.shortcuts ?? {}); setStatus('Atalhos desativados por padrão.') }
      else setStatus(result.error.message)
    }).catch(() => { if (active) setStatus('Não foi possível carregar as preferências.') })
    return () => { active = false }
  }, [])
  const save = async (): Promise<void> => {
    if (profile === null || inFlight.current) return
    const parsed = shortcutsSchema.safeParse(bindings)
    if (!parsed.success) { setStatus(parsed.error.issues.map((issue) => issue.message).join(' ')); return }
    inFlight.current = true; setBusy(true)
    try {
      const result = await window.studio.settings.save({ profile: { ...profile, shortcuts: parsed.data } })
      if (result.ok) { setProfile(result.value); onSaved(result.value.shortcuts ?? {}); setStatus('Atalhos salvos.') }
      else setStatus(result.error.message)
    } catch { setStatus('Não foi possível salvar. Suas escolhas continuam neste painel.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <section className="prompt-architect-pane" aria-label="Atalhos de navegação">
    <p>Ative apenas os atalhos que deseja usar. Mod significa Ctrl no Windows/Linux e Command no Mac. O sistema operacional pode reservar algumas combinações.</p>
    <p>Atalhos ficam suspensos enquanto você digita ou usa um painel. Fechar sem salvar descarta estas escolhas.</p>
    <fieldset disabled={busy || profile === null}><legend>Atalhos</legend>
      {shortcutActions.map((action) => <label key={action}>{labels[action]}<select aria-label={`Atalho: ${labels[action]}`} value={bindings[action] ?? ''} onChange={(event) => setBindings((current) => ({ ...current, [action]: event.target.value }))}>
        <option value="">Desativado</option>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((key) => <option key={key} value={`Mod+Alt+Key${key}`}>Mod + Alt + {key}</option>)}
      </select></label>)}
      <button onClick={() => void save()}>Salvar atalhos</button>
    </fieldset><p role="status" aria-live="polite">{status}</p>
  </section>
}

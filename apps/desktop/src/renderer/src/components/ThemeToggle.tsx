import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemePreference, type ThemePreference } from '../theme'

const OPTIONS: Array<{ preference: ThemePreference; label: string; icon: React.JSX.Element }> = [
  { preference: 'SYSTEM', label: 'Tema do sistema', icon: <Monitor size={14} aria-hidden="true" /> },
  { preference: 'LIGHT', label: 'Tema claro', icon: <Sun size={14} aria-hidden="true" /> },
  { preference: 'DARK', label: 'Tema escuro', icon: <Moon size={14} aria-hidden="true" /> }
]

/**
 * Seletor discreto Sistema/Claro/Escuro.
 * Estado comunicado por aria-pressed + rótulo (nunca somente por cor);
 * navegável por teclado (botões nativos) com foco visível.
 */
export const ThemeToggle = ({ showLabels = false }: { showLabels?: boolean }): React.JSX.Element => {
  const [preference, setPreference] = useThemePreference()
  return (
    <div className="wx-theme-toggle" role="group" aria-label="Tema da interface">
      {OPTIONS.map((option) => (
        <button
          key={option.preference}
          type="button"
          className={preference === option.preference ? 'selected' : ''}
          aria-pressed={preference === option.preference}
          aria-label={option.label}
          title={option.label}
          onClick={() => setPreference(option.preference)}
        >
          {option.icon}
          {showLabels && <span>{option.label.replace('Tema ', '').replace('do ', '')}</span>}
        </button>
      ))}
    </div>
  )
}

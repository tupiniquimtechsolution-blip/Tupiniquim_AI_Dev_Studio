import '../monaco'
import Editor from '@monaco-editor/react'
import { useResolvedTheme } from '../theme'

const languageFor = (file?: string): string => {
  const extension = file?.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', md: 'markdown', css: 'css', html: 'html', py: 'python', rs: 'rust', kt: 'kotlin', swift: 'swift' } as Record<string, string>)[extension ?? ''] ?? 'plaintext'
}

interface CodeEditorProps {
  path: string
  value: string
  onChange: (value: string) => void
}

/**
 * Editor Monaco carregado sob demanda (progressive disclosure): a landing e o
 * chat não pagam o custo do editor — ele só entra quando o usuário abre um
 * arquivo do workspace. O bundle continua local (ver ../monaco.ts, sem CDN).
 */
const CodeEditor = ({ path, value, onChange }: CodeEditorProps): React.JSX.Element => {
  const resolvedTheme = useResolvedTheme()
  return (
    <Editor
      height="100%"
      path={path}
      language={languageFor(path)}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
      options={{ minimap: { enabled: false }, fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace', fontSize: 13, padding: { top: 12 }, smoothScrolling: true, automaticLayout: true }}
    />
  )
}

export default CodeEditor

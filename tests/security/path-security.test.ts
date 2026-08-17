import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PathSecurityError, isInside, resolveLexicalPath } from '@tupiniquim/adapters'

describe('segurança de caminhos', () => {
  const root = 'D:\\CODEX\\workspace'

  it('rejeita traversal e caminhos absolutos', () => {
    expect(() => resolveLexicalPath(root, '..\\segredo.txt')).toThrow(PathSecurityError)
    expect(() => resolveLexicalPath(root, 'C:\\Windows\\System32')).toThrow(PathSecurityError)
    expect(() => resolveLexicalPath(root, '\\\\servidor\\share')).toThrow(PathSecurityError)
  })

  it('aceita apenas descendentes reais da raiz lexical', () => {
    const candidate = resolveLexicalPath(root, 'src\\index.ts')
    expect(isInside(root, candidate)).toBe(true)
    expect(path.relative(root, candidate)).toBe(path.join('src', 'index.ts'))
  })
})

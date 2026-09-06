import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PathSecurityError, isInside, resolveLexicalPath } from '@tupiniquim/adapters'

const isWindows = process.platform === 'win32'
const root = isWindows ? 'F:\\CODEX\\workspace' : '/tmp/workspace'

describe('segurança de caminhos', () => {
  it('rejeita traversal com ..', () => {
    const traversal = path.join('..', 'segredo.txt')
    expect(() => resolveLexicalPath(root, traversal)).toThrow(PathSecurityError)
  })

  it('rejeita caminhos absolutos', () => {
    if (isWindows) {
      expect(() => resolveLexicalPath(root, 'C:\\Windows\\System32')).toThrow(PathSecurityError)
    }
    expect(() => resolveLexicalPath(root, '/etc/passwd')).toThrow(PathSecurityError)
  })

  it('rejeita caminhos de rede UNC', () => {
    if (isWindows) {
      expect(() => resolveLexicalPath(root, '\\\\servidor\\share')).toThrow(PathSecurityError)
    }
  })

  it('aceita apenas descendentes reais da raiz lexical', () => {
    const candidate = resolveLexicalPath(root, path.join('src', 'index.ts'))
    expect(isInside(root, candidate)).toBe(true)
    expect(path.relative(root, candidate)).toBe(path.join('src', 'index.ts'))
  })

  it('rejeita paths com bytes nulos', () => {
    expect(() => resolveLexicalPath(root, 'src/index.ts\0/etc/passwd')).toThrow(PathSecurityError)
  })

  it('rejeita ADS e dois-pontos em qualquer segmento', () => {
    expect(() => resolveLexicalPath(root, 'src\\arquivo.txt:segredo')).toThrow(PathSecurityError)
    expect(() => resolveLexicalPath(root, 'src\\sub:stream\\arquivo.txt')).toThrow(PathSecurityError)
  })

  it.each([
    'CON',
    'con.txt',
    'src\\PRN.md',
    'src\\aux.config.json',
    'src\\NUL.log',
    'src\\COM1.ts',
    'src\\com9.test.ts',
    'src\\LPT1.txt',
    'src\\lpt9.backup'
  ])('rejeita nome reservado do Windows: %s', (relativePath) => {
    expect(() => resolveLexicalPath(root, relativePath)).toThrow(PathSecurityError)
  })

  it.each([
    '\\\\?\\F:\\CODEX\\workspace\\arquivo.txt',
    '\\\\.\\PhysicalDrive0',
    '\\\\??\\F:\\CODEX\\workspace\\arquivo.txt',
    '\\Device\\HarddiskVolume1\\arquivo.txt'
  ])('rejeita namespace ou dispositivo do Windows: %s', (relativePath) => {
    expect(() => resolveLexicalPath(root, relativePath)).toThrow(PathSecurityError)
  })

  it.each(['src\\arquivo.', 'src\\arquivo ', 'src\\pasta.\\arquivo.txt', 'src\\pasta \\arquivo.txt'])(
    'rejeita segmento com ponto ou espaço final: %s',
    (relativePath) => {
      expect(() => resolveLexicalPath(root, relativePath)).toThrow(PathSecurityError)
    }
  )

  it.each(['src\\linha\nova.txt', 'src\\arquivo?.txt', 'src\\arquivo*.txt', 'src\\arquivo|pipe.txt', 'src\\<arquivo>.txt'])(
    'rejeita caractere inválido do Windows: %s',
    (relativePath) => {
      expect(() => resolveLexicalPath(root, relativePath)).toThrow(PathSecurityError)
    }
  )

  it('não confunde nomes comuns com dispositivos reservados', () => {
    expect(resolveLexicalPath(root, 'src\\console.txt')).toBe(isWindows ? 'F:\\CODEX\\workspace\\src\\console.txt' : '/tmp/workspace/src\\console.txt')
    expect(resolveLexicalPath(root, 'src\\com10.txt')).toBe(isWindows ? 'F:\\CODEX\\workspace\\src\\com10.txt' : '/tmp/workspace/src\\com10.txt')
  })
})

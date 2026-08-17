import { describe, expect, it } from 'vitest'
import { HttpResearchProvider } from '@tupiniquim/adapters'

describe('segurança da pesquisa', () => {
  it('bloqueia destinos locais antes de qualquer requisição', async () => {
    const provider = new HttpResearchProvider('D:\\CODEX\\Tupiniquim-AI-Dev-Studio.data\\tests\\research-security')
    await expect(provider.collect('http://127.0.0.1:3000/segredo')).rejects.toThrow('SSRF')
    await expect(provider.collect('file:///C:/Windows/win.ini')).rejects.toThrow('HTTP/HTTPS')
  })
})

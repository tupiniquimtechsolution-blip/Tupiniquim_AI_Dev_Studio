import { describe, expect, it } from 'vitest'
import {
  HttpResearchProvider,
  resolvePublicResearchTarget
} from '@tupiniquim/adapters'

describe('seguranca da pesquisa', () => {
  it('bloqueia destinos locais antes de qualquer requisicao', async () => {
    const provider = new HttpResearchProvider(
      'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data\\tests\\research-security'
    )

    await expect(
      provider.collect('http://127.0.0.1:3000/segredo')
    ).rejects.toThrow('SSRF')

    await expect(
      provider.collect('http://[::1]/segredo')
    ).rejects.toThrow('SSRF')

    await expect(
      provider.collect('http://169.254.169.254/latest/meta-data/')
    ).rejects.toThrow('SSRF')

    await expect(
      provider.collect('file:///C:/Windows/win.ini')
    ).rejects.toThrow('HTTP/HTTPS')
  })

  it('bloqueia DNS que resolve para rede privada', async () => {
    await expect(
      resolvePublicResearchTarget(
        'example.test',
        () => Promise.resolve([{ address: '10.0.0.5' }])
      )
    ).rejects.toThrow('SSRF')
  })

  it('bloqueia resposta DNS mista com endereco privado', async () => {
    await expect(
      resolvePublicResearchTarget(
        'example.test',
        () => Promise.resolve([
          { address: '93.184.216.34' },
          { address: '192.168.1.15' }
        ])
      )
    ).rejects.toThrow('SSRF')
  })

  it('aceita endereco DNS publico validado', async () => {
    await expect(
      resolvePublicResearchTarget(
        'example.test',
        () => Promise.resolve([{ address: '93.184.216.34' }])
      )
    ).resolves.toEqual({
      address: '93.184.216.34',
      family: 4
    })
  })
})

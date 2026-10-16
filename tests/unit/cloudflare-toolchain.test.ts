import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regressão estática da política de toolchain Cloudflare
 * (docs/WEB/CLOUDFLARE_TOOLCHAIN.md): arquitetura zero-cost sem
 * Sandbox/Containers pagos, Wrangler pinado no lockfile e supply chain
 * de CI imutável.
 *
 * IMPORTANTE: histórico ≠ runtime ativo. A migration `web-sandbox-v1` e a
 * classe compatibility `Sandbox` (410 SANDBOX_RETIRED) PODEM existir; o que
 * não pode existir é dependência npm, binding ativo ou versão flutuante.
 */

// Vitest executa com cwd na raiz do repositório (mesma convenção de
// tests/unit/rc1-distribution.test.ts).
const read = (relative: string): string => readFileSync(relative, 'utf8')

const WRANGLER_VERSION = '4.144.0'
const WRANGLER_ACTION_SHA = '953926a2e2182532811c01a25e53647d93bf07c0'

const workflowsDir = join('.github', 'workflows')
const workflowFiles = readdirSync(workflowsDir).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))

describe('package.json (toolchain Cloudflare)', () => {
  const packageJson = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

  it('não depende dos pacotes pagos aposentados (@cloudflare/sandbox, @cloudflare/containers)', () => {
    expect(allDependencies['@cloudflare/sandbox']).toBeUndefined()
    expect(allDependencies['@cloudflare/containers']).toBeUndefined()
  })

  it(`pina wrangler exatamente em ${WRANGLER_VERSION} (sem ^, ~, latest ou major solto)`, () => {
    expect(packageJson.devDependencies?.wrangler).toBe(WRANGLER_VERSION)
  })

  it('scripts cloudflare:* usam o wrangler local e não embutem token', () => {
    const scripts = packageJson.scripts ?? {}
    expect(scripts['cloudflare:check:web']).toContain('wrangler deploy --dry-run')
    expect(scripts['cloudflare:check:control-plane']).toContain('cloudflare/wrangler.jsonc')
    expect(scripts['cloudflare:deploy:web']).toContain('wrangler deploy')
    for (const [name, command] of Object.entries(scripts)) {
      expect(command, `script ${name} não pode conter token/credencial`).not.toMatch(/api[-_]?token|authorization|bearer/i)
    }
  })
})

describe('lockfile', () => {
  it('não contém os pacotes @cloudflare/sandbox nem @cloudflare/containers', () => {
    const lock = read('pnpm-lock.yaml')
    expect(lock).not.toContain('@cloudflare/sandbox')
    expect(lock).not.toContain('@cloudflare/containers')
  })
})

describe('workflows do GitHub (política única de Wrangler)', () => {
  it('nenhum workflow usa npx/versão flutuante de wrangler', () => {
    for (const file of workflowFiles) {
      const content = read(join('.github', 'workflows', file))
      expect(content, `${file}: proibido npx --yes wrangler`).not.toMatch(/npx\s+--yes\s+wrangler/)
      expect(content, `${file}: proibido npx wrangler@`).not.toMatch(/npx\s+wrangler@/)
      expect(content, `${file}: proibido wrangler@4 flutuante`).not.toMatch(/wrangler@4(?![.\d])/)
      expect(content, `${file}: proibido wrangler@latest`).not.toContain('wrangler@latest')
    }
  })

  it('comandos wrangler em run: usam a instalação local (pnpm exec wrangler)', () => {
    for (const file of workflowFiles) {
      const content = read(join('.github', 'workflows', file))
      for (const line of content.split('\n')) {
        const isCommandLine = /^\s*(run:|.*&&|\s*)\S*wrangler\s+(deploy|dev|versions|tail)/.test(line)
        if (isCommandLine && !line.includes('#')) {
          expect(line, `${file}: comando wrangler fora da política local`).toMatch(/pnpm exec wrangler/)
        }
      }
    }
  })

  it('cloudflare-preview.yml pina a wrangler-action por SHA imutável (v4.1.3) e usa pnpm', () => {
    const preview = read('.github/workflows/cloudflare-preview.yml')
    expect(preview).toContain(`cloudflare/wrangler-action@${WRANGLER_ACTION_SHA}`)
    expect(preview).toContain('# v4.1.3')
    expect(preview).not.toMatch(/cloudflare\/wrangler-action@v\d/)
    expect(preview).toContain('packageManager: pnpm')
    expect(preview).toContain('pnpm install --frozen-lockfile')
  })

  it('nenhum workflow referencia wrangler-action sem pin por SHA', () => {
    for (const file of workflowFiles) {
      const content = read(join('.github', 'workflows', file))
      for (const match of content.matchAll(/cloudflare\/wrangler-action@(\S+)/g)) {
        expect(match[1], `${file}: wrangler-action deve ser pinada por SHA de 40 hex`).toMatch(/^[0-9a-f]{40}$/)
      }
    }
  })
})

describe('wrangler configs (zero-cost: sem Containers/Sandbox ativos)', () => {
  const stripJsonComments = (raw: string): string =>
    raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const parseConfig = (relative: string): Record<string, unknown> =>
    JSON.parse(stripJsonComments(read(relative))) as Record<string, unknown>

  it('wrangler.jsonc não tem bloco ativo de containers nem binding de Sandbox pago', () => {
    const config = parseConfig('wrangler.jsonc')
    expect(config.containers, 'bloco "containers" não pode existir').toBeUndefined()
    // Migration histórica web-sandbox-v1 é permitida (histórico ≠ ativo):
    const migrations = (config.migrations ?? []) as Array<{ tag?: string }>
    expect(migrations.some((migration) => migration.tag === 'web-sandbox-v1')).toBe(true)
  })

  it('cloudflare/wrangler.jsonc não tem bloco ativo de containers e mantém environments mw0–mw5', () => {
    const config = parseConfig('cloudflare/wrangler.jsonc')
    expect(config.containers).toBeUndefined()
    const environments = Object.keys(config.env ?? {})
    expect(environments).toEqual(['mw0', 'mw1', 'mw2', 'mw3', 'mw4', 'mw5'])
  })

  it('a classe compatibility Sandbox permanece aposentada (410, sem pacote Cloudflare)', () => {
    const worker = read('apps/web-runtime/src/worker-full.ts')
    expect(worker).toContain('SANDBOX_RETIRED')
    expect(worker).toContain('status: 410')
    expect(worker).not.toContain("from '@cloudflare/sandbox'")
    expect(worker).not.toContain("from '@cloudflare/containers'")
  })
})

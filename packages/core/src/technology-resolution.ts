import { randomUUID } from 'node:crypto'
import { technologyResolutionSchema, type TargetPlatform, type TechnologyCandidate, type TechnologyResolution } from '@tupiniquim/contracts'

interface CandidateTemplate {
  name: string
  platform: TargetPlatform
  baseline: number
  tools: string[]
  sourceUrls: string[]
  strengths: string[]
  constraints: string[]
  signals: Array<{ pattern: RegExp; delta: number; reason: string }>
}

const catalog: CandidateTemplate[] = [
  { name: 'React + Vite', platform: 'WEB', baseline: 88, tools: ['node', 'pnpm'], sourceUrls: ['https://react.dev/', 'https://vite.dev/'], strengths: ['Ecossistema amplo e composição adequada ao monólito modular.'], constraints: ['SSR exige camada adicional.'], signals: [{ pattern: /spa|dashboard|local-first|editor/iu, delta: 6, reason: 'O requisito favorece uma aplicação interativa rica.' }] },
  { name: 'Next.js', platform: 'WEB', baseline: 82, tools: ['node', 'pnpm'], sourceUrls: ['https://nextjs.org/docs'], strengths: ['SSR, rotas e entrega full-stack integradas.'], constraints: ['Maior acoplamento a convenções server-first.'], signals: [{ pattern: /seo|ssr|conteúdo público|e-commerce/iu, delta: 10, reason: 'SSR/SEO aparece explicitamente nos requisitos.' }] },
  { name: 'Electron', platform: 'DESKTOP', baseline: 88, tools: ['node', 'pnpm'], sourceUrls: ['https://www.electronjs.org/docs/latest/'], strengths: ['Acesso maduro a Node, Chromium, PTY e empacotamento desktop.'], constraints: ['Consumo de memória superior ao de um webview nativo.'], signals: [{ pattern: /terminal|monaco|node|pty|desktop-first|offline/iu, delta: 8, reason: 'Integrações desktop/Node são centrais.' }] },
  { name: 'Tauri', platform: 'DESKTOP', baseline: 78, tools: ['rust'], sourceUrls: ['https://tauri.app/'], strengths: ['Binários menores e webview do sistema.'], constraints: ['Requer Rust e sidecars para ecossistemas Node.'], signals: [{ pattern: /binário pequeno|memória baixa|rust/iu, delta: 9, reason: 'O requisito prioriza footprint ou Rust.' }] },
  { name: 'Expo + React Native', platform: 'MOBILE', baseline: 86, tools: ['node', 'pnpm'], sourceUrls: ['https://docs.expo.dev/', 'https://reactnative.dev/'], strengths: ['Entrega Android/iOS com TypeScript e bom fluxo local.'], constraints: ['Módulos nativos específicos ainda exigem toolchains de plataforma.'], signals: [{ pattern: /android|ios|mobile|typescript|cross-platform/iu, delta: 7, reason: 'O requisito favorece código compartilhado para mobile.' }] },
  { name: 'Flutter', platform: 'MOBILE', baseline: 78, tools: ['flutter'], sourceUrls: ['https://docs.flutter.dev/'], strengths: ['Renderização consistente e boa biblioteca de widgets.'], constraints: ['Adiciona Dart e um ecossistema separado.'], signals: [{ pattern: /flutter|dart|pixel-perfect/iu, delta: 9, reason: 'O requisito cita Flutter/Dart ou renderização muito uniforme.' }] }
]

export class TechnologyResolutionEngine {
  public resolve(requirements: string, platforms: TargetPlatform[], availableTools: string[]): TechnologyResolution {
    const tools = new Set(availableTools.map((tool) => tool.toLowerCase()))
    const candidates: TechnologyCandidate[] = catalog.filter((candidate) => platforms.includes(candidate.platform)).map((candidate) => {
      let score = candidate.baseline
      const rationale = [...candidate.strengths]
      for (const signal of candidate.signals) if (signal.pattern.test(requirements)) { score += signal.delta; rationale.push(signal.reason) }
      const missing = candidate.tools.filter((tool) => !tools.has(tool))
      if (missing.length > 0) { score -= 15 * missing.length; rationale.push(`Toolchain ausente: ${missing.join(', ')}.`) }
      else rationale.push('Toolchain necessário disponível localmente.')
      return { name: candidate.name, platform: candidate.platform, score: Math.max(0, Math.min(100, score)), rationale, constraints: candidate.constraints, sourceUrls: candidate.sourceUrls }
    }).sort((left, right) => right.score - left.score)
    const recommendations = platforms.flatMap((platform) => candidates.filter((candidate) => candidate.platform === platform).slice(0, 2))
    const citations = [...new Set(recommendations.flatMap((candidate) => candidate.sourceUrls))]
    return technologyResolutionSchema.parse({
      id: randomUUID(),
      requirements,
      generatedAt: new Date().toISOString(),
      recommendations,
      knowledgePack: { title: 'Technology Resolution', summary: recommendations.map((candidate) => `${candidate.platform}: ${candidate.name} (${candidate.score})`).join(' · '), citations }
    })
  }
}

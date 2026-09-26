import { createHash } from 'node:crypto'
import { registryEntrySchema, type RegistryEntry, type RegistryKind, type RegistryStatus } from '@tupiniquim/contracts'

const stableUuid = (value: string): string => {
  const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

interface ReferenceDefinition {
  key: string
  kind: RegistryKind
  name: string
  description: string
  sourceUrl: string
  sourceRef: string
  status: RegistryStatus
  tags: string[]
  metadata?: Record<string, string>
}

const references: ReferenceDefinition[] = [
  {
    key: 'agent-reach',
    kind: 'TOOL',
    name: 'Agent Reach',
    description: 'Capability source para Research/Web Reach. Conteúdo externo continua não confiável e execução exige gate próprio.',
    sourceUrl: 'https://github.com/Panniantong/Agent-Reach',
    sourceRef: 'Panniantong/Agent-Reach',
    status: 'VERIFIED',
    tags: ['research', 'web-reach'],
    metadata: { dependenciesReviewed: 'false', permissionsReviewed: 'false' }
  },
  {
    key: 'awesome-llm-apps',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'Awesome LLM Apps',
    description: 'Biblioteca de padrões para agents, RAG, teams, MCP e voice.',
    sourceUrl: 'https://github.com/Shubhamsaboo/awesome-llm-apps',
    sourceRef: 'Shubhamsaboo/awesome-llm-apps',
    status: 'APPROVED',
    tags: ['agents', 'rag', 'patterns']
  },
  {
    key: 'public-apis-catalog',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'Public APIs Catalog',
    description: 'Catálogo de descoberta de APIs públicas. Cada API descoberta exige gate próprio e nunca vira allowlist automaticamente.',
    sourceUrl: 'https://github.com/public-apis/public-apis',
    sourceRef: 'public-apis/public-apis',
    status: 'APPROVED',
    tags: ['api', 'discovery-catalog'],
    metadata: { automaticAllowlist: 'false' }
  },
  {
    key: 'free-programming-books',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'Free Programming Books',
    description: 'Referência de materiais gratuitos de programação para Research/Knowledge.',
    sourceUrl: 'https://github.com/EbookFoundation/free-programming-books',
    sourceRef: 'EbookFoundation/free-programming-books',
    status: 'APPROVED',
    tags: ['learning', 'programming']
  },
  {
    key: 'the-algorithms-python',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'TheAlgorithms/Python',
    description: 'Referência ativa de algoritmos e fundamentos de ciência da computação.',
    sourceUrl: 'https://github.com/TheAlgorithms/Python',
    sourceRef: 'TheAlgorithms/Python',
    status: 'APPROVED',
    tags: ['algorithms', 'computer-science']
  },
  {
    key: 'coding-interview-university',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'Coding Interview University',
    description: 'Referência de fundamentos e estudo de ciência da computação; não código de produção.',
    sourceUrl: 'https://github.com/jwasham/coding-interview-university',
    sourceRef: 'jwasham/coding-interview-university',
    status: 'APPROVED',
    tags: ['learning', 'computer-science']
  },
  {
    key: 'docker-awesome-compose',
    kind: 'KNOWLEDGE_SOURCE',
    name: 'Docker Awesome Compose',
    description: 'Biblioteca de padrões de ambiente/Compose para referência de DevOps e tooling.',
    sourceUrl: 'https://github.com/docker/awesome-compose',
    sourceRef: 'docker/awesome-compose',
    status: 'APPROVED',
    tags: ['docker', 'compose', 'devops']
  },
  {
    key: 'supabase-platform',
    kind: 'PLATFORM',
    name: 'Supabase',
    description: 'Platform candidate por projeto para Postgres/Auth/Storage/Realtime; nenhuma adoção global implícita.',
    sourceUrl: 'https://github.com/supabase/supabase',
    sourceRef: 'supabase/supabase',
    status: 'VERIFIED',
    tags: ['platform', 'database', 'auth'],
    metadata: { candidateOnly: 'true', automaticAdoption: 'false', dependenciesReviewed: 'false', permissionsReviewed: 'false' }
  },
  {
    key: 'ui-ux-pro-max',
    kind: 'SKILL',
    name: 'UI UX Pro Max',
    description: 'Skill metadata para design systems, heurísticas, QA visual e responsividade; loadout somente sob demanda.',
    sourceUrl: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
    sourceRef: 'nextlevelbuilder/ui-ux-pro-max-skill',
    status: 'VERIFIED',
    tags: ['design', 'ui', 'ux'],
    metadata: { dependenciesReviewed: 'false', permissionsReviewed: 'false', loadout: 'on-demand' }
  },
  {
    key: 'emil-design-eng',
    kind: 'SKILL',
    name: 'Emil Design Engineering',
    description: 'Skill metadata para UI polish, design engineering e motion; loadout somente sob demanda.',
    sourceUrl: 'https://github.com/emilkowalski/skills',
    sourceRef: 'emilkowalski/skills:emil-design-eng',
    status: 'VERIFIED',
    tags: ['design', 'motion'],
    metadata: { skill: 'emil-design-eng', dependenciesReviewed: 'false', permissionsReviewed: 'false', loadout: 'on-demand' }
  },
  {
    key: 'taste-skill',
    kind: 'SKILL',
    name: 'Taste Skill',
    description: 'Skill metadata para landing pages, portfólios e redesigns anti-template; não padrão para dashboards/data-heavy UI.',
    sourceUrl: 'https://github.com/Leonxlnx/taste-skill',
    sourceRef: 'Leonxlnx/taste-skill:design-taste-frontend',
    status: 'VERIFIED',
    tags: ['design', 'landing-page'],
    metadata: { skill: 'design-taste-frontend', dependenciesReviewed: 'false', permissionsReviewed: 'false', loadout: 'on-demand' }
  },
  {
    key: 'find-skills-pinned',
    kind: 'SKILL',
    name: 'Find Skills',
    description: 'Skill pinned para descoberta no catálogo local e, quando autorizado, busca externa. Pinned não significa aprovada para execução.',
    sourceUrl: 'https://github.com/vercel-labs/skills',
    sourceRef: 'vercel-labs/skills:find-skills',
    status: 'VERIFIED',
    tags: ['skills', 'discovery', 'pinned'],
    metadata: { skillId: 'vercel-labs/skills/find-skills', pinned: 'true', dependenciesReviewed: 'false', permissionsReviewed: 'false' }
  }
]

export const createMw2ReferenceEntries = (retrievedAt = new Date().toISOString()): RegistryEntry[] => references.map((reference) =>
  registryEntrySchema.parse({
    id: stableUuid(`mw2-reference:${reference.key}`),
    kind: reference.kind,
    name: reference.name,
    description: reference.description,
    scope: { kind: 'GLOBAL' },
    status: reference.status,
    trust: 'CURATED_METADATA',
    license: 'UNKNOWN',
    cost: 'UNKNOWN',
    dependencies: [],
    permissions: [],
    citations: [reference.sourceUrl],
    tags: reference.tags,
    metadata: reference.metadata ?? {},
    provenance: {
      sourceUrl: reference.sourceUrl,
      retrievedAt,
      sourceRef: reference.sourceRef,
      notes: ['Curated from Tupiniquim AI Toolbox canonical documentation. Runtime activation is not implied.']
    }
  }))

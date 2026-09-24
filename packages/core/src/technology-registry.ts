import { type RegistryEntry, type TechnologyResolution } from '@tupiniquim/contracts'
import { RegistryCatalog } from './registry-catalog'

export const registerTechnologyResolution = (
  catalog: RegistryCatalog,
  projectId: string,
  resolution: TechnologyResolution
): RegistryEntry[] => resolution.recommendations.map((candidate) => catalog.discover({
  kind: 'TECHNOLOGY',
  name: candidate.name,
  description: [...candidate.rationale, ...candidate.constraints].join(' '),
  scope: { kind: 'PROJECT', projectId },
  citations: candidate.sourceUrls,
  tags: ['technology-resolution', candidate.platform.toLowerCase()],
  metadata: {
    resolutionId: resolution.id,
    platform: candidate.platform,
    score: String(candidate.score),
    automaticAdoption: 'false'
  },
  provenance: {
    sourceUrl: candidate.sourceUrls[0] ?? 'https://example.invalid/',
    sourceRef: resolution.id,
    notes: ['Technology resolver output enters the registry as discovery metadata only.']
  }
}))

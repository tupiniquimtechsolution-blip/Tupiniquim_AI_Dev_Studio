import { createHash } from 'node:crypto'
import {
  registryEntrySchema,
  skillCardSchema,
  skillsSnapshotSchema,
  type RegistryEntry,
  type SkillCard,
  type SkillsSnapshot
} from '@tupiniquim/contracts'

export const pinnedFindSkillsId = 'vercel-labs/skills/find-skills'

const stableUuid = (value: string): string => {
  const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const parseSnapshot = (input: unknown): SkillsSnapshot => {
  const snapshot = skillsSnapshotSchema.parse(input)
  if (snapshot.returned !== snapshot.skills.length) throw new Error('Snapshot skills.sh inconsistente: returned difere de skills.length.')
  const pinned = snapshot.skills.find((skill) => skill.id === pinnedFindSkillsId)
  if (!snapshot.pinned.includes(pinnedFindSkillsId) || pinned === undefined || !pinned.pinned) {
    throw new Error(`Snapshot skills.sh sem pinned obrigatório: ${pinnedFindSkillsId}`)
  }
  return snapshot
}

export const skillSnapshotToCards = (input: unknown): SkillCard[] => {
  const snapshot = parseSnapshot(input)
  return snapshot.skills.map((skill) => skillCardSchema.parse({
    id: skill.id,
    name: skill.name,
    source: skill.source,
    rank: skill.rank,
    installs: skill.installs,
    sourceType: skill.sourceType,
    installUrl: skill.installUrl,
    skillsUrl: skill.url,
    auditStatus: 'UNREVIEWED',
    risk: 'UNKNOWN',
    costClass: 'UNKNOWN',
    permissions: [],
    recommendedAgents: [],
    enabledProjects: [],
    lastSyncedAt: snapshot.generatedAt,
    pinned: skill.pinned
  }))
}

export const skillSnapshotToRegistryEntries = (input: unknown): RegistryEntry[] => {
  const snapshot = parseSnapshot(input)
  return snapshot.skills.map((skill) => registryEntrySchema.parse({
    id: stableUuid(`skills.sh:${skill.id}`),
    kind: 'SKILL',
    name: skill.name,
    description: `Skill descoberta no skills.sh (${snapshot.view}), rank #${skill.rank}. Popularidade não equivale a aprovação de segurança.`,
    scope: { kind: 'GLOBAL' },
    status: 'DISCOVERED',
    trust: 'EXTERNAL_UNTRUSTED',
    license: 'UNKNOWN',
    cost: 'UNKNOWN',
    dependencies: [],
    permissions: [],
    citations: [snapshot.source],
    tags: ['skills.sh', snapshot.view, ...(skill.pinned ? ['pinned'] : [])],
    metadata: {
      skillId: skill.id,
      rank: String(skill.rank),
      installs: String(skill.installs),
      sourceType: skill.sourceType,
      installUrl: skill.installUrl,
      skillsUrl: skill.url,
      pinned: String(skill.pinned),
      dependenciesReviewed: 'false',
      permissionsReviewed: 'false'
    },
    provenance: {
      sourceUrl: snapshot.source,
      retrievedAt: snapshot.generatedAt,
      sourceRef: `${snapshot.view}:${skill.id}:${snapshot.generatedAt}`,
      notes: ['Leaderboard popularity is discovery metadata, not security approval.']
    }
  }))
}

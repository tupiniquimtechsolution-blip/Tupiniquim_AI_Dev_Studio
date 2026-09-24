import { describe, expect, it } from 'vitest'
import { assessSkillGate } from './registry-catalog'
import { pinnedFindSkillsId, skillSnapshotToCards, skillSnapshotToRegistryEntries } from './skill-registry'

const snapshot = {
  schemaVersion: '1.0.0',
  source: 'https://skills.sh',
  endpoint: '/api/v1/skills',
  view: 'all-time' as const,
  requested: 2,
  returned: 2,
  generatedAt: new Date().toISOString(),
  pinned: [pinnedFindSkillsId],
  policy: 'metadata-first; audit-and-approve-before-activation',
  skills: [
    {
      rank: 1,
      id: pinnedFindSkillsId,
      slug: 'find-skills',
      name: 'Find Skills',
      source: 'vercel-labs/skills',
      installs: 1000,
      sourceType: 'github',
      installUrl: 'vercel-labs/skills',
      url: 'https://skills.sh/vercel-labs/skills/find-skills',
      pinned: true
    },
    {
      rank: 2,
      id: 'example/skills/example',
      slug: 'example',
      name: 'Example Skill',
      source: 'example/skills',
      installs: 500,
      sourceType: 'github',
      installUrl: 'example/skills',
      url: 'https://skills.sh/example/skills/example',
      pinned: false
    }
  ]
}

describe('Skill Registry snapshot', () => {
  it('preserva ranking/pinned sem habilitar projeto nem runtime', () => {
    const cards = skillSnapshotToCards(snapshot)

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({ id: pinnedFindSkillsId, rank: 1, pinned: true, auditStatus: 'UNREVIEWED', risk: 'UNKNOWN' })
    expect(cards[0]?.enabledProjects).toEqual([])
    expect(cards[0]?.permissions).toEqual([])
  })

  it('converte leaderboard somente em DISCOVERED/EXTERNAL_UNTRUSTED', () => {
    const entries = skillSnapshotToRegistryEntries(snapshot)
    const pinned = entries.find((entry) => entry.metadata.skillId === pinnedFindSkillsId)
    if (pinned === undefined) throw new Error('find-skills pinned ausente no fixture.')

    expect(pinned.status).toBe('DISCOVERED')
    expect(pinned.trust).toBe('EXTERNAL_UNTRUSTED')
    expect(pinned.metadata.pinned).toBe('true')
    const gate = assessSkillGate(pinned, 'project-a')
    expect(gate.adoptionReady).toBe(false)
    expect(gate.runtimeExecutionAuthorized).toBe(false)
    expect(gate.blockers).toEqual(expect.arrayContaining(['STATUS_NOT_VERIFIED', 'PROVENANCE_NOT_CURATED']))
  })

  it('rejeita snapshot sem find-skills pinned', () => {
    const broken = {
      ...snapshot,
      pinned: [],
      skills: snapshot.skills.map((skill) => ({ ...skill, pinned: false }))
    }

    expect(() => skillSnapshotToCards(broken)).toThrow('pinned obrigatório')
  })

  it('rejeita snapshot com contagem inconsistente', () => {
    expect(() => skillSnapshotToCards({ ...snapshot, returned: 1 })).toThrow('returned difere')
  })
})

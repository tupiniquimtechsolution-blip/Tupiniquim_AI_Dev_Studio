import { describe, expect, it } from 'vitest'
import { buildMw3ReadinessReport, createVibeCodingToolkitPlaybookSource } from './readiness-gate'

const cloudEvidence = [{ kind: 'DOGFOOD' as const, ref: 'scenario-A', detail: 'Real cloud-compatible dogfood evidence.' }]

describe('MW3 readiness gate', () => {
  it('permite CLOUD-GREEN com Windows deferred sem declarar RELEASE-GREEN', () => {
    const report = buildMw3ReadinessReport([
      { id: 'RF-02', title: 'Workspace safety', status: 'CLOUD_PASS', platforms: ['WEB', 'DESKTOP', 'MOBILE'], evidence: cloudEvidence, reason: 'Coberto em fixture real.' },
      { id: 'RF-03', title: 'ConPTY real', status: 'WINDOWS_DEFERRED', platforms: ['DESKTOP'], evidence: [{ kind: 'MANUAL', ref: 'windows-certification', detail: 'Exige Windows real.' }], reason: 'ConPTY não é certificado no runner Linux.' }
    ])

    expect(report.cloudGreenEligible).toBe(true)
    expect(report.releaseGreenEligible).toBe(false)
    expect(report.windowsDeferred).toEqual(['RF-03'])
  })

  it('bloqueia CLOUD-GREEN quando um CLOUD_PASS não apresenta evidência', () => {
    const report = buildMw3ReadinessReport([
      { id: 'RF-11', title: 'Prompt Architect', status: 'CLOUD_PASS', platforms: ['WEB', 'DESKTOP', 'MOBILE'], evidence: [], reason: 'Declaração sem prova.' }
    ])

    expect(report.cloudGreenEligible).toBe(false)
    expect(report.blocked).toEqual(['RF-11'])
  })

  it('mantém playbook externo não autoritativo e sem instalação automática', () => {
    const source = createVibeCodingToolkitPlaybookSource('main')

    expect(source.role).toBe('ENGINEERING_PLAYBOOK_SOURCE')
    expect(source.authoritative).toBe(false)
    expect(source.runtimeDependency).toBe(false)
    expect(source.autoInstallAllowed).toBe(false)
    expect(source.rejectedOrDeferredPractices).toContain('fixed-350-lines-limit-as-global-requirement')
  })
})
